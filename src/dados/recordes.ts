import { DISPOSITIVOS, type Dispositivo } from '../entrada/tipos'
import { buscarMissao, DIFICULDADES, type Dificuldade } from '../missoes/catalogo'
import { MATERIAIS, type MaterialId } from '../modelo/material'
import { CATEGORIAS, ESCALA_PONTUACAO, type CategoriaId } from '../pontuacao/regras'
import { novoId } from './armazenamento'

/*
 * Recordes do Arcade (docs/DADOS.md). Ficam só neste navegador.
 * Rankings separados por missão (e versão da missão), dificuldade,
 * dispositivo e versão da pontuação: desafios diferentes não se comparam.
 */

export interface Recorde {
  id: string
  nome: string
  total: number
  aprovada: boolean
  categorias: Record<CategoriaId, number>
  missaoId: string
  missaoVersao: number
  missaoTitulo: string
  dificuldade: Dificuldade
  processo: 'MIG/MAG'
  material: MaterialId
  dispositivo: Dispositivo
  /** ISO 8601. */
  data: string
  versaoPontuacao: string
}

export const FORMATO_EXPORTACAO = 'soldagem-mig/recordes'
export const NOME_MAXIMO = 24

/** Remove espaços extras e limita o tamanho; devolve '' se não sobrar nada. */
export function normalizarNome(nome: string): string {
  return nome.replace(/\s+/g, ' ').trim().slice(0, NOME_MAXIMO)
}

export function chaveRanking(r: Pick<Recorde, 'missaoId' | 'missaoVersao' | 'dificuldade' | 'dispositivo' | 'versaoPontuacao'>): string {
  return `${r.missaoId}@${r.missaoVersao}|${r.dificuldade}|${r.dispositivo}|${r.versaoPontuacao}`
}

/** Total, integridade, desenho e, por fim, quem chegou primeiro, aprovada ou não (v1.8, H89). */
export function compararRecordes(a: Recorde, b: Recorde): number {
  if (a.total !== b.total) return b.total - a.total
  for (const c of ['integridade', 'desenho'] as CategoriaId[]) {
    if (a.categorias[c] !== b.categorias[c]) return b.categorias[c] - a.categorias[c]
  }
  return a.data.localeCompare(b.data)
}

export function ranking(recordes: Recorde[], chave: string): Recorde[] {
  return recordes.filter((r) => chaveRanking(r) === chave).sort(compararRecordes)
}

/** 1 = primeiro lugar. */
export function posicaoNoRanking(recordes: Recorde[], recorde: Recorde): number {
  return ranking(recordes, chaveRanking(recorde)).findIndex((r) => r.id === recorde.id) + 1
}

/** O registro passou a liderar o seu ranking? */
export function ehNovoRecorde(recordes: Recorde[], recorde: Recorde): boolean {
  return posicaoNoRanking(recordes, recorde) === 1
}

export function criarRecorde(dados: Omit<Recorde, 'id' | 'nome' | 'data'>, nome: string, data: Date): Recorde {
  const n = normalizarNome(nome)
  if (!n) throw new Error('Informe um nome ou apelido.')
  return { ...dados, id: novoId('rec'), nome: n, data: data.toISOString() }
}

/** Valida um objeto qualquer como recorde. Devolve a lista de problemas (vazia = válido). */
export function problemasDoRecorde(o: unknown): string[] {
  const p: string[] = []
  if (!o || typeof o !== 'object') return ['não é um objeto']
  const r = o as Record<string, unknown>
  const texto = (k: string) => typeof r[k] === 'string' && (r[k] as string).length > 0
  if (!texto('id')) p.push('id ausente')
  if (!texto('nome') || normalizarNome(r.nome as string) !== r.nome) p.push('nome ausente ou inválido')
  // pontuacao-v1/v2 iam até 100; a v3 vai até 1000.
  if (typeof r.total !== 'number' || !(r.total >= 0 && r.total <= ESCALA_PONTUACAO)) p.push(`total fora de 0–${ESCALA_PONTUACAO}`)
  if (typeof r.aprovada !== 'boolean') p.push('aprovada ausente')
  const cats = r.categorias as Record<string, unknown> | undefined
  if (!cats || typeof cats !== 'object' || CATEGORIAS.some((c) => typeof cats[c] !== 'number' || (cats[c] as number) < 0)) {
    p.push('notas por categoria ausentes')
  }
  if (!texto('missaoId') || typeof r.missaoVersao !== 'number') p.push('missão ausente')
  if (!texto('missaoTitulo')) p.push('título da missão ausente')
  if (!DIFICULDADES.includes(r.dificuldade as Dificuldade)) p.push('dificuldade inválida')
  if (r.processo !== 'MIG/MAG') p.push('processo inválido')
  if (!(typeof r.material === 'string' && r.material in MATERIAIS)) p.push('material inválido')
  if (!DISPOSITIVOS.includes(r.dispositivo as Dispositivo)) p.push('dispositivo inválido')
  if (!texto('data') || Number.isNaN(Date.parse(r.data as string))) p.push('data inválida')
  if (!texto('versaoPontuacao')) p.push('versão da pontuação ausente')
  return p
}

export function validarListaRecordes(dados: unknown): Recorde[] | null {
  if (!Array.isArray(dados)) return null
  return dados.filter((r) => problemasDoRecorde(r).length === 0) as Recorde[]
}

export function exportarRecordes(recordes: Recorde[], agora: Date): string {
  return JSON.stringify({ formato: FORMATO_EXPORTACAO, versao: 1, exportadoEm: agora.toISOString(), recordes }, null, 2)
}

export interface ResultadoImportacao {
  /** Recordes novos, prontos para juntar aos existentes. */
  novos: Recorde[]
  /** Já existiam (mesmo id). */
  repetidos: number
  /** Registros recusados e o motivo. */
  recusados: { indice: number; motivo: string }[]
  /** Erro que impede a importação inteira (nada é alterado). */
  erro?: string
}

export function importarRecordes(texto: string, existentes: Recorde[]): ResultadoImportacao {
  let dados: unknown
  try {
    dados = JSON.parse(texto)
  } catch {
    return { novos: [], repetidos: 0, recusados: [], erro: 'O arquivo não é um JSON válido.' }
  }
  const o = dados as Record<string, unknown>
  if (!o || typeof o !== 'object' || o.formato !== FORMATO_EXPORTACAO || !Array.isArray(o.recordes)) {
    return { novos: [], repetidos: 0, recusados: [], erro: 'O arquivo não é uma exportação de recordes deste jogo.' }
  }
  if (o.versao !== 1) return { novos: [], repetidos: 0, recusados: [], erro: `Versão de exportação não suportada: ${String(o.versao)}.` }

  const ids = new Set(existentes.map((r) => r.id))
  const resultado: ResultadoImportacao = { novos: [], repetidos: 0, recusados: [] }
  ;(o.recordes as unknown[]).forEach((r, indice) => {
    const problemas = problemasDoRecorde(r)
    if (problemas.length) {
      resultado.recusados.push({ indice, motivo: problemas.join('; ') })
      return
    }
    const rec = r as Recorde
    if (ids.has(rec.id)) {
      resultado.repetidos++
      return
    }
    ids.add(rec.id)
    resultado.novos.push(rec)
  })
  return resultado
}

/** Título legível de uma chave de ranking. */
export function descreverChave(chave: string): string {
  const [missao, dificuldade, dispositivo, versao] = chave.split('|')
  const [id, v] = missao.split('@')
  const m = buscarMissao(id)
  return `${m?.titulo ?? id} (v${v}) · ${dificuldade} · ${dispositivo} · ${versao}`
}
