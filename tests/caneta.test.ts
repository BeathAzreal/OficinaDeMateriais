import { describe, expect, it } from 'vitest'
import { FontePonteiro, OPCOES_CANETA_PADRAO } from '../src/entrada/ponteiro'
import { Simulacao } from '../src/modelo/simulacao'

/** Elemento falso: guarda os ouvintes e permite disparar eventos de ponteiro. */
class AlvoFalso {
  private ouvintes = new Map<string, ((e: unknown) => void)[]>()
  addEventListener(tipo: string, f: (e: unknown) => void) {
    this.ouvintes.set(tipo, [...(this.ouvintes.get(tipo) ?? []), f])
  }
  removeEventListener() {}
  setPointerCapture() {}
  getBoundingClientRect() {
    return { left: 0, top: 0 }
  }
  disparar(type: string, e: { pointerType: string; buttons: number; pressure: number; x: number; t: number }) {
    const evento = { type, pointerType: e.pointerType, buttons: e.buttons, pressure: e.pressure, clientX: e.x, clientY: 0, timeStamp: e.t, tiltX: 0, tiltY: 0, preventDefault() {} }
    for (const f of this.ouvintes.get(type) ?? []) f(evento)
  }
}

const mapa = { paraPeca: (px: number, py: number) => ({ x: px, y: py }) }

/** Passa por cima (hover), encosta, arrasta 40 mm e levanta. */
function passe(tipoHover: string, tipoContato: string, pressaoContato: number, dispositivo: 'mouse' | 'caneta' = 'caneta') {
  const alvo = new AlvoFalso()
  const fonte = new FontePonteiro(dispositivo, alvo as unknown as HTMLElement, mapa, OPCOES_CANETA_PADRAO)
  const sim = new Simulacao()
  fonte.ligar(sim)
  let t = 0
  alvo.disparar('pointermove', { pointerType: tipoHover, buttons: 0, pressure: 0, x: 10, t })
  const abertoNoHover = sim.arcoAberto
  alvo.disparar('pointerdown', { pointerType: tipoContato, buttons: 1, pressure: pressaoContato, x: 10, t: (t += 8) })
  for (let x = 10; x <= 50; x += 0.1) alvo.disparar('pointermove', { pointerType: tipoContato, buttons: 1, pressure: pressaoContato, x, t: (t += 8) })
  const abertoNoContato = sim.arcoAberto
  alvo.disparar('pointerup', { pointerType: tipoContato, buttons: 0, pressure: 0, x: 50, t: (t += 8) })
  return { abertoNoHover, abertoNoContato, fechou: !sim.arcoAberto, volume: sim.cordao.volumeTotal(), ultimo: fonte.ultimoEvento }
}

describe('caneta: contato abre o arco com qualquer driver', () => {
  it('caneta pura (Windows Ink): passar por cima não solda; encostar solda', () => {
    const r = passe('pen', 'pen', 0.4)
    expect(r.abertoNoHover).toBe(false)
    expect(r.abertoNoContato).toBe(true)
    expect(r.fechou).toBe(true)
    expect(r.volume).toBeGreaterThan(0)
  })

  it('driver que manda o toque como mouse', () => {
    const r = passe('pen', 'mouse', 0.5)
    expect(r.abertoNoContato).toBe(true)
    expect(r.volume).toBeGreaterThan(0)
  })

  it('driver que manda o toque como toque', () => {
    const r = passe('pen', 'touch', 0.5)
    expect(r.abertoNoContato).toBe(true)
  })

  it('registra o último evento para diagnóstico', () => {
    expect(passe('pen', 'pen', 0.4).ultimo).toContain('pointerup · pen')
  })
})

describe('MIG/MAG: caneta com a seleção Mouse', () => {
  it('Windows Ink move, solda no contato e fecha ao levantar', () => {
    const r = passe('pen', 'pen', 0.4, 'mouse')
    expect(r.abertoNoHover).toBe(false)
    expect(r.abertoNoContato).toBe(true)
    expect(r.fechou).toBe(true)
    expect(r.volume).toBeGreaterThan(0)
  })
  it('preserva o mouse e os drivers que emulam mouse', () => {
    const r = passe('mouse', 'mouse', 0.5, 'mouse')
    expect(r.abertoNoHover).toBe(false)
    expect(r.abertoNoContato).toBe(true)
    expect(r.fechou).toBe(true)
    expect(r.volume).toBeGreaterThan(0)
  })
})
