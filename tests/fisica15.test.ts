import { describe, it, expect } from 'vitest'
import { Acionamento15 } from '../src/modelo/acionamento15'
import { Escoria15 } from '../src/modelo/escoria15'
import { PADRAO15, validarControles15 } from '../src/dados/controles15'
function aberto(corrente = 90) {
  const m = new Acionamento15('eletrodo')
  m.regular(corrente)
  m.pressionado = true
  m.definirDistancia(0)
  m.avancar(1 / 120)
  m.definirDistancia(2)
  return m
}
describe('SMAW qualitativo v1.5', () => {
  it('mais corrente aumenta consumo e energia, com mesma distância compensada', () => {
    const a = aberto(80), b = aberto(140)
    a.avancar(1, -a.consumoMmS)
    b.avancar(1, -b.consumoMmS)
    expect(b.restanteMm).toBeLessThan(a.restanteMm)
    expect(b.energiaJ).toBeGreaterThan(a.energiaJ)
    expect(b.volumeMm3).toBeGreaterThan(a.volumeMm3)
  })
  it('contato prolongado gruda antes em corrente baixa; soltar não desfaz a aderência', () => {
    const baixo = new Acionamento15('eletrodo'), normal = new Acionamento15('eletrodo')
    baixo.regular(40)
    for (const m of [baixo, normal]) { m.pressionado = true; m.definirDistancia(0); m.avancar(0.3) }
    expect(baixo.estado).toBe('grudado')
    expect(normal.estado).toBe('contato')
    expect(baixo.volumeMm3).toBe(0)
    const altura = baixo.alturaMm
    baixo.avancar(1, 5)
    expect(baixo.alturaMm).toBe(altura)
    expect(baixo.desgrudar()).toBe(false)
    baixo.soltar()
    expect(baixo.estado).toBe('grudado')
    expect(baixo.desgrudar()).toBe(true)
    expect(baixo.distanciaMm).toBe(3)
    expect(baixo.grudadas).toBe(1)
  })
  it('escória se forma só no eletrodo e não pode ser removida quente', () => {
    const m = aberto()
    m.avancar(0.5, -m.consumoMmS)
    expect(m.escoria.cobertura).toBeGreaterThan(0)
    expect(m.escoria.martelar(75, 0)).toBe(0)
    m.soltar(); m.avancar(5)
    const metal = m.volumeMm3
    expect(m.escoria.martelar(75, 0)).toBeGreaterThan(0)
    expect(m.escoria.escovar(75, 0)).toBeGreaterThan(0)
    expect(m.escoria.cobertura).toBe(0)
    expect(m.volumeMm3).toBe(metal)
    const mig = new Acionamento15('mig'); mig.pressionado = true; mig.avancar(1)
    expect(mig.escoria.cobertura).toBe(0)
  })
  it('soldar sobre escória fria aumenta indicador; limpar antes evita incremento', () => {
    const a = new Escoria15(), b = new Escoria15()
    for (const s of [a, b]) { s.depositar(75, 0, 5); s.esfriar(5) }
    b.martelar(75, 0); b.escovar(75, 0)
    a.depositar(75, 0, 5); b.depositar(75, 0, 5)
    expect(a.inclusaoMm3).toBeGreaterThan(0)
    expect(b.inclusaoMm3).toBe(0)
  })
  it('orientação envolve 360 graus sem saltar a ponta e limita inclinação à face', () => {
    const m = new Acionamento15('eletrodo'), d = m.distanciaMm
    m.orientar(725, 180, -30)
    expect(m.azimuteGraus).toBe(5)
    expect(m.rolamentoGraus).toBe(330)
    expect(m.inclinacaoGraus).toBe(85)
    expect(m.distanciaMm).toBeCloseTo(d)
  })
  it('consumo inclinado recua a ponta na direção da vareta', () => {
    const m = aberto(); m.orientar(0, 30, 0)
    m.avancar(0.2)
    expect(m.xMm).toBeGreaterThan(75)
    expect(m.yMm).toBeCloseTo(0)
    expect(m.distanciaMm).toBeGreaterThan(2)
  })
  it('controles rejeitam conflitos e valores inválidos', () => {
    expect(validarControles15(PADRAO15)).not.toBeNull()
    expect(validarControles15({ ...PADRAO15, camera: 0 })).toBeNull()
    expect(validarControles15({ ...PADRAO15, sensibilidade: NaN })).toBeNull()
    expect(validarControles15({ ...PADRAO15, teclas: { ...PADRAO15.teclas, afastar: PADRAO15.teclas.aproximar } })).toBeNull()
  })
})
