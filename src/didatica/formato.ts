/** Formatação de números em pt-BR para os textos didáticos. */

const f0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const f1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const f2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fp = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

export const n0 = (v: number): string => f0.format(v)
export const n1 = (v: number): string => f1.format(v)
export const n2 = (v: number): string => f2.format(v)
export const pct = (v: number): string => fp.format(v)

/** Fator multiplicativo como variação percentual com sinal: 1,12 → "+12 %". */
export function variacao(fator: number): string {
  const sinal = fator >= 1 ? '+' : '−'
  return `${sinal}${fp.format(Math.abs(fator - 1))}`
}

export function plural(n: number, singular: string, pluralForma: string): string {
  return `${n} ${n === 1 ? singular : pluralForma}`
}
