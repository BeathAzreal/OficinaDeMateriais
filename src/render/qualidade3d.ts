/*
 * Qualidade do visual 3D e o monitor que decide voltar para o 2D. Parte
 * pura (sem Three nem DOM), para poder ser testada. Nada daqui muda o
 * modelo, a pontuação ou a entrada: só o custo do desenho.
 */

export type Qualidade3D = 'baixa' | 'media' | 'alta'
export const QUALIDADES: Qualidade3D[] = ['baixa', 'media', 'alta']

export const NOME_QUALIDADE: Record<Qualidade3D, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
}

export const RESUMO_QUALIDADE: Record<Qualidade3D, string> = {
  baixa: 'Sem sombras, menos faíscas e resolução normal: para notebooks simples.',
  media: 'Sombras leves e resolução intermediária.',
  alta: 'Sombras nítidas, mais faíscas e resolução máxima (até 2×).',
}

export interface PerfilQualidade {
  sombras: boolean
  /** Lado do mapa de sombra (pixels). */
  mapaSombra: number
  /** Teto do devicePixelRatio usado pelo renderer. */
  pixelRatioMax: number
  antialias: boolean
  particulas: { faiscas: number; fumaca: number }
}

export const PERFIS: Record<Qualidade3D, PerfilQualidade> = {
  baixa: { sombras: false, mapaSombra: 512, pixelRatioMax: 1, antialias: false, particulas: { faiscas: 120, fumaca: 30 } },
  media: { sombras: true, mapaSombra: 1024, pixelRatioMax: 1.5, antialias: true, particulas: { faiscas: 250, fumaca: 70 } },
  alta: { sombras: true, mapaSombra: 2048, pixelRatioMax: 2, antialias: true, particulas: { faiscas: 400, fumaca: 120 } },
}

/** Uma qualidade abaixo, ou null se já é a mais baixa. */
export function qualidadeAbaixo(q: Qualidade3D): Qualidade3D | null {
  const i = QUALIDADES.indexOf(q)
  return i > 0 ? QUALIDADES[i - 1] : null
}

export type SituacaoQuadros = 'medindo' | 'ok' | 'lento'

export interface OpcoesMonitor {
  /** Tempo ignorado depois de criar a cena (compilação de shaders, primeiro envio). */
  aquecimentoMs: number
  /** Quantos intervalos entram na mediana. */
  janela: number
  /** Mediana acima disto = lento (45 ms ≈ 22 quadros por segundo). */
  limiteMs: number
  /** Intervalos maiores que isto são aba oculta, pausa ou alerta do navegador: não contam. */
  maxIntervaloMs: number
}

export const MONITOR_PADRAO: OpcoesMonitor = { aquecimentoMs: 2000, janela: 90, limiteMs: 45, maxIntervaloMs: 250 }

/**
 * Mede o intervalo entre quadros e diz se o 3D está lento demais. Usa a
 * mediana (um engasgo isolado não conta) e ignora intervalos enormes (aba
 * oculta: o requestAnimationFrame para, mas isso não é lentidão).
 */
export class MonitorQuadros {
  private readonly anel: Float64Array
  private readonly ordenado: Float64Array
  private n = 0
  private proximo = 0
  private inicio: number | null = null
  private anterior: number | null = null

  constructor(private readonly op: OpcoesMonitor = MONITOR_PADRAO) {
    this.anel = new Float64Array(op.janela)
    this.ordenado = new Float64Array(op.janela)
  }

  /** Recomeça a medir (cena nova, ou volta do 2D para o 3D). */
  reiniciar(): void {
    this.n = 0
    this.proximo = 0
    this.inicio = null
    this.anterior = null
  }

  /** Chamar uma vez por quadro desenhado em 3D. */
  registrar(agoraMs: number): SituacaoQuadros {
    if (this.inicio === null) this.inicio = agoraMs
    const anterior = this.anterior
    this.anterior = agoraMs
    if (agoraMs - this.inicio < this.op.aquecimentoMs || anterior === null) return 'medindo'
    const dt = agoraMs - anterior
    if (dt > this.op.maxIntervaloMs || dt <= 0) return this.n < this.op.janela ? 'medindo' : 'ok'
    this.anel[this.proximo] = dt
    this.proximo = (this.proximo + 1) % this.op.janela
    if (this.n < this.op.janela) this.n++
    if (this.n < this.op.janela) return 'medindo'
    return this.mediana() > this.op.limiteMs ? 'lento' : 'ok'
  }

  mediana(): number {
    if (this.n === 0) return 0
    const v = this.ordenado.subarray(0, this.n)
    v.set(this.anel.subarray(0, this.n))
    v.sort()
    return v[Math.floor(this.n / 2)]
  }
}
