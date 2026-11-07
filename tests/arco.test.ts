import { describe, expect, it } from 'vitest'
import { estiloArco } from '../src/render/efeitos'

/** Sorteio fixo, para o teste não depender de Math.random. */
const fixo = (v: number) => () => v

describe('clarão do arco (H45): mesma regra no 2D e no 3D', () => {
  it('equilibrado: tamanho de referência, sem engasgo nem passeio', () => {
    const e = estiloArco(0, fixo(0.5))
    expect(e.tamanho).toBe(1)
    expect(e.alfa).toBe(1)
    expect(e.dxMm).toBe(0)
    expect(e.dyMm).toBe(0)
    expect(e.raioMm).toBeCloseTo(14, 6)
  })

  it('curto demais: menor e engasga (pisca) quando o sorteio cai baixo', () => {
    const e = estiloArco(-3, fixo(0.1))
    expect(e.tamanho).toBeLessThan(1)
    expect(e.alfa).toBe(0.25)
    expect(e.dxMm).toBeCloseTo(estiloArco(-3, fixo(0.5)).dxMm, 9) // curto não passeia
    expect(estiloArco(-3, fixo(0.9)).alfa).toBe(1)
  })

  it('longo demais: maior e passeia até 2 mm, sem engasgo', () => {
    const e = estiloArco(3, fixo(1))
    expect(e.tamanho).toBeGreaterThan(1)
    expect(e.alfa).toBe(1)
    expect(e.dxMm).toBeCloseTo(2, 6)
    expect(estiloArco(3, fixo(0)).dxMm).toBeCloseTo(-2, 6)
  })

  it('limites: tamanho entre 0,5 e 1,9; núcleo entre 0,06 e 0,3', () => {
    for (const desvio of [-20, -5, 0, 5, 20]) {
      const e = estiloArco(desvio, fixo(0.3))
      expect(e.tamanho).toBeGreaterThanOrEqual(0.5)
      expect(e.tamanho).toBeLessThanOrEqual(1.9)
      expect(e.nucleo).toBeGreaterThanOrEqual(0.06)
      expect(e.nucleo).toBeLessThanOrEqual(0.3)
    }
  })
})
