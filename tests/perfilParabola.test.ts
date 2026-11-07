import { describe, expect, it } from 'vitest'
import { DepositoEletrodo } from '../src/modelo/depositoEletrodo'
import { pecaEletrodo } from '../src/missoes/pecasEletrodo'

/** Passe reto sobre a chapa inteira, a `v` mm/s, depositando `taxa` mm³/s em passos de `dt` s. */
function passe(op: { v?: number; taxa?: number; dt?: number; razao?: number; peca?: string } = {}) {
  const peca = pecaEletrodo(op.peca ?? 'cordao-sobre-chapa')
  const dep = new DepositoEletrodo(peca)
  const v = op.v ?? 2.5, taxa = op.taxa ?? 20, dt = op.dt ?? 1 / 120
  let posto = 0
  for (let x = 20; x < 130; x += v * dt) { dep.depositar(x, 0, taxa * dt, 0, op.razao ?? 0.25); posto += taxa * dt }
  return { dep, posto }
}

/** Corte em x: alturas por desvio lateral n, largura (onde há metal) e altura máxima. */
function corte(dep: DepositoEletrodo, x: number) {
  const pontos: [number, number][] = []
  for (let n = -10; n <= 10; n += 0.25) pontos.push([n, dep.espessura(x, n)])
  const com = pontos.filter(([, e]) => e > 0.02)
  const w = com.length ? com[com.length - 1][0] - com[0][0] : 0
  const h = Math.max(...pontos.map(([, e]) => e))
  const area = pontos.reduce((s, [, e]) => s + e * 0.25, 0)
  return { pontos, w, h, area }
}

describe('H95: seção parabólica do eletrodo e do TIG (Banaee et al. 2023, eq. 1)', () => {
  it('o corte de um passe reto segue y = h(1 − 4n²/w²)', () => {
    const { dep } = passe()
    const c = corte(dep, 75)
    const larg = dep.larguraPasse()
    let erro = 0, n = 0
    for (const [y, e] of c.pontos) {
      if (Math.abs(y) > larg / 2) { expect(e).toBeLessThan(0.02 * c.h); continue }
      erro += (e - c.h * (1 - (4 * y * y) / (larg * larg))) ** 2; n++
    }
    expect(Math.sqrt(erro / n)).toBeLessThan(0.05 * c.h)
  })

  it('área do corte = 2wh/3 (dedução da parábola) e igual ao metal posto por mm', () => {
    const { dep } = passe({ v: 2.5, taxa: 20 })
    const c = corte(dep, 75)
    const larg = dep.larguraPasse()
    // A grade tem células de 0,5 mm na lateral: a altura amostrada perde um pouco do pico (até ~2 %).
    expect(Math.abs(c.area / ((2 / 3) * larg * c.h) - 1)).toBeLessThan(0.03)
    // Conservação: no meio do passe, cada mm recebe taxa ÷ velocidade.
    expect(c.area).toBeCloseTo(20 / 2.5, 0)
  })

  it('o volume entra inteiro e uma vez só', () => {
    const { dep, posto } = passe()
    let soma = 0
    for (let k = 0; k < dep.metal.length; k++) soma += dep.metal[k] * dep.dx * dep.dy
    expect(dep.volumeTotal()).toBeCloseTo(posto, 6)
    expect(soma).toBeCloseTo(posto, 6)
  })

  it('mesmo cordão a 30 e a 144 quadros/s', () => {
    const a = corte(passe({ dt: 1 / 30 }).dep, 75), b = corte(passe({ dt: 1 / 144 }).dep, 75)
    expect(a.h).toBeCloseTo(b.h, 2)
    expect(a.area).toBeCloseTo(b.area, 2)
  })

  it('a largura cresce com o diâmetro do eletrodo e com o arco longo; mais devagar, cordão maior', () => {
    const fino = new DepositoEletrodo(pecaEletrodo('cordao-chapa')), grosso = new DepositoEletrodo(pecaEletrodo('t-estrutural'))
    expect(grosso.larguraPasse()).toBeGreaterThan(fino.larguraPasse())
    expect(fino.larguraPasse(0.18)).toBeGreaterThan(fino.larguraPasse(0.3))
    expect(corte(passe({ v: 1.5 }).dep, 75).area).toBeGreaterThan(corte(passe({ v: 3 }).dep, 75).area)
  })
})
