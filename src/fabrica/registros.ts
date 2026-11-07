import type { RegistroEtapa } from './ordens'

/*
 * O que faz: converte o resultado de cada setor no registro comum da OS
 * (nota de 0 a 100, conforme ou não e uma linha de resumo).
 * Onde mexer: os critérios de "conforme" de cada setor estão aqui.
 */

/** Laboratório: relatório com pelo menos esta nota (0 a 100) é aceito pela qualidade. */
export const NOTA_MINIMA_LABORATORIO = 60

export function registroDoLaboratorio(totalAvaliacao: number, em: string): RegistroEtapa {
  const nota = Math.max(0, Math.min(100, Math.round(totalAvaliacao)))
  const conforme = nota >= NOTA_MINIMA_LABORATORIO
  return {
    nota,
    conforme,
    resumo: `Relatório de análise de falha: ${nota}/100${conforme ? '' : ` (a qualidade pede pelo menos ${NOTA_MINIMA_LABORATORIO})`}`,
    em,
  }
}

export interface EntregaUsinagem {
  conformeDimensoes: boolean
  superficie: { conforme: boolean; raMax: number | null }
  custos: { total: number }
  orcamento: number | null
  conformeGeral: boolean
}

/** Usinagem: dimensões valem 50, rugosidade 30 e custo dentro do orçamento 20. */
export function registroDaUsinagem(r: EntregaUsinagem, em: string): RegistroEtapa {
  const noOrcamento = r.orcamento === null || r.custos.total <= r.orcamento
  const nota = (r.conformeDimensoes ? 50 : 0) + (r.superficie.conforme ? 30 : 0) + (noOrcamento ? 20 : 0)
  const partes = [
    r.conformeDimensoes ? 'dimensões conformes' : 'dimensões fora da tolerância',
    r.superficie.raMax === null ? 'Ra não medida' : `Ra ${r.superficie.raMax.toFixed(2).replace('.', ',')} µm${r.superficie.conforme ? '' : ' (acima do pedido)'}`,
    noOrcamento ? 'dentro do orçamento' : 'acima do orçamento',
  ]
  return { nota, conforme: r.conformeGeral, resumo: `Pino entregue: ${partes.join(' · ')}`, em }
}

/** Soldagem: a pontuação do jogo vai de 0 a 1000 e a aprovação é a do modo Difícil. */
export function registroDaSoldagem(total: number, aprovada: boolean, em: string): RegistroEtapa {
  const nota = Math.max(0, Math.min(100, Math.round(total / 10)))
  return { nota, conforme: aprovada, resumo: `Emenda soldada: ${Math.round(total)}/1000 · ${aprovada ? 'aprovada' : 'não aprovada'} no Difícil`, em }
}

/** Torno convencional (v2.2): nota de 0 a 1000 e aprovação do Difícil (20 % em cada item). */
export function registroDoTorno(nota: number, aprovada: boolean, diametros: { min: number; max: number }, em: string): RegistroEtapa {
  return {
    nota: Math.max(0, Math.min(100, Math.round(nota / 10))),
    conforme: aprovada,
    resumo: `Pino torneado: ${Math.round(nota)}/1000 · Ø ${diametros.min.toFixed(2)}–${diametros.max.toFixed(2)} mm · ${aprovada ? 'aprovado' : 'não aprovado'} no Difícil`,
    em,
  }
}
