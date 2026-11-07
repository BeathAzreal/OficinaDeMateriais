import { MISSOES, type Dificuldade } from '../missoes/catalogo'
import { normalizarNome } from './recordes'
import type { Participante } from './torneio'

/*
 * Perfis de participantes. O mesmo registro serve ao Arcade (com o progresso
 * de missões) e aos torneios (cada torneio cria os seus participantes).
 */

export interface PerfilParticipante extends Participante {
  origem: 'arcade' | 'torneio'
  /** Missões aprovadas na História: "missaoId|dificuldade" (v1.9: só o Difícil conta). */
  aprovadas?: string[]
}

export const chaveProgresso = (missaoId: string, d: Dificuldade) => `${missaoId}|${d}`

/**
 * Progressão da História (H90, v1.9): só no Difícil. A 1ª missão abre; ser aprovado numa
 * missão (pelo menos 40 % em cada categoria) abre a seguinte. Aprovações antigas no Fácil não contam.
 */
export function missaoLiberada(perfil: PerfilParticipante | undefined, missaoId: string, d: Dificuldade): { liberada: boolean; motivo: string } {
  const i = MISSOES.findIndex((m) => m.id === missaoId)
  if (i < 0) return { liberada: false, motivo: 'Missão indisponível.' }
  if (d !== 'profissional') return { liberada: false, motivo: 'A História é jogada só no Difícil.' }
  const aprovadas = new Set(perfil?.aprovadas ?? [])
  if (i > 0 && !aprovadas.has(chaveProgresso(MISSOES[i - 1].id, 'profissional'))) {
    return { liberada: false, motivo: `Seja aprovado em "${MISSOES[i - 1].titulo}" (pelo menos 40 % em cada categoria).` }
  }
  return { liberada: true, motivo: '' }
}

export function buscarPerfilArcade(perfis: PerfilParticipante[], nome: string): PerfilParticipante | undefined {
  const alvo = normalizarNome(nome).toLocaleLowerCase('pt-BR')
  return perfis.find((p) => p.origem === 'arcade' && p.nome.toLocaleLowerCase('pt-BR') === alvo)
}

export function validarPerfis(dados: unknown): PerfilParticipante[] | null {
  if (!Array.isArray(dados)) return null
  return dados.filter(
    (p) =>
      p && typeof p === 'object' && typeof p.id === 'string' && typeof p.nome === 'string' && (p.origem === 'arcade' || p.origem === 'torneio'),
  ) as PerfilParticipante[]
}


/** Resumo derivado dos dados existentes: aprovações desconhecidas não contam. */
export function progressoDoPerfil(perfil: PerfilParticipante | undefined) {
  const aprovadas = new Set(perfil?.aprovadas ?? [])
  const aprendiz = MISSOES.filter(m => aprovadas.has(chaveProgresso(m.id, 'aprendiz'))).length
  const profissional = MISSOES.filter(m => aprovadas.has(chaveProgresso(m.id, 'profissional'))).length
  // H90: a História é só no Difícil; a próxima é a primeira liberada ainda sem aprovação.
  const proxima = MISSOES.find(m => !aprovadas.has(chaveProgresso(m.id, 'profissional')) && missaoLiberada(perfil,m.id,'profissional').liberada)
  return { aprendiz, profissional, total: MISSOES.length, proximaId: proxima?.id ?? null, dificuldade: 'profissional' as const }
}
