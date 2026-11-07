import { describe, expect, it } from 'vitest'
import { acoCoberto, calcularLaudo, fontesDoLaudo, semLaudo } from '../src/mfl/laudoTermico'
import { MODELOS, modelosDoJogo } from '../src/mfl/motor'

/*
 * H111: o laudo térmico é calculado pela MFL (WebAssembly) com os modelos de
 * modelos/. As referências são as do exemplo examples/welding/thermal_cycle.mfl
 * da MFL v0.4 (MAG, 25 V, 250 A, 5 mm/s, aço de 10 mm, 20 °C), verificadas
 * lá contra soluções independentes (docs/welding.md da MFL).
 */
describe('laudo térmico pela MFL', () => {
  const base = { material: 'aco-carbono', tensaoV: 25, correnteA: 250, velocidadeMms: 5, espessuraMm: 10 } as const

  it('registra os modelos .mfl do jogo', () => {
    expect(Object.keys(MODELOS).sort()).toEqual([
      'modelos/materiais/aco.mfl',
      'modelos/soldagem/aporte.mfl',
      'modelos/soldagem/laudo_termico.mfl',
    ])
    expect(fontesDoLaudo(true).every((f) => f.texto.length > 0)).toBe(true)
  })

  it('reproduz o exemplo de referência da MFL (chapa fina, 2-D)', async () => {
    const l = await calcularLaudo(base)
    expect(l.aporteKJmm).toBeCloseTo(1, 12)
    expect(l.potenciaKW).toBeCloseTo(5, 12)
    expect(l.aco).not.toBeNull()
    expect(l.aco!.transicaoMm).toBeCloseTo(14.658605275561131, 9)
    expect(l.aco!.chapaFina).toBe(true)
    expect(l.aco!.t85S).toBeCloseTo(11.363566321499013, 9)
    expect(l.aco!.meiaLarguraZfMm).toBeCloseTo(2.9080258782795396, 6)
    expect(l.aco!.larguraZtaMm).toBeCloseTo(3.708824690602919, 6)
  })

  it('chapa grossa escoa em 3-D e esfria mais rápido', async () => {
    const fina = await calcularLaudo(base)
    const grossa = await calcularLaudo({ ...base, espessuraMm: 20 })
    expect(grossa.aco!.chapaFina).toBe(false)
    expect(grossa.aco!.t85S).toBeLessThan(fina.aco!.t85S)
    // EN 1011-2, 3-D com F3 = 1: t8/5 = (6700 − 5·T0)·Q·(1/(500 − T0) − 1/(800 − T0)), Q em kJ/mm
    expect(grossa.aco!.t85S).toBeCloseTo((6700 - 5 * 20) * 1 * (1 / 480 - 1 / 780), 9)
  })

  it('mais aporte e pré-aquecimento aumentam o t8/5', async () => {
    const t = (await calcularLaudo(base)).aco!.t85S
    expect((await calcularLaudo({ ...base, velocidadeMms: 4 })).aco!.t85S).toBeGreaterThan(t)
    expect((await calcularLaudo({ ...base, preaquecimentoC: 150 })).aco!.t85S).toBeGreaterThan(t)
  })

  it('fora dos aços carbono só dá o aporte', async () => {
    expect(acoCoberto('aluminio')).toBe(false)
    const l = await calcularLaudo({ ...base, material: 'aluminio' })
    expect(l.aco).toBeNull()
    expect(l.aporteKJmm).toBeCloseTo(1, 12)
  })

  it('sem arco ou sem velocidade não há laudo', async () => {
    expect(semLaudo({ ...base, correnteA: 0 })).toMatch(/arco/)
    expect(semLaudo({ ...base, velocidadeMms: 0 })).toMatch(/velocidade/)
    await expect(calcularLaudo({ ...base, velocidadeMms: 0 })).rejects.toThrow(/velocidade/)
  })

  it('os modelos são compilados uma vez e rodados de novo', async () => {
    const m = await modelosDoJogo()
    await calcularLaudo(base)
    const antes = (m as unknown as { scripts: Map<string, unknown> }).scripts.size
    await calcularLaudo({ ...base, espessuraMm: 6 })
    expect((m as unknown as { scripts: Map<string, unknown> }).scripts.size).toBe(antes)
  })
})
