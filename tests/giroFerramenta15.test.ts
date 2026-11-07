import { describe, it, expect } from 'vitest'
import { girarFerramenta15 } from '../src/entrada/giroFerramenta15'
const inicio = { azimute: 0, inclinacao: 0 }
describe('giro da ferramenta no espaço da tela', () => {
  it('arraste horizontal inclina mesmo partindo da vertical', () => {
    const o = girarFerramenta15(inicio, [1, 0, 0], [0, 0.8, -0.6], 100, 0, 0.4)
    expect(o.inclinacao).toBeGreaterThan(10)
    expect(o.azimute).toBeCloseTo(0)
  })
  it('acompanha a direita da câmera após órbita', () => {
    const o = girarFerramenta15(inicio, [0, 0, -1], [0.6, 0.8, 0], 100, 0, 0.4)
    expect(o.azimute).toBeCloseTo(270)
  })
  it('retornar o cursor à âncora restaura a orientação sem acumular deriva', () => {
    const original = { azimute: 357, inclinacao: 40 }
    const fim = girarFerramenta15(original, [1, 0, 0], [0, 1, 0], 0, 0, 0.4)
    expect(fim).toEqual(original)
  })
  it('limita a inclinação sem atravessar a chapa, mantendo valores finitos', () => {
    const o = girarFerramenta15({ azimute: 45, inclinacao: 80 }, [1, 0, 0], [0, 1, 0], 9999, 9999, 2)
    expect(o.inclinacao).toBeLessThanOrEqual(85)
    expect(Number.isFinite(o.azimute)).toBe(true)
  })
})
