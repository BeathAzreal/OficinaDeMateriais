import { describe, expect, it } from 'vitest'
import { avaliar, classificarAlinhamento, classificarRegularidade } from '../src/modelo/avaliacao'
import { Cordao } from '../src/modelo/cordao'
import { Simulacao } from '../src/modelo/simulacao'

/**
 * Faz um passe de x0 a x1 com leituras a cada 8 ms.
 * `velocidade(x)` e `lateral(x)` descrevem o movimento da mão.
 */
function passe(
  sim: Simulacao,
  x0: number,
  x1: number,
  velocidade: (x: number) => number = () => 6, // v1.8 (H87): metade da velocidade de antes
  lateral: (x: number) => number = () => 0,
  t0 = 0,
): number {
  let t = t0
  let x = x0
  sim.iniciarArco({ t, x, y: lateral(x) })
  while (x < x1) {
    t += 8
    x += velocidade(x) * 0.008
    sim.moverTocha({ t, x, y: lateral(x) })
  }
  sim.encerrarArco({ t, x, y: lateral(x) })
  return t
}

describe('avaliação geométrica (H13–H17)', () => {
  it('passe constante no alvo: muito regular, centrado, sem interrupções', () => {
    const sim = new Simulacao()
    passe(sim, 10, 140)
    const m = sim.finalizar()!.avaliacao.medidas!
    expect(m.regularidade).toBe('muito regular')
    expect(m.alinhamento).toBe('centrado')
    expect(m.interrupcoes.quantidade).toBe(0)
    expect(m.fracaoNoAlvo).toBeGreaterThan(0.99)
    expect(m.largura.media).toBeCloseTo(7.07, 1)
  })

  it('a região avaliada desconta 5 mm de cada ponta (H14)', () => {
    const sim = new Simulacao()
    passe(sim, 20, 120)
    const { regiao } = sim.finalizar()!.avaliacao.medidas!
    expect(regiao.inicioMm).toBeGreaterThan(20)
    expect(regiao.fimMm).toBeLessThan(120)
    expect(regiao.fimMm - regiao.inicioMm).toBeGreaterThan(85)
  })

  it('velocidade oscilando → irregular', () => {
    const sim = new Simulacao()
    passe(sim, 10, 140, (x) => (Math.floor(x / 10) % 2 === 0 ? 3 : 9))
    const m = sim.finalizar()!.avaliacao.medidas!
    expect(m.regularidade).toBe('irregular')
    expect(m.fracaoNoAlvo).toBeLessThan(0.8)
  })

  it('tocha fora da junta → deslocado e linha da junta descoberta', () => {
    const sim = new Simulacao()
    passe(sim, 10, 140, () => 6, () => 5)
    const a = sim.finalizar()!.avaliacao
    expect(a.medidas!.alinhamento).toBe('deslocado')
    expect(a.medidas!.desvioCentro.medioAbsMm).toBeCloseTo(5, 1)
    expect(a.fracaoLinhaCoberta).toBeLessThan(0.05)
  })

  it('cordão interrompido conta uma interrupção', () => {
    const sim = new Simulacao()
    const t = passe(sim, 10, 60)
    passe(sim, 80, 140, () => 6, () => 0, t + 500)
    const tentativa = sim.finalizar()!
    expect(tentativa.avaliacao.medidas!.interrupcoes.quantidade).toBe(1)
    expect(tentativa.aberturasDeArco).toBe(2)
  })

  it('sem cordão suficiente → nada a medir', () => {
    expect(avaliar(new Cordao()).medidas).toBeNull()
    const sim = new Simulacao()
    passe(sim, 10, 18)
    expect(sim.finalizar()!.avaliacao.medidas).toBeNull()
  })

  it('faixas de classificação do jogo', () => {
    expect(classificarRegularidade(0.03)).toBe('muito regular')
    expect(classificarRegularidade(0.1)).toBe('regular')
    expect(classificarRegularidade(0.2)).toBe('irregular')
    expect(classificarAlinhamento(0.5)).toBe('centrado')
    expect(classificarAlinhamento(2)).toBe('levemente deslocado')
    expect(classificarAlinhamento(3)).toBe('deslocado')
  })
})

describe('encerramento da tentativa (H19)', () => {
  it('não avalia com o arco aberto', () => {
    const sim = new Simulacao()
    sim.iniciarArco({ t: 0, x: 10, y: 0 })
    expect(sim.finalizar()).toBeNull()
  })

  it('depois de avaliada não aceita mais solda; reiniciar libera', () => {
    const sim = new Simulacao()
    const t = passe(sim, 10, 60)
    sim.finalizar()
    const volume = sim.cordao.volumeTotal()
    passe(sim, 70, 100, () => 6, () => 0, t + 100)
    expect(sim.cordao.volumeTotal()).toBe(volume)
    expect(sim.arcoAberto).toBe(false)
    sim.reiniciar()
    expect(sim.tentativaEncerrada).toBe(false)
    passe(sim, 70, 100, () => 6, () => 0, t + 5000)
    expect(sim.cordao.volumeTotal()).toBeGreaterThan(0)
  })

  it('registra os ajustes usados em cada trecho', () => {
    const sim = new Simulacao()
    const t = passe(sim, 10, 60)
    sim.definirAjustes({ alimentacao: 8, tensao: 8 })
    passe(sim, 60, 120, () => 6, () => 0, t + 100)
    expect(sim.finalizar()!.ajustesUsados).toEqual([
      { alimentacao: 5, tensao: 5.5 },
      { alimentacao: 8, tensao: 8 },
    ])
  })
})
