import { describe, expect, it } from 'vitest'
import { MODELO } from '../src/modelo/parametros'
import { Simulacao } from '../src/modelo/simulacao'
import { EstimadorVelocidade } from '../src/modelo/velocidade'

type Evento = { tipo: 'inicio' | 'mover' | 'fim'; t: number; x: number; y: number }

/** Leituras de mouse a cada 8 ms: 12 mm/s, pausa de 1,5 s, depois 6 mm/s. */
function gerarEventos(): Evento[] {
  const ev: Evento[] = []
  let t = 1000
  let x = 10
  ev.push({ tipo: 'inicio', t, x, y: 0 })
  while (x < 60) {
    t += 8
    x += 12 * 0.008
    ev.push({ tipo: 'mover', t, x, y: 0 })
  }
  t += 1500
  while (x < 110) {
    t += 8
    x += 6 * 0.008
    ev.push({ tipo: 'mover', t, x, y: 0 })
  }
  ev.push({ tipo: 'fim', t: t + 8, x, y: 0 })
  return ev
}

/** Roda a simulação intercalando quadros na taxa pedida (null = sem quadros). */
function rodar(eventos: Evento[], fps: number | null): Simulacao {
  const sim = new Simulacao()
  let quadro = eventos[0].t
  for (const e of eventos) {
    if (fps) {
      while (quadro < e.t) {
        sim.avancarTempo(quadro)
        quadro += 1000 / fps
      }
    }
    if (e.tipo === 'inicio') sim.iniciarArco(e)
    else if (e.tipo === 'mover') sim.moverTocha(e)
    else sim.encerrarArco(e)
  }
  return sim
}

describe('independência da taxa de quadros', () => {
  it('o cordão é o mesmo com 0, 30, 60 e 144 quadros/s', () => {
    const eventos = gerarEventos()
    const referencia = rodar(eventos, null).cordao.copiaDosVolumes()
    for (const fps of [30, 60, 144]) {
      const v = rodar(eventos, fps).cordao.copiaDosVolumes()
      let maiorDiferenca = 0
      for (let i = 0; i < v.length; i++) maiorDiferenca = Math.max(maiorDiferenca, Math.abs(v[i] - referencia[i]))
      expect(maiorDiferenca).toBeLessThan(1e-9)
    }
  })
})

describe('balanço de massa (H1 + H2)', () => {
  const eventos = gerarEventos()
  const sim = rodar(eventos, 60)
  const tempoArcoS = (eventos[eventos.length - 1].t - eventos[0].t) / 1000

  it('volume total = taxa de deposição × tempo de arco', () => {
    expect(sim.cordao.volumeTotal()).toBeCloseTo(MODELO.taxaDeposicaoMm3s * tempoArcoS, 6)
  })

  it('área da seção ≈ taxa / velocidade de avanço', () => {
    const a12 = sim.cordao.secao(sim.cordao.indiceEm(35)).areaMm2
    const a6 = sim.cordao.secao(sim.cordao.indiceEm(85)).areaMm2
    expect(a12).toBeCloseTo(MODELO.taxaDeposicaoMm3s / 12, 0)
    expect(a6).toBeCloseTo(MODELO.taxaDeposicaoMm3s / 6, 0)
  })

  it('metade da velocidade → largura √2 vezes maior (H3)', () => {
    const w12 = sim.cordao.secao(sim.cordao.indiceEm(35)).larguraMm
    const w6 = sim.cordao.secao(sim.cordao.indiceEm(85)).larguraMm
    expect(w6 / w12).toBeCloseTo(Math.SQRT2, 1)
  })

  it('onde a tocha parou o cordão engrossa', () => {
    const parado = sim.cordao.secao(sim.cordao.indiceEm(60)).larguraMm
    const andando = sim.cordao.secao(sim.cordao.indiceEm(35)).larguraMm
    expect(parado).toBeGreaterThan(2 * andando)
  })
})

describe('estimador de velocidade', () => {
  it('mede a velocidade constante e zera quando a tocha para', () => {
    const est = new EstimadorVelocidade()
    let t = 0
    for (let x = 0; x < 20; x += 12 * 0.008) {
      est.adicionar({ t, x, y: 0 })
      t += 8
    }
    expect(est.medir(t - 8).avancoMms).toBeCloseTo(12, 1)
    expect(est.medir(t + 300).avancoMms).toBe(0)
  })
})
