/*
 * Regras da sessão de Arcade, sem DOM: limite de tentativas, separação entre
 * treino e tentativas oficiais, e o que pode ser entregue.
 */

export interface ExecucaoArcade {
  numero: number
  /** null = tentativa oficial abandonada (conta no limite, não pode ser entregue). */
  resultado: unknown | null
}

export interface SessaoArcade<T extends ExecucaoArcade> {
  limite: number
  tentativas: T[]
}

export function restantesArcade<T extends ExecucaoArcade>(s: SessaoArcade<T>): number {
  return s.limite - s.tentativas.length
}

/**
 * Registra uma execução. Treino NUNCA é registrado (não consome tentativa e
 * não pode ser entregue nem ir para o ranking). Oficial além do limite é recusada.
 */
export function registrarExecucao<T extends ExecucaoArcade>(s: SessaoArcade<T>, execucao: T, oficial: boolean): SessaoArcade<T> {
  if (!oficial) return s
  if (restantesArcade(s) <= 0) throw new Error('Limite de tentativas atingido.')
  return { ...s, tentativas: [...s.tentativas, execucao] }
}

/** Só tentativas oficiais concluídas podem ser entregues. */
export function entregaveis<T extends ExecucaoArcade>(s: SessaoArcade<T>): T[] {
  return s.tentativas.filter((t) => t.resultado !== null)
}
