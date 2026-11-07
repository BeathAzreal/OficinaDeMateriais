import { describe, expect, it } from 'vitest'
import { avaliar } from '../src/modelo/avaliacao'
import { padraoIrregular } from '../src/modelo/cordao'
import { CONTEXTO_PADRAO, type Ajustes } from '../src/modelo/processo'
import { instabilidadeArco, Simulacao } from '../src/modelo/simulacao'

/** Passe a 12 mm/s com os ajustes dados; `quadroMs` muda só a taxa de leituras. */
function passe(ajustes: Ajustes, quadroMs = 8): Simulacao {
  const sim = new Simulacao(CONTEXTO_PADRAO)
  sim.definirAjustes(ajustes)
  let t = 0
  let x = 5
  sim.iniciarArco({ t, x, y: 0 })
  while (x < 145) {
    t += quadroMs
    x += (12 * quadroMs) / 1000
    sim.moverTocha({ t, x, y: 0 })
  }
  sim.encerrarArco({ t, x, y: 0 })
  return sim
}

const cv = (sim: Simulacao) => {
  const ws = Array.from({ length: sim.cordao.nPosicoes }, (_, i) => sim.cordao.secao(i))
    .filter((s) => s.xMm > 20 && s.xMm < 130)
    .map((s) => s.larguraMm)
  const m = ws.reduce((a, b) => a + b, 0) / ws.length
  return Math.sqrt(ws.reduce((a, w) => a + (w - m) ** 2, 0) / ws.length) / m
}

describe('arco fora do equilíbrio (H44)', () => {
  it('instabilidade é zero dentro da tolerância e cresce até ±1 fora dela', () => {
    expect(instabilidadeArco({ alimentacao: 5, tensao: 5.5 }, CONTEXTO_PADRAO)).toBe(0)
    expect(instabilidadeArco({ alimentacao: 5, tensao: 4.6 }, CONTEXTO_PADRAO)).toBe(0)
    // H93 (v2.0): 7,2 m/min com 23,6 V cai no globular, instável mesmo dentro da tolerância do equilíbrio.
    expect(instabilidadeArco({ alimentacao: 5, tensao: 6.4 }, CONTEXTO_PADRAO)).toBe(0.4)
    expect(instabilidadeArco({ alimentacao: 5, tensao: 2 }, CONTEXTO_PADRAO)).toBeLessThan(0)
    expect(instabilidadeArco({ alimentacao: 5, tensao: 10 }, CONTEXTO_PADRAO)).toBe(1)
  })

  it('arco equilibrado: cordão regular; desequilibrado: largura oscila, mesmo metal', () => {
    const eq = passe({ alimentacao: 5, tensao: 5.5 })
    const curto = passe({ alimentacao: 5, tensao: 1.5 })
    const longo = passe({ alimentacao: 5, tensao: 10 })
    expect(cv(eq)).toBeLessThan(0.01)
    expect(cv(curto)).toBeGreaterThan(0.08)
    expect(cv(longo)).toBeGreaterThan(0.08)
    expect(curto.cordao.volumeTotal()).toBeCloseTo(eq.cordao.volumeTotal(), 6)
    // A área se conserva fatia a fatia: onde alarga, abaixa.
    for (const i of [100, 157, 203]) {
      const s = curto.cordao.secao(i)
      expect((2 / 3) * s.larguraMm * s.alturaMm).toBeCloseTo(s.areaMm2, 6)
    }
  })

  it('a regularidade da avaliação piora com o arco instável', () => {
    const eq = avaliar(passe({ alimentacao: 5, tensao: 5.5 }).cordao).medidas!
    const longo = avaliar(passe({ alimentacao: 5, tensao: 10 }).cordao).medidas!
    expect(longo.largura.desvioPadrao).toBeGreaterThan(eq.largura.desvioPadrao * 5)
  })

  it('o padrão é fixo: mesma tentativa com outra taxa de quadros dá o mesmo cordão', () => {
    const a = passe({ alimentacao: 5, tensao: 10 }, 8).cordao
    const b = passe({ alimentacao: 5, tensao: 10 }, 13).cordao
    for (const i of [80, 150, 220]) expect(b.secao(i).larguraMm).toBeCloseTo(a.secao(i).larguraMm, 1)
    for (let x = 0; x < 150; x += 0.7) expect(Math.abs(padraoIrregular(x))).toBeLessThanOrEqual(1)
  })
})
