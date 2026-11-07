import { describe, expect, it } from 'vitest'
import { Deposito, CELULA_MM } from '../src/modelo/manufatura/deposicao'
import { malhaCamadas, salienciaCamada } from '../src/render/malhaCamadasManufatura'

function parede() {
  const d = new Deposito()
  for (let j = 0; j < d.ny; j++) for (let i = 0; i < d.nx; i++) {
    const x = d.x0 + (i + 0.5) * CELULA_MM, y = d.y0 + (j + 0.5) * CELULA_MM
    if (x >= 745 && x <= 755 && Math.abs(y) <= 0.25) { const k = j * d.nx + i; d.altura[k] = 12; d.camada[k] = 8 }
  }
  return d
}

describe('camadas geométricas da manufatura', () => {
  it('gera saliências fora da lateral plana, com vértices entre as camadas', () => {
    const d = parede(), m = malhaCamadas(d)
    let saliente = false
    for (let k = 0; k < m.alturas.length; k++) {
      const h = m.alturas[k], x = m.posicoes[k * 3] * 100, y = Math.abs(m.posicoes[k * 3 + 2] * 100)
      if (x > 747 && x < 753 && h > 3 && h < 8 && y > 0.75 - h / 24 + 0.04) saliente = true
    }
    expect(saliente).toBe(true)
    expect(m.indices.length).toBeGreaterThan(0)
    expect(m.posicoes.every(Number.isFinite)).toBe(true)
    expect(m.posicoes.every((v, i) => i % 3 !== 1 || v >= 0)).toBe(true)
    expect(m.indices.every(i => i < m.camadas.length)).toBe(true)
    expect(m.camadas.length).toBeLessThan(500000)
  })
  it('varia o tamanho por passe e fecha os sulcos entre passes', () => {
    expect(salienciaCamada(0.5, 750, 0)).not.toBeCloseTo(salienciaCamada(3.5, 750, 0), 2)
    expect(salienciaCamada(4, 750, 0)).toBe(0)
  })
  it('é determinística e preserva o depósito medido', () => {
    const d = parede(), alturas = d.altura.slice(), camadas = d.camada.slice(), versao = d.versao
    const a = malhaCamadas(d), b = malhaCamadas(d)
    expect(b.posicoes).toEqual(a.posicoes)
    expect(d.altura).toEqual(alturas)
    expect(d.camada).toEqual(camadas)
    expect(d.versao).toBe(versao)
    expect(d.volumeTotal).toBe(0)
  })
  it('não cria relevo nem triângulos no substrato vazio', () => {
    const m = malhaCamadas(new Deposito())
    expect(m.indices.length).toBe(0)
    expect(m.posicoes.length).toBe(0)
  })
})
