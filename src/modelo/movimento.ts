import type { Avaliacao, Estatistica } from './avaliacao'
import { EXPLICACAO } from './parametros'
import type { Percurso } from './percurso'

/** Um trecho de 5 mm da região avaliada (H20). */
export interface TrechoMovimento {
  inicioMm: number
  fimMm: number
  /** Tempo de arco com a tocha dentro do trecho. */
  permanenciaMs: number
  /** Comprimento ÷ permanência. null se a tocha não passou ali com o arco aberto. */
  velocidadeMms: number | null
  /** Largura média do cordão neste trecho (do modelo). */
  larguraMediaMm: number
}

export interface AnaliseMovimento {
  trechos: TrechoMovimento[]
  /** Comprimento da região ÷ tempo de arco nela: a velocidade que daria a seção média. */
  velocidadeMediaMms: number
  velocidade: Estatistica
  /** Desvio-padrão ÷ média das velocidades por trecho. */
  cvVelocidade: number
  /** Trechos bem mais lentos que a mediana da própria tentativa (H22). */
  pausas: TrechoMovimento[]
}

/**
 * Lê o percurso da tocha na região avaliada e mede a velocidade efetiva por
 * trecho. Devolve null se a avaliação não tem região (nada a medir).
 */
export function analisarMovimento(percurso: Percurso, av: Avaliacao): AnaliseMovimento | null {
  const m = av.medidas
  if (!m) return null

  const trechos: TrechoMovimento[] = []
  const { inicioMm, fimMm } = m.regiao
  for (let a = inicioMm; fimMm - a >= EXPLICACAO.trechoMm / 2; a += EXPLICACAO.trechoMm) {
    const b = Math.min(fimMm, a + EXPLICACAO.trechoMm)
    const permanenciaMs = percurso.permanenciaEntre(a, b)
    const fatias = av.perfil.filter((s) => s.xMm >= a && s.xMm < b)
    trechos.push({
      inicioMm: a,
      fimMm: b,
      permanenciaMs,
      velocidadeMms: permanenciaMs > 0 ? (b - a) / (permanenciaMs / 1000) : null,
      larguraMediaMm: fatias.reduce((s, f) => s + f.larguraMm, 0) / Math.max(1, fatias.length),
    })
  }

  const comArco = trechos.filter((t) => t.velocidadeMms !== null)
  if (comArco.length === 0) return null
  const v = comArco.map((t) => t.velocidadeMms!)
  const media = v.reduce((s, x) => s + x, 0) / v.length
  const desvioPadrao = Math.sqrt(v.reduce((s, x) => s + (x - media) ** 2, 0) / v.length)
  const ordenadas = [...v].sort((a, b) => a - b)
  const mediana = ordenadas[Math.floor(ordenadas.length / 2)]
  const tempoTotalMs = comArco.reduce((s, t) => s + t.permanenciaMs, 0)
  const comprimento = comArco.reduce((s, t) => s + (t.fimMm - t.inicioMm), 0)

  return {
    trechos,
    velocidadeMediaMms: comprimento / (tempoTotalMs / 1000),
    velocidade: { media, min: Math.min(...v), max: Math.max(...v), desvioPadrao },
    cvVelocidade: desvioPadrao / media,
    pausas: comArco.filter((t) => t.velocidadeMms! < EXPLICACAO.pausaFracaoMediana * mediana),
  }
}
