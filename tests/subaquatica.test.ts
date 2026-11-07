import { describe, expect, it } from 'vitest'
import { ChaveSeguranca, SUBAQUATICA, durezaZTA, fatorCorrente, laudoSubaquatico, poroAgua, pressaoBar, t85S } from '../src/modelo/subaquatica'
import { PECAS_SUBAQUATICA, correnteFonteSugerida } from '../src/missoes/pecasSubaquatica'
import { aporteAlvoKJmm } from '../src/missoes/pecasEletrodo'

describe('solda subaquática molhada (H110)', () => {
  it('pressão e corrente crescem com a profundidade', () => {
    expect(pressaoBar(0)).toBe(1)
    expect(pressaoBar(18)).toBeCloseTo(2.8)
    expect(fatorCorrente(18)).toBeGreaterThan(fatorCorrente(4))
    const p = PECAS_SUBAQUATICA[0]
    expect(correnteFonteSugerida(p).min).toBeGreaterThan(p.correnteA.min)
  })

  it('arco longo e profundidade enchem o cordão de poro', () => {
    expect(poroAgua(4, 0.8)).toBeLessThan(0.25)
    expect(poroAgua(4, 1.6)).toBeGreaterThan(0.25)
    expect(poroAgua(18, 1)).toBeGreaterThan(poroAgua(4, 1))
  })

  it('a água encurta o resfriamento e endurece a ZTA; revenimento e mais calor ajudam', () => {
    expect(t85S(1, 8)).toBeLessThan(t85S(1, null) / 3)
    const ar = durezaZTA(0.18, 0.38, t85S(1, null))
    const agua = durezaZTA(0.18, 0.38, t85S(1, 8))
    expect(agua).toBeGreaterThan(ar + 80)
    expect(durezaZTA(0.18, 0.38, t85S(1, 8), 2)).toBe(agua - SUBAQUATICA.revenimentoHV)
    expect(durezaZTA(0.18, 0.38, t85S(1.5, 8))).toBeLessThan(agua)
  })

  it('cais passa no aporte da peça; a plataforma pede técnica (mais calor ou revenimento)', () => {
    const laudo = (i: number, fatorAporte = 1, passes = 1) => {
      const p = PECAS_SUBAQUATICA[i], s = p.subaquatica!
      return laudoSubaquatico({ profundidadeM: s.profundidadeM, carbono: s.carbono, ce: s.ce, aporteKJmm: aporteAlvoKJmm(p) * fatorAporte, passes, choques: 0 })
    }
    expect(laudo(0).aprovado).toBe(true)
    expect(laudo(2).aprovado).toBe(false)
    expect(laudo(2, 1, 2).aprovado).toBe(true)
    expect(laudo(2, 1.4).durezaHV).toBeLessThan(laudo(2).durezaHV)
  })

  it('a chave só liga depois da confirmação, e trocar a vareta ligada é choque', () => {
    const c = new ChaveSeguranca()
    expect(c.ligada).toBe(false)
    c.pedir()
    expect(c.estado).toBe('ligando')
    c.avancar(0.3)
    expect(c.ligada).toBe(false)
    c.avancar(SUBAQUATICA.confirmacaoS)
    expect(c.ligada).toBe(true)
    expect(c.trocarVareta()).toBe('choque')
    c.pedir(); c.avancar(2)
    expect(c.ligada).toBe(false)
    expect(c.trocarVareta()).toBe('ok')
    const l = laudoSubaquatico({ profundidadeM: 4, carbono: 0.16, ce: 0.34, aporteKJmm: 1, passes: 1, choques: c.choques })
    expect(l.descontoChoques).toBe(SUBAQUATICA.descontoChoque)
    expect(l.aprovado).toBe(false)
  })
})
