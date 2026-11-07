import { describe, expect, it } from 'vitest'
import { DepositoEletrodo, SOLIDIFICA_MS } from '../src/modelo/depositoEletrodo'
import { pecaEletrodo } from '../src/missoes/pecasEletrodo'

/**
 * Dois passes retos e iguais, lado a lado, com o primeiro já frio. `fator` multiplica
 * a distância de referência entre centros d = 2w/3 (FOM; MMFOM com w₁ = w₂, Banaee et al. 2023, eq. 6).
 */
function doisPasses(fator: number, fps = 120) {
  const dep = new DepositoEletrodo(pecaEletrodo('cordao-sobre-chapa'))
  const w = dep.larguraPasse(), d = (fator * 2 * w) / 3
  let t = 0, posto = 0
  const passe = (y: number) => {
    for (let x = 20; x < 130; x += 2.5 / fps) { dep.depositar(x, y, 20 / fps, t); posto += 20 / fps; t += 1000 / fps }
  }
  passe(-d / 2)
  t += 60000 // como no artigo: 60 s entre os dois cordões (p. 8)
  passe(d / 2)
  const pico = dep.espessura(75, -d / 2), meio = dep.espessura(75, 0)
  return { dep, pico, meio, segundo: dep.espessura(75, d / 2), posto }
}

describe('H96: passes lado a lado — vale, plano ou morro pela distância entre centros', () => {
  it('na distância de referência 2w/3 sai quase plano, com um morro leve (como nos ensaios do MMFOM)', () => {
    const r = doisPasses(1)
    expect(r.meio / r.pico).toBeGreaterThan(1)
    expect(r.meio / r.pico).toBeLessThan(1.2)
  })
  it('passes perto demais: morro entre eles', () => {
    const r = doisPasses(0.75)
    expect(r.meio / r.pico).toBeGreaterThan(1.3)
  })
  it('passes longe demais: vale entre eles', () => {
    const r = doisPasses(1.3)
    expect(r.meio / r.pico).toBeLessThan(0.6)
  })
  it('o segundo passe sobre o primeiro conserva o volume e não depende da taxa de quadros', () => {
    const a = doisPasses(1, 30), b = doisPasses(1, 144)
    expect(a.dep.volumeTotal()).toBeCloseTo(a.posto, 6)
    expect(a.meio).toBeCloseTo(b.meio, 1)
    expect(a.segundo).toBeCloseTo(b.segundo, 1)
  })
  it('o metal do passe anterior fica marcado como frio depois do tempo de solidificação', () => {
    const dep = new DepositoEletrodo(pecaEletrodo('cordao-sobre-chapa'))
    for (let x = 40; x < 60; x += 0.1) dep.depositar(x, 0, 0.5, 0)
    const k = (100 * dep.nx) + 50
    expect(dep.solido[k]).toBe(0)
    dep.depositar(50.5, 0, 0.01, SOLIDIFICA_MS + 1)
    expect(dep.solido[k]).toBeGreaterThan(0)
  })
})
