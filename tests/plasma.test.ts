import { describe, expect, it } from 'vitest'
import { ModeloPlasma, PLASMA } from '../src/modelo/plasma'
import { ModeloTig } from '../src/modelo/tig'
import { PECAS_PLASMA, type PecaPlasma } from '../src/missoes/pecasPlasma'
import { avaliarPlasma, inspecionarPlasma } from '../src/pontuacao/plasma'
import { aprovacaoEletrodo } from '../src/pontuacao/eletrodo'

const peca = (id: string) => PECAS_PLASMA.find((p) => p.id === id)!
const meio = (f: { min: number; max: number }) => (f.min + f.max) / 2

/** Solda do início ao fim: espera o arco (e o keyhole), avança constante e termina como pedido. */
function soldar(p: PecaPlasma, op: { correnteA?: number; gas?: number; v?: number; fim?: 'rampa' | 'corte'; distancia?: number; pararEm?: number } = {}) {
  const m = new ModeloPlasma(p)
  m.correnteA = op.correnteA ?? meio(p.correnteA)
  m.gasLMin = op.gas ?? meio(p.gasLMin)
  m.distanciaMm = op.distancia ?? 4
  m.xMm = p.inicioMm - 5
  m.pedal = 1
  const dt = 1 / 60, v = op.v ?? meio(p.avancoMmS)
  for (let t = 0; t < 3 && !(p.tecnica === 'keyhole' ? m.keyhole : m.raioPocaMm > 1); t += dt) m.avancar(dt)
  for (let x = m.xMm; x < p.fimMm + 5; x += v * dt) {
    m.xMm = x
    m.avancar(dt)
    if (op.pararEm !== undefined && Math.abs(x - op.pararEm) < v * dt) for (let k = 0; k < 90; k++) m.avancar(dt)
  }
  if (op.fim === 'corte') { m.pedal = 0; m.avancar(dt) }
  else for (let k = 0; k < 60; k++) { m.pedal = Math.max(0, m.pedal - dt / 0.6); m.avancar(dt) }
  m.pedal = 0
  m.avancar(dt)
  return m
}

describe('Soldagem a plasma (H107)', () => {
  it('keyhole na faixa sugerida: penetração total, sem furo, aprovada no Difícil', () => {
    for (const id of ['plasma-keyhole-inox', 'plasma-keyhole-aco']) {
      const p = peca(id)
      const m = soldar(p)
      const r = avaliarPlasma(p, m, 'profissional')
      expect(m.furos, id).toHaveLength(0)
      expect(r.passantes / (p.fimMm - p.inicioMm), id).toBeGreaterThan(0.95)
      expect(r.nota, id).toBeGreaterThan(800)
      expect(aprovacaoEletrodo(r, 'profissional').aprovada, id).toBe(true)
    }
  })

  it('gás de plasma baixo: o keyhole não abre e a inspeção aponta falta de penetração', () => {
    const p = peca('plasma-keyhole-inox')
    const m = soldar(p, { gas: 0.5 })
    expect(m.aberturasKeyhole).toBe(0)
    expect(inspecionarPlasma(p, m).map((d) => d.nome)).toContain('Falta de penetração')
  })

  it('gás alto demais: o furo não fecha e a solda vira corte', () => {
    const p = peca('plasma-keyhole-inox')
    const m = soldar(p, { gas: 3.6 })
    expect(m.furos.length).toBeGreaterThan(10)
    expect(inspecionarPlasma(p, m)[0].nome).toMatch(/^Corte em vez de solda/)
  })

  it('no fim, só a rampa de descida fecha o keyhole; cortar de vez deixa um furo', () => {
    const p = peca('plasma-keyhole-inox')
    expect(soldar(p, { fim: 'rampa' }).furos).toHaveLength(0)
    const cortado = soldar(p, { fim: 'corte' })
    expect(cortado.furos).toHaveLength(1)
    expect(cortado.furos[0].xMm).toBeGreaterThan(p.fimMm)
  })

  it('tocha parada com o keyhole aberto: o furo cresce e não fecha', () => {
    const p = peca('plasma-keyhole-inox')
    const m = soldar(p, { pararEm: 75 })
    expect(m.furos.some((f) => Math.abs(f.xMm - 75) < 3)).toBe(true)
  })

  it('avanço rápido demais: o keyhole fecha no caminho e há trechos sem penetrar', () => {
    const p = peca('plasma-keyhole-inox')
    const m = soldar(p, { correnteA: 95, v: 6 })
    expect(avaliarPlasma(p, m, 'aprendiz').passantes / (p.fimMm - p.inicioMm)).toBeLessThan(0.5)
  })

  it('bocal encostado ou corrente acima do bocal: arco duplo, bocal gasto e arco mais aberto', () => {
    const p = peca('plasma-keyhole-inox')
    const m = new ModeloPlasma(p)
    m.correnteA = 140; m.distanciaMm = 4; m.xMm = 60; m.pedal = 1
    m.avancar(0.1)
    const sigmaNovo = m.sigmaMm
    m.distanciaMm = 0.5
    m.avancar(0.1)
    expect(m.arcosDuplos).toBe(1)
    expect(m.bocalGasto).toBe(true)
    expect(m.sigmaMm).toBeGreaterThan(sigmaNovo)
    expect(m.trocarBocal()).toBe(false)
    m.pedal = 0; m.avancar(0.05)
    expect(m.trocarBocal()).toBe(true)
    const alta = new ModeloPlasma(p)
    alta.correnteA = PLASMA.correnteBocalA + 10; alta.distanciaMm = 4; alta.xMm = 60; alta.pedal = 1
    alta.avancar(0.5)
    expect(alta.arcosDuplos).toBe(1)
  })

  it('o tungstênio recuado não contamina, e a coluna quase não abre com a distância (no TIG abre)', () => {
    const p = peca('plasma-keyhole-inox')
    const m = new ModeloPlasma(p), t = new ModeloTig(p)
    m.distanciaMm = 2; t.distanciaMm = 2
    const m2 = m.sigmaMm, t2 = t.sigmaMm
    m.distanciaMm = 8; t.distanciaMm = 8
    expect(m.sigmaMm - m2).toBeLessThan(0.5)
    expect(t.sigmaMm - t2).toBeGreaterThan(1.5)
    expect(m.sigmaMm).toBeLessThan(t.sigmaMm)
    const c = soldar(p, { distancia: 0.5 })
    expect(c.contaminacoes).toBe(0)
  })

  it('microplasma: pouco gás e pouca corrente fundem a chapa de 1 mm sem furar nem abrir keyhole', () => {
    const p = peca('plasma-micro')
    const m = soldar(p)
    const r = avaliarPlasma(p, m, 'profissional')
    expect(m.furos).toHaveLength(0)
    expect(m.aberturasKeyhole).toBe(0)
    expect(r.cobertura).toBeGreaterThan(0.95)
    expect(aprovacaoEletrodo(r, 'profissional').aprovada).toBe(true)
    // Com o gás do keyhole, o jato fura a chapa fina.
    expect(soldar(p, { gas: 1.5, correnteA: 30 }).furos.length).toBeGreaterThan(0)
  })
})
