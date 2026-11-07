import { describe, expect, it } from 'vitest'
import { Cordao, LIMITE_JUNTA_MM } from '../src/modelo/cordao'
import { contextoDaMissao, MISSOES } from '../src/missoes/catalogo'
import { Simulacao } from '../src/modelo/simulacao'

/*
 * H58: soldar de novo longe da junta (e do cordão que já está ali) cria outro
 * cordão, em vez de esticar o da junta até o lugar novo.
 */
const passe = (c: Cordao, y: number, x0 = 20, x1 = 130) => {
  for (let x = x0; x <= x1; x += 0.25) c.depositar(x, y, 3, x)
}

describe('cordões soltos (H58)', () => {
  it('segundo passe longe da junta vira outro cordão; o da junta fica igual', () => {
    const so = new Cordao()
    passe(so, 0)
    const dois = new Cordao()
    passe(dois, 0)
    passe(dois, 25)
    const a = so.secao(150)
    const b = dois.secao(150)
    expect(b.larguraMm).toBeCloseTo(a.larguraMm, 9)
    expect(b.yCentroMm).toBeCloseTo(0, 9)
    expect(dois.soltos).toHaveLength(1)
    expect(dois.soltos[0].secao(150).yCentroMm).toBeCloseTo(25, 9)
    // Nada se perde: o metal solto conta no total, não na seção da junta.
    expect(dois.volumeTotal()).toBeCloseTo(2 * so.volumeTotal(), 6)
    expect(dois.volumeSolto()).toBeCloseTo(so.volumeTotal(), 6)
  })

  it('tecimento largo perto da junta continua no mesmo cordão', () => {
    const c = new Cordao()
    for (let x = 20; x <= 130; x += 0.25) c.depositar(x, 6 * Math.sin(x), 3, x)
    expect(c.soltos).toHaveLength(0)
    expect(LIMITE_JUNTA_MM).toBeGreaterThanOrEqual(6)
  })

  it('cordão que já começou fora da junta continua sendo o mesmo cordão solto', () => {
    const c = new Cordao()
    passe(c, 15, 20, 70)
    passe(c, 16, 70, 120)
    passe(c, -30, 40, 90)
    expect(c.soltos).toHaveLength(2)
    expect(c.secao(150).larguraMm).toBe(0)
  })

  it('na simulação: o metal solto conta como metal fora do trecho', () => {
    const m = MISSOES.find((x) => x.id === 'suporte-carbono')!
    const ctx = contextoDaMissao(m, { diametroArameMm: 1, gas: 'ar-co2', oxidoRemovido: true, tecnica: 'neutra', dbcpMm: 15 })
    const sim = new Simulacao(ctx)
    sim.definirAjustes({ alimentacao: 5, tensao: 5.5 })
    let t = 1000
    for (const y of [0, 20]) {
      let x = 10
      sim.iniciarArco({ t, x, y })
      while (x < 140) sim.moverTocha({ t: (t += 8), x: (x += 0.08), y })
      sim.encerrarArco({ t, x, y })
      t += 1000
    }
    expect(sim.cordao.soltos).toHaveLength(1)
    expect(sim.cordao.volumeSolto()).toBeGreaterThan(0)
    expect(Math.abs(sim.cordao.secao(sim.cordao.indiceEm(75)).yCentroMm)).toBeLessThan(0.5)
  })
})
