import { TRAJETORIA } from './parametros'

/** Uma leitura da posição da tocha: instante em ms e posição em mm da peça. */
export interface Amostra {
  t: number
  x: number
  y: number
}

/**
 * O mouse só envia leituras quando se mexe. Se passou muito tempo entre duas
 * leituras, a tocha ficou PARADA na primeira posição e só depois se deslocou.
 * Hipótese H5: o deslocamento entre duas leituras dura no máximo
 * TRAJETORIA.duracaoMaxDeslocamentoMs. Esta função diz quando ele começou.
 */
export function inicioDoDeslocamento(a0: Amostra, a1: Amostra): number {
  return Math.max(a0.t, a1.t - TRAJETORIA.duracaoMaxDeslocamentoMs)
}

/** Posição da tocha no instante t, entre as leituras a0 e a1 (segundo H5). */
export function posicaoEntre(a0: Amostra, a1: Amostra, t: number): { x: number; y: number } {
  const tIni = inicioDoDeslocamento(a0, a1)
  if (t <= tIni) return a0
  if (t >= a1.t) return a1
  const f = (t - tIni) / (a1.t - tIni)
  return { x: a0.x + (a1.x - a0.x) * f, y: a0.y + (a1.y - a0.y) * f }
}
