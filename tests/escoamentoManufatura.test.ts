import { describe, expect, it } from 'vitest'
import { CELULA_MM, Deposito, TAU_POCA_S } from '../src/modelo/manufatura/deposicao'

function poca(temperatura: number) {
  const d = new Deposito()
  d.camadaAtual = 1
  d.carimbar(750, 0, 3, 30, 0, 1, 0, temperatura)
  return d
}
const volumeMapa = (d: Deposito) => d.altura.reduce((s, h) => s + h, 0) * CELULA_MM ** 2
function larguraQuadratica(d: Deposito) {
  let soma = 0, momento = 0
  d.altura.forEach((h, k) => { const y = d.y0 + (Math.floor(k / d.nx) + 0.5) * CELULA_MM; soma += h; momento += h * y * y })
  return momento / soma
}
function esfriar(d: Deposito) { for (let n = 1; n <= 160; n++) d.escoar(0.01, n * 0.01) }

describe('H106: metal recente cede lateralmente na parede quente', () => {
  it('redistribui sem criar ou perder metal, com alturas não negativas', () => {
    const d = poca(700), antes = volumeMapa(d), arame = d.volumeTotal
    const largura = larguraQuadratica(d), altura = Math.max(...d.altura)
    esfriar(d)
    expect(volumeMapa(d)).toBeCloseTo(antes, 4)
    expect(d.volumeTotal).toBe(arame)
    expect(larguraQuadratica(d)).toBeGreaterThan(largura)
    expect(Math.max(...d.altura)).toBeLessThanOrEqual(altura)
    expect(d.altura.every(h => h >= 0)).toBe(true)
  })
  it('o interpasse quente cede mais; frio não inventa escorrimento', () => {
    const frio = poca(25), morno = poca(400), quente = poca(700)
    const original = frio.altura.slice()
    esfriar(frio); esfriar(morno); esfriar(quente)
    expect(frio.altura).toEqual(original)
    expect(larguraQuadratica(quente)).toBeGreaterThan(larguraQuadratica(morno))
    expect(larguraQuadratica(morno)).toBeGreaterThan(larguraQuadratica(frio))
  })
  it('a forma atingida fica congelada após a janela de solidificação', () => {
    const d = poca(700)
    esfriar(d)
    const congelado = d.altura.slice(), versao = d.versao
    d.escoar(1, TAU_POCA_S + 20)
    expect(d.altura).toEqual(congelado)
    expect(d.versao).toBe(versao)
  })
  it('não volta a pôr de pé o metal cedido ao depositar no mesmo lugar', () => {
    const d = poca(700), antes = volumeMapa(d)
    d.escoar(0.1, 0.1)
    d.carimbar(750, 0, 3, 1, 0.2, 1, 0, 700)
    expect(volumeMapa(d)).toBeCloseTo(antes + 1, 4)
  })
})
