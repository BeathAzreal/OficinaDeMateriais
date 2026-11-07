import { DISPOSITIVOS, type Dispositivo } from '../entrada/tipos'
import { DIFICULDADES, type Dificuldade } from '../missoes/catalogo'
import { MATERIAIS, type MaterialId } from '../modelo/material'
import { novoId } from './armazenamento'
import { normalizarNome } from './recordes'

/*
 * Recordes das partidas de Arcade (desafios aleatórios). Coleção separada dos
 * recordes do modo História, porque a pontuação é acumulada na partida.
 * Rankings por dispositivo e versão das regras. Como cada partida sorteia
 * desafios diferentes, o ranking é de diversão, não de comparação técnica.
 */

export interface DesafioRegistrado {
  missaoId: string
  missaoTitulo: string
  dificuldade: Dificuldade
  material: MaterialId
  condicao: string
  total: number
  concluido: boolean
}

export interface RecordeArcade {
  id: string
  nome: string
  pontos: number
  desafiosConcluidos: number
  desafios: DesafioRegistrado[]
  processo: 'MIG/MAG'
  dispositivo: Dispositivo
  data: string
  versaoArcade: string
  versaoPontuacao: string
}

export const FORMATO_EXPORTACAO_ARCADE = 'soldagem-mig/recordes-arcade'

export function chaveRankingArcade(r: Pick<RecordeArcade, 'dispositivo' | 'versaoArcade' | 'versaoPontuacao'>): string {
  return `${r.dispositivo}|${r.versaoArcade}|${r.versaoPontuacao}`
}

export function compararArcade(a: RecordeArcade, b: RecordeArcade): number {
  if (a.pontos !== b.pontos) return b.pontos - a.pontos
  if (a.desafiosConcluidos !== b.desafiosConcluidos) return b.desafiosConcluidos - a.desafiosConcluidos
  return a.data.localeCompare(b.data)
}

export function rankingArcade(lista: RecordeArcade[], chave: string): RecordeArcade[] {
  return lista.filter((r) => chaveRankingArcade(r) === chave).sort(compararArcade)
}

export function criarRecordeArcade(dados: Omit<RecordeArcade, 'id' | 'nome' | 'data'>, nome: string, data: Date): RecordeArcade {
  const n = normalizarNome(nome)
  if (!n) throw new Error('Informe um nome ou apelido.')
  return { ...dados, id: novoId('arc'), nome: n, data: data.toISOString() }
}

export function problemasDoRecordeArcade(o: unknown): string[] {
  if (!o || typeof o !== 'object') return ['não é um objeto']
  const r = o as Record<string, unknown>
  const p: string[] = []
  const texto = (k: string) => typeof r[k] === 'string' && (r[k] as string).length > 0
  if (!texto('id')) p.push('id ausente')
  if (!texto('nome') || normalizarNome(r.nome as string) !== r.nome) p.push('nome inválido')
  if (typeof r.pontos !== 'number' || r.pontos < 0 || !Number.isFinite(r.pontos)) p.push('pontos inválidos')
  if (typeof r.desafiosConcluidos !== 'number' || r.desafiosConcluidos < 0) p.push('desafios concluídos inválidos')
  if (!Array.isArray(r.desafios)) p.push('lista de desafios ausente')
  else if (
    !r.desafios.every(
      (d: Record<string, unknown>) =>
        d && typeof d.missaoId === 'string' && DIFICULDADES.includes(d.dificuldade as Dificuldade) && typeof d.material === 'string' && d.material in MATERIAIS && typeof d.total === 'number' && typeof d.concluido === 'boolean',
    )
  ) p.push('desafio com dados inválidos')
  if (r.processo !== 'MIG/MAG') p.push('processo inválido')
  if (!DISPOSITIVOS.includes(r.dispositivo as Dispositivo)) p.push('dispositivo inválido')
  if (!texto('data') || Number.isNaN(Date.parse(r.data as string))) p.push('data inválida')
  if (!texto('versaoArcade') || !texto('versaoPontuacao')) p.push('versões ausentes')
  return p
}

export function validarListaArcade(dados: unknown): RecordeArcade[] | null {
  if (!Array.isArray(dados)) return null
  return dados.filter((r) => problemasDoRecordeArcade(r).length === 0) as RecordeArcade[]
}

export function exportarRecordesArcade(lista: RecordeArcade[], agora: Date): string {
  return JSON.stringify({ formato: FORMATO_EXPORTACAO_ARCADE, versao: 1, exportadoEm: agora.toISOString(), recordes: lista }, null, 2)
}
