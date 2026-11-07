import { describe, expect, it } from 'vitest'
import { EQUILIBRIO } from '../src/modelo/parametros'
import { CONTEXTO_PADRAO } from '../src/modelo/processo'
import { alcanceHalo, brilhoRGBA, extraTintaTermica, recencia, TAU_BRILHO_MS, taxaFaiscas } from '../src/render/efeitos'

/*
 * Regras visuais comuns ao 2D e ao 3D (H8, H43): o 3D usa exatamente estas
 * funções, então as duas vistas reagem igual. Nada disso é modelo.
 */

describe('efeitos comuns ao 2D e ao 3D', () => {
  it('faíscas: CO₂ puro solta 1,6×; arco fora do equilíbrio soma o excesso', () => {
    expect(taxaFaiscas(CONTEXTO_PADRAO, 0)).toBe(1)
    expect(taxaFaiscas({ ...CONTEXTO_PADRAO, gas: 'co2' }, 0)).toBeCloseTo(1.6, 9)
    expect(taxaFaiscas(CONTEXTO_PADRAO, EQUILIBRIO.tolerancia)).toBe(1)
    expect(taxaFaiscas(CONTEXTO_PADRAO, -(EQUILIBRIO.tolerancia + 2))).toBeCloseTo(3, 9)
    expect(taxaFaiscas(undefined, 5)).toBe(1)
  })

  it('brilho: esfria com τ e vai de quase branco a vermelho escuro', () => {
    expect(recencia(1000, 1000)).toBe(1)
    expect(recencia(1000 + TAU_BRILHO_MS, 1000)).toBeCloseTo(Math.exp(-1), 9)
    expect(recencia(5000, -Infinity)).toBe(0)
    const s = [0, 0, 0, 0]
    expect(brilhoRGBA(1, 0.85, s)).toEqual([255, 245, 205, 0.85])
    expect(brilhoRGBA(0, 0.85, s).slice(0, 3)).toEqual([110, 20, 10])
    expect(s[3]).toBe(0)
    // Mais recente = mais claro (canal verde cresce).
    expect(brilhoRGBA(0.8, 1, [0, 0, 0, 0])[1]).toBeGreaterThan(brilhoRGBA(0.3, 1, [0, 0, 0, 0])[1])
  })

  it('halo: 3 mm frio, cresce com o aquecimento até 3 + 9 × 1,5', () => {
    expect(alcanceHalo(0)).toBe(3)
    expect(alcanceHalo(1)).toBe(12)
    expect(alcanceHalo(9)).toBeCloseTo(16.5, 9)
  })

  it('tinta térmica: média em ±4 fatias, relativa ao aporte necessário, até 8 mm', () => {
    const aportes = new Float64Array(20).fill(0)
    aportes[10] = 9 // um pico só
    // Na fatia 10: média 9/9 = 1 por fatia; ÷ passo 0,5 ÷ necessário 2 → 1; × 1,5.
    expect(extraTintaTermica(aportes, 10, 0.5, 2)).toBeCloseTo(1.5, 9)
    expect(extraTintaTermica(aportes, 0, 0.5, 2)).toBe(0)
    expect(extraTintaTermica(new Float64Array(20).fill(100), 5, 0.5, 1)).toBe(8)
  })
})
