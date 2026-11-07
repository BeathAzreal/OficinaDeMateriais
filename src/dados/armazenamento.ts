/*
 * Persistência local versionada (docs/DADOS.md).
 *
 * Cada coleção fica numa chave própria do localStorage, dentro de um
 * envelope com a versão do esquema. Nada sai do computador: não há conta
 * nem conexão. Dados corrompidos são guardados à parte (para não se perder
 * nada sem aviso) e a coleção recomeça vazia.
 */

export interface ArmazenamentoChaveValor {
  getItem(chave: string): string | null
  setItem(chave: string, valor: string): void
  removeItem(chave: string): void
  key?(indice: number): string | null
  readonly length?: number
}

export const VERSAO_ESQUEMA = 1
export const PREFIXO = 'soldagem-mig/'

export type Colecao =
  | 'participantes'
  | 'tentativas'
  | 'entregas'
  | 'torneios'
  | 'avaliacoes'
  | 'recordes'
  | 'recordesArcade'
  | 'preferencias'
  | 'manufatura'
  | 'fabrica'

export const COLECOES: Colecao[] = ['participantes', 'tentativas', 'entregas', 'torneios', 'avaliacoes', 'recordes', 'recordesArcade', 'preferencias', 'manufatura', 'fabrica']

interface Envelope {
  esquema: number
  colecao: Colecao
  salvoEm: string
  dados: unknown
}

/**
 * Migrações por versão: MIGRACOES[v] converte dados da versão v para v + 1.
 * A versão 0 é "sem envelope" (o valor gravado direto); não houve versão 0
 * publicada, mas a regra fica pronta para as próximas mudanças.
 */
const MIGRACOES: Record<number, (dados: unknown, colecao: Colecao) => unknown> = {
  0: (dados) => dados,
}

/** Armazenamento em memória (testes, ou quando o navegador bloqueia o localStorage). */
export class MemoriaChaveValor implements ArmazenamentoChaveValor {
  private readonly mapa = new Map<string, string>()
  getItem(chave: string): string | null {
    return this.mapa.has(chave) ? this.mapa.get(chave)! : null
  }
  setItem(chave: string, valor: string): void {
    this.mapa.set(chave, valor)
  }
  removeItem(chave: string): void {
    this.mapa.delete(chave)
  }
  key(indice: number): string | null {
    return [...this.mapa.keys()][indice] ?? null
  }
  get length(): number {
    return this.mapa.size
  }
}

/** Tenta usar o localStorage; se o navegador bloquear, cai para memória e avisa. */
export function armazenamentoDoNavegador(): { armazenamento: ArmazenamentoChaveValor; persistente: boolean } {
  try {
    const ls = window.localStorage
    const teste = `${PREFIXO}__teste__`
    ls.setItem(teste, '1')
    ls.removeItem(teste)
    return { armazenamento: ls, persistente: true }
  } catch {
    return { armazenamento: new MemoriaChaveValor(), persistente: false }
  }
}

export interface Leitura<T> {
  dados: T
  aviso?: string
}

export class Repositorio {
  constructor(
    private readonly armazenamento: ArmazenamentoChaveValor,
    private readonly agora: () => Date = () => new Date(),
  ) {}

  private chave(colecao: Colecao): string {
    return `${PREFIXO}${colecao}`
  }

  /**
   * Lê uma coleção. `validar` recebe os dados já migrados e devolve a versão
   * aceita (ou null se não servir). Qualquer problema vira aviso, nunca erro.
   */
  ler<T>(colecao: Colecao, padrao: T, validar: (dados: unknown) => T | null = (d) => d as T): Leitura<T> {
    const bruto = this.armazenamento.getItem(this.chave(colecao))
    if (bruto === null) return { dados: padrao }
    let envelope: Envelope
    try {
      const lido = JSON.parse(bruto)
      envelope =
        lido && typeof lido === 'object' && 'esquema' in lido && 'dados' in lido
          ? (lido as Envelope)
          : { esquema: 0, colecao, salvoEm: '', dados: lido }
    } catch {
      return { dados: padrao, aviso: this.guardarCorrompido(colecao, bruto, 'JSON inválido') }
    }
    if (typeof envelope.esquema !== 'number' || envelope.esquema > VERSAO_ESQUEMA) {
      return { dados: padrao, aviso: this.guardarCorrompido(colecao, bruto, 'versão de esquema desconhecida') }
    }
    let dados = envelope.dados
    for (let v = envelope.esquema; v < VERSAO_ESQUEMA; v++) dados = MIGRACOES[v](dados, colecao)
    const valido = validar(dados)
    if (valido === null) return { dados: padrao, aviso: this.guardarCorrompido(colecao, bruto, 'estrutura inválida') }
    if (envelope.esquema < VERSAO_ESQUEMA) this.gravar(colecao, valido)
    return { dados: valido }
  }

  gravar(colecao: Colecao, dados: unknown): { ok: true } | { ok: false; erro: string } {
    const envelope: Envelope = { esquema: VERSAO_ESQUEMA, colecao, salvoEm: this.agora().toISOString(), dados }
    try {
      this.armazenamento.setItem(this.chave(colecao), JSON.stringify(envelope))
      return { ok: true }
    } catch (e) {
      return { ok: false, erro: `Não foi possível salvar (${(e as Error).name}). O espaço do navegador pode estar cheio.` }
    }
  }

  apagar(colecao: Colecao): void {
    this.armazenamento.removeItem(this.chave(colecao))
  }

  private guardarCorrompido(colecao: Colecao, bruto: string, motivo: string): string {
    const chave = `${PREFIXO}corrompido/${colecao}/${this.agora().getTime()}`
    try {
      this.armazenamento.setItem(chave, bruto)
    } catch {
      // Sem espaço: o aviso abaixo ainda informa o problema.
    }
    return `Os dados salvos de "${colecao}" não puderam ser lidos (${motivo}). Uma cópia foi guardada à parte e a coleção recomeçou vazia.`
  }
}

/** Identificador aleatório (não é segredo; só evita colisões). */
export function novoId(prefixo: string): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `${prefixo}-${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`
}
