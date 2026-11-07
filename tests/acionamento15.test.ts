import { describe, expect, it } from 'vitest'
import { Acionamento15, VARETA15 } from '../src/modelo/acionamento15'

function abrir() {
  const m = new Acionamento15('eletrodo')
  m.pressionado = true
  m.definirDistancia(0)
  m.avancar(1 / 120)
  m.definirDistancia(2)
  return m
}

describe('acionamento e consumo da v1.5', () => {
  it('MIG só deposita com botão pressionado e sobre a peça', () => {
    const m = new Acionamento15('mig')
    m.avancar(2)
    expect(m.volumeMm3).toBe(0)
    m.pressionado = true
    m.avancar(1)
    expect(m.volumeMm3).toBeCloseTo(64)
    m.naPeca = false
    m.avancar(1)
    expect(m.volumeMm3).toBeCloseTo(64)
    m.soltar()
    expect(m.estado).toBe('desligado')
  })
  it('aproximar sozinho ou apertar longe não abre o eletrodo; toque seguido de afastamento abre', () => {
    const m = new Acionamento15('eletrodo')
    m.definirDistancia(0)
    m.avancar(1)
    expect(m.volumeMm3).toBe(0)
    m.definirDistancia(2)
    m.pressionado = true
    m.avancar(1)
    expect(m.estado).toBe('pronto')
    m.definirDistancia(0)
    m.avancar(0.1)
    expect(m.estado).toBe('contato')
    expect(m.volumeMm3).toBe(0)
    m.definirDistancia(2)
    m.avancar(0.1)
    expect(m.estado).toBe('arco')
    expect(m.restanteMm).toBeLessThan(VARETA15.inicialMm)
  })
  it('vareta encurta, distância aumenta e o arco apaga sem compensação', () => {
    const m = abrir()
    const altura = m.alturaMm
    m.avancar(4)
    expect(m.alturaMm).toBeCloseTo(altura)
    expect(m.distanciaMm).toBeGreaterThan(5)
    expect(m.estado).toBe('pronto')
    const restante = m.restanteMm
    m.avancar(2)
    expect(m.restanteMm).toBe(restante)
  })
  it('passos com 30 ou 144 quadros por segundo produzem o mesmo consumo', () => {
    const a = abrir(), b = abrir()
    for (let i = 0; i < 30 * 8; i++) a.avancar(1 / 30, -3)
    for (let i = 0; i < 144 * 8; i++) b.avancar(1 / 144, -3)
    expect(a.restanteMm).toBeCloseTo(b.restanteMm, 8)
    expect(a.tempoArcoS).toBeCloseTo(b.tempoArcoS, 8)
    expect(a.volumeMm3).toBeCloseTo(b.volumeMm3, 8)
  })
  it('fim da vareta para o consumo; troca explícita não apaga o depósito', () => {
    const m = abrir()
    // H91: descer no ritmo do consumo (1,5 mm/s na corrente base) gasta a vareta em ~63 s.
    m.avancar(80, -m.consumoMmS)
    expect(m.restanteMm).toBe(VARETA15.reservaMm)
    expect(m.estado).toBe('fim')
    expect(m.trocarVareta()).toBe(false)
    m.soltar()
    const volume = m.volumeMm3
    expect(m.trocarVareta()).toBe(true)
    expect(m.volumeMm3).toBe(volume)
    expect(m.distanciaMm).toBe(10)
  })
  it('soltar desarma: para reiniciar o eletrodo é preciso novo contato', () => {
    const m = abrir()
    m.avancar(0.1)
    m.soltar()
    m.pressionado = true
    m.avancar(0.1)
    expect(m.estado).toBe('pronto')
  })
})
