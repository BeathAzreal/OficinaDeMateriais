import { describe, expect, it } from 'vitest'
import {
  aplicarZonaMorta,
  CONFIG_CONTROLE_PADRAO,
  descreverControle,
  FonteControle,
  VELOCIDADE_MAXIMA_MMS,
  type LeituraGamepad,
} from '../src/entrada/controle'
import { Simulacao } from '../src/modelo/simulacao'

/** Controle falso: o roteiro diz o estado do analógico e do gatilho em cada instante. */
function controleFalso(roteiro: (t: number) => { x: number; gatilho: boolean }, relogio: { t: number }) {
  let conectado = true
  const ler = (): (LeituraGamepad | null)[] => {
    if (!conectado) return [null]
    const s = roteiro(relogio.t)
    const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: i === 7 && s.gatilho, value: i === 7 && s.gatilho ? 1 : 0 }))
    return [{ id: 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c)', index: 0, connected: true, mapping: 'standard', axes: [s.x, 0, 0, 0], buttons }]
  }
  return { ler, desconectar: () => (conectado = false) }
}

/** Roda 6 s de solda com o controle, consultando na taxa de quadros pedida. */
function soldarComControle(fps: number) {
  const relogio = { t: 1000 }
  // Gatilho dos 2,0 aos 7,0 s do relógio; analógico a 60 % para a direita.
  const { ler } = controleFalso((t) => ({ x: 0.6, gatilho: t >= 2000 && t < 7000 }), relogio)
  const fonte = new FonteControle(0, CONFIG_CONTROLE_PADRAO, { x: 5, y: 0 }, ler)
  const sim = new Simulacao()
  fonte.ligar(sim)
  // Os instantes de troca do gatilho caem em múltiplos de quadro nas duas taxas usadas.
  for (; relogio.t <= 8000; relogio.t += 1000 / fps) {
    fonte.atualizar(relogio.t)
    sim.avancarTempo(relogio.t)
  }
  return sim
}

describe('controle (Gamepad API)', () => {
  it('zona morta e curva: centro parado, fim de curso = 1', () => {
    expect(aplicarZonaMorta(0.1, 0.05, 0.15)).toEqual({ x: 0, y: 0 })
    const fim = aplicarZonaMorta(1, 0, 0.15)
    expect(fim.x).toBeCloseTo(1, 9)
    const meio = aplicarZonaMorta(0.575, 0, 0.15)
    expect(meio.x).toBeCloseTo(0.25, 6)
  })

  it('a trajetória e o cordão não dependem da taxa de quadros', () => {
    const a = soldarComControle(25)
    const b = soldarComControle(125)
    const va = a.cordao.copiaDosVolumes()
    const vb = b.cordao.copiaDosVolumes()
    let maior = 0
    for (let i = 0; i < va.length; i++) maior = Math.max(maior, Math.abs(va[i] - vb[i]))
    expect(maior).toBeLessThan(1e-6)
    expect(a.cordao.volumeTotal()).toBeGreaterThan(0)
  })

  it('velocidade da tocha = curva(analógico) × velocidade máxima × sensibilidade', () => {
    const relogio = { t: 0 }
    const { ler } = controleFalso(() => ({ x: 1, gatilho: false }), relogio)
    const fonte = new FonteControle(0, { ...CONFIG_CONTROLE_PADRAO, sensibilidade: 0.5 }, { x: 0, y: 0 }, ler)
    fonte.atualizar(0)
    relogio.t = 1000
    fonte.atualizar(1000)
    expect(fonte.posicao.x).toBeCloseTo(VELOCIDADE_MAXIMA_MMS * 0.5, 6)
  })

  it('desconexão fecha o arco e avisa para pausar', () => {
    const relogio = { t: 0 }
    const c = controleFalso(() => ({ x: 0.5, gatilho: true }), relogio)
    const fonte = new FonteControle(0, CONFIG_CONTROLE_PADRAO, { x: 20, y: 0 }, c.ler)
    const sim = new Simulacao()
    fonte.ligar(sim)
    let avisos = 0
    fonte.aoDesconectar = () => avisos++
    for (; relogio.t < 500; relogio.t += 16) fonte.atualizar(relogio.t)
    expect(sim.arcoAberto).toBe(true)
    c.desconectar()
    fonte.atualizar(relogio.t)
    expect(sim.arcoAberto).toBe(false)
    expect(fonte.conectado).toBe(false)
    expect(avisos).toBe(1)
  })

  it('reconhece o mapeamento padrão e sugere (sem prometer) um DualShock 4', () => {
    const d = descreverControle({ id: 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)', index: 0, connected: true, mapping: 'standard', axes: [], buttons: [] })
    expect(d.padrao).toBe(true)
    expect(d.pareceDualShock4).toBe(true)
    expect(descreverControle({ id: 'Genérico', index: 0, connected: true, mapping: '', axes: [], buttons: [] }).padrao).toBe(false)
  })
})

describe('controle em outra posição da lista e gatilho alternativo', () => {
  it('usa o controle conectado mesmo se o navegador o puser no índice 2', () => {
    const botoes = (i: number) => Array.from({ length: 17 }, (_, k) => ({ pressed: k === i, value: k === i ? 1 : 0 }))
    let pressionado = -1
    const ler = (): (LeituraGamepad | null)[] => [null, null, { id: 'Wireless Controller', index: 2, connected: true, mapping: 'standard', axes: [1, 0], buttons: botoes(pressionado) }]
    const fonte = new FonteControle(0, CONFIG_CONTROLE_PADRAO, { x: 10, y: 0 }, ler)
    const sim = new Simulacao()
    fonte.ligar(sim)
    fonte.atualizar(0)
    expect(fonte.conectado).toBe(true)
    expect(fonte.indiceEmUso).toBe(2)
    pressionado = 0 // X / Cross: gatilho alternativo padrão
    fonte.atualizar(100)
    expect(sim.arcoAberto).toBe(true)
    pressionado = -1
    fonte.atualizar(500)
    expect(sim.arcoAberto).toBe(false)
    expect(fonte.posicao.x).toBeGreaterThan(10)
  })

  it('gatilho analógico que só informa o valor também abre o arco', () => {
    const ler = (): (LeituraGamepad | null)[] => [{ id: 'x', index: 0, connected: true, mapping: '', axes: [0, 0], buttons: Array.from({ length: 17 }, (_, k) => ({ pressed: false, value: k === 7 ? 0.9 : 0 })) }]
    const fonte = new FonteControle(0, CONFIG_CONTROLE_PADRAO, { x: 10, y: 0 }, ler)
    const sim = new Simulacao()
    fonte.ligar(sim)
    fonte.atualizar(0)
    expect(sim.arcoAberto).toBe(true)
  })
})
