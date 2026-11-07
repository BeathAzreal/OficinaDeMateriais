import { describe, expect, it } from 'vitest'
import { MISSOES } from '../src/missoes/catalogo'
import { analisarFusao } from '../src/modelo/fusao'
import { CONTEXTO_PADRAO, equilibrioArco, MOVIMENTOS, oscilacaoVisual, type ContextoProcesso, type Movimento } from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'
import { executar } from './util'

/** Passe a 6 mm/s (v1.8, H87: metade de antes); `lateral(x)` permite oscilar à mão. */
function passe(ctx: ContextoProcesso, lateral: (x: number) => number = () => 0): Simulacao {
  const sim = new Simulacao(ctx)
  let t = 0
  let x = 5
  sim.iniciarArco({ t, x, y: lateral(x) })
  while (x < 145) {
    t += 8
    x += 6 * 0.008
    sim.moverTocha({ t, x, y: lateral(x) })
  }
  sim.encerrarArco({ t, x, y: lateral(x) })
  return sim
}

function noMeio(sim: Simulacao) {
  const i = sim.cordao.indiceEm(75)
  return { s: sim.cordao.secao(i), F: analisarFusao(sim.cordao, sim.percurso, sim.contexto)[i].indice, volume: sim.cordao.volumeTotal() }
}

const com = (movimento: Movimento) => noMeio(passe({ ...CONTEXTO_PADRAO, movimento }))

describe('movimento da tocha (H39)', () => {
  it('linha reta equivale ao modelo antigo (dados sem movimento)', () => {
    const antigo = noMeio(passe(CONTEXTO_PADRAO))
    const reto = com('reto')
    expect(reto.s.larguraMm).toBe(antigo.s.larguraMm)
    expect(reto.s.alturaMm).toBe(antigo.s.alturaMm)
    expect(reto.F).toBe(antigo.F)
    expect(reto.s.espalhamentoMm).toBe(0)
  })

  it('oscilar alarga e achata o cordão, espalha o calor e não muda o metal', () => {
    const reto = com('reto')
    for (const m of ['zigue-zague', 'meia-lua', 'circulos'] as const) {
      const o = com(m)
      expect(o.s.larguraMm, m).toBeGreaterThan(reto.s.larguraMm)
      expect(o.s.alturaMm, m).toBeLessThan(reto.s.alturaMm)
      expect(o.F, m).toBeLessThan(reto.F)
      expect(o.volume).toBeCloseTo(reto.volume, 6)
      // Área conservada: (2/3) × largura × altura.
      expect((2 / 3) * o.s.larguraMm * o.s.alturaMm).toBeCloseTo(o.s.areaMm2, 6)
    }
  })

  it('meia-lua é a mais larga; zigue-zague a mais estreita das oscilações', () => {
    const z = com('zigue-zague').s.larguraMm
    const c = com('circulos').s.larguraMm
    const m = com('meia-lua').s.larguraMm
    expect(z).toBeLessThan(c)
    expect(c).toBeLessThan(m)
  })

  it('zigue-zague feito à mão também alarga (vale para qualquer dispositivo)', () => {
    const reto = noMeio(passe(CONTEXTO_PADRAO))
    // Vaivém de ±2 mm a cada 1 mm de avanço.
    const mao = noMeio(passe(CONTEXTO_PADRAO, (x) => 2 * Math.sin(2 * Math.PI * x)))
    expect(mao.s.espalhamentoMm).toBeGreaterThan(1)
    expect(mao.s.larguraMm).toBeGreaterThan(reto.s.larguraMm)
    expect(Math.abs(mao.s.yCentroMm)).toBeLessThan(0.2)
  })

  it('a oscilação desenhada fica dentro da amplitude e some na linha reta', () => {
    for (let t = 0; t < 1000; t += 7) {
      expect(oscilacaoVisual('reto', t)).toEqual({ dx: 0, dy: 0 })
      for (const m of MOVIMENTOS) expect(Math.abs(oscilacaoVisual(m, t).dy)).toBeLessThanOrEqual(2 + 1e-9)
    }
  })
})

describe('cada missão aprova com algum movimento oscilante (aprendiz)', () => {
  for (const m of MISSOES) {
    it(m.id, () => {
      const achou = (['zigue-zague', 'meia-lua', 'circulos'] as const).filter((movimento) => {
        const preparo = { diametroArameMm: m.consumiveis.diametrosMm[m.consumiveis.diametrosMm.length - 1], gas: m.consumiveis.gases[0], oxidoRemovido: true, movimento }
        for (const alimentacao of [3, 4, 5, 6, 7, 8]) {
          const ctx = { ...CONTEXTO_PADRAO, material: m.material, diametroArameMm: preparo.diametroArameMm, gas: preparo.gas }
          const tensao = Math.round(equilibrioArco({ alimentacao, tensao: 5 }, ctx).tensaoEquilibrio * 2) / 2
          if (tensao < 1 || tensao > 10) continue
          for (let v = 2; v <= 13; v += 1)
            for (const acel of m.material === 'aluminio' ? [0, 0.3, 0.5] : [0])
              if (executar(m, 'aprendiz', preparo, { alimentacao, tensao }, v, acel).aprovada) return true
        }
        return false
      })
      expect(achou.length, `${m.id}: nenhum movimento oscilante aprova`).toBeGreaterThan(0)
    })
  }
})
