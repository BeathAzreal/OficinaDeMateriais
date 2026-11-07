/** Arraste ancorado na tela: acompanha a câmera, sem singularidade na vareta vertical. */
export type Vetor15 = readonly [number, number, number]
export interface Orientacao15 { azimute: number; inclinacao: number }
export function girarFerramenta15(inicial: Orientacao15, direita: Vetor15, cima: Vetor15, dx: number, dy: number, sensibilidade: number): Orientacao15 {
  if (![dx, dy, sensibilidade, inicial.azimute, inicial.inclinacao, ...direita, ...cima].every(Number.isFinite)) return inicial
  const az = inicial.azimute * Math.PI / 180, inc = inicial.inclinacao * Math.PI / 180
  const d = [Math.sin(inc) * Math.cos(az), Math.cos(inc), Math.sin(inc) * Math.sin(az)]
  const movimento = direita.map((v, i) => v * dx - cima[i] * dy)
  const paralelo = movimento.reduce((s, v, i) => s + v * d[i], 0)
  const t = movimento.map((v, i) => v - paralelo * d[i])
  const tamanho = Math.hypot(...t)
  if (tamanho < 1e-8) return inicial
  const angulo = Math.min(Math.PI / 2, tamanho * 0.008 * Math.max(0.1, Math.min(2, sensibilidade)))
  const novo = d.map((v, i) => v * Math.cos(angulo) + t[i] / tamanho * Math.sin(angulo))
  const inclinacao = Math.min(85, Math.acos(Math.max(-1, Math.min(1, novo[1]))) * 180 / Math.PI)
  return { azimute: ((Math.atan2(novo[2], novo[0]) * 180 / Math.PI) % 360 + 360) % 360, inclinacao }
}
