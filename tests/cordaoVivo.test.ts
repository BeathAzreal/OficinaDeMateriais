import { describe, expect, it } from 'vitest'
import { Cordao } from '../src/modelo/cordao'
import { FORMATOS, GeometriaJunta } from '../src/modelo/junta'
import { MODELO } from '../src/modelo/parametros'
import { CONTEXTO_PADRAO } from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'
import { janelaDoRegistro, MalhaCordaoViva } from '../src/render/cordaoVivo'
import { malhaCordao } from '../src/render/malha3d'

/** Triângulos como texto, girados para começar no menor vértice (a orientação é mantida). */
function triangulos(pos: Float32Array, idx: ArrayLike<number>, n = idx.length): string[] {
  const v = (k: number) => `${pos[3 * k].toFixed(4)},${pos[3 * k + 1].toFixed(4)},${pos[3 * k + 2].toFixed(4)}`
  const lista: string[] = []
  for (let t = 0; t < n; t += 3) {
    const tri = [v(idx[t]), v(idx[t + 1]), v(idx[t + 2])]
    const m = tri.indexOf([...tri].sort()[0])
    lista.push([tri[m], tri[(m + 1) % 3], tri[(m + 2) % 3]].join(' | '))
  }
  return lista.sort()
}

/** Cordão com dois trechos, um ponto isolado e um trecho em zigue-zague lateral. */
function cordaoDeTeste(): Cordao {
  const c = new Cordao()
  for (let x = 12; x <= 60; x += 0.25) c.depositar(x, 0.3 * Math.sin(x), 1.8, x * 10)
  for (let x = 80; x <= 132; x += 0.25) c.depositar(x, -0.6, 2.4, 1000 + x * 10, 0.3, 0.8, x > 100 ? 0.7 : 0)
  c.depositar(145, 0, 3, 5000)
  return c
}

describe('cordão ao vivo (buffers fixos)', () => {
  for (const f of FORMATOS) {
    it(`${f}: os mesmos triângulos de malhaCordao`, () => {
      const geo = new GeometriaJunta(f)
      const c = cordaoDeTeste()
      const viva = new MalhaCordaoViva(c.nPosicoes, c.passoMm, geo)
      viva.atualizar(c)
      const secoes = Array.from({ length: c.nPosicoes }, (_, i) => c.secao(i))
      const cheia = malhaCordao(secoes, c.passoMm, geo)
      expect(cheia.trechos.length).toBeGreaterThanOrEqual(3)
      expect(viva.nIndices).toBe(cheia.indices.length)
      expect(triangulos(viva.posicoes, viva.indices, viva.nIndices)).toEqual(triangulos(cheia.posicoes, cheia.indices))
    })
  }

  it('atualizando por janelas, quadro a quadro, fica igual a montar do zero', () => {
    const geo = new GeometriaJunta('curva')
    const c = new Cordao()
    const viva = new MalhaCordaoViva(c.nPosicoes, c.passoMm, geo)
    let sAnterior = 20
    for (let x = 20; x <= 120; x += 0.25) {
      c.depositar(x, 0.4 * Math.sin(x / 3), 1.6, x * 12)
      // "Quadro" a cada 2 mm: só a janela em volta da tocha é lida.
      if (Math.abs(x - sAnterior) >= 2) {
        viva.atualizar(c, c.indiceEm(Math.min(sAnterior, x) - 10), c.indiceEm(Math.max(sAnterior, x) + 10))
        sAnterior = x
      }
    }
    viva.atualizar(c, c.indiceEm(sAnterior - 10), c.indiceEm(130))
    const zero = new MalhaCordaoViva(c.nPosicoes, c.passoMm, geo)
    zero.atualizar(c)
    expect(viva.nIndices).toBe(zero.nIndices)
    expect(Array.from(viva.indices.subarray(0, viva.nIndices))).toEqual(Array.from(zero.indices.subarray(0, zero.nIndices)))
    const usados = new Set(viva.indices.subarray(0, viva.nIndices))
    for (const k of usados) {
      for (let e = 0; e < 3; e++) {
        expect(viva.posicoes[3 * k + e]).toBe(zero.posicoes[3 * k + e])
        expect(viva.normais[3 * k + e]).toBeCloseTo(zero.normais[3 * k + e], 6)
      }
    }
  })

  it('janela pelo registro da simulação: quadros perdidos e vaivém não deixam fatia para trás', () => {
    const sim = new Simulacao(CONTEXTO_PADRAO)
    const viva = new MalhaCordaoViva(sim.cordao.nPosicoes, sim.cordao.passoMm, new GeometriaJunta('reta'))
    const margem = 3 * MODELO.sigmaPocaMm + 2
    let lidos = 0
    let t = 1000
    sim.iniciarArco({ t, x: 10, y: 0 })
    // Vai até 90 mm e volta até 40 mm; "quadros" só a cada 37 leituras (muitos perdidos).
    const caminho = [...Array.from({ length: 320 }, (_, k) => 10 + k * 0.25), ...Array.from({ length: 200 }, (_, k) => 90 - k * 0.25)]
    caminho.forEach((x, k) => {
      t += 20
      sim.moverTocha({ t, x, y: 0.2 })
      if (k % 37 === 0) {
        const j = janelaDoRegistro(sim.registro, lidos, margem)
        lidos = sim.registro.length
        if (j) viva.atualizar(sim.cordao, sim.cordao.indiceEm(j.s0), sim.cordao.indiceEm(j.s1))
      }
    })
    sim.encerrarArco({ t: t + 20, x: 40, y: 0.2 })
    const j = janelaDoRegistro(sim.registro, lidos, margem)!
    viva.atualizar(sim.cordao, sim.cordao.indiceEm(j.s0), sim.cordao.indiceEm(j.s1))
    const zero = new MalhaCordaoViva(sim.cordao.nPosicoes, sim.cordao.passoMm, new GeometriaJunta('reta'))
    zero.atualizar(sim.cordao)
    expect(Array.from(viva.posicoes)).toEqual(Array.from(zero.posicoes))
    expect(viva.nIndices).toBe(zero.nIndices)
    expect(janelaDoRegistro([], 0, margem)).toBeNull()
  })

  it('só reescreve o que mudou; índices só quando uma fatia aparece', () => {
    const geo = new GeometriaJunta('reta')
    const c = new Cordao()
    const viva = new MalhaCordaoViva(c.nPosicoes, c.passoMm, geo)
    for (let x = 30; x <= 50; x += 0.25) c.depositar(x, 0, 1.5, x)
    expect(viva.atualizar(c)).toBe(true)
    expect(viva.indicesMudaram).toBe(true)
    // Nada novo: nada a fazer.
    expect(viva.atualizar(c)).toBe(false)
    expect(viva.fimMudado - viva.inicioMudado).toBe(0)
    // Metal no meio do trecho já visível: posições mudam perto de x = 40, índices não.
    c.depositar(40, 0, 1, 100)
    expect(viva.atualizar(c)).toBe(true)
    expect(viva.indicesMudaram).toBe(false)
    const [a, b] = [viva.inicioMudado, viva.fimMudado]
    expect(a).toBeGreaterThanOrEqual(c.indiceEm(40 - 7) * viva.V)
    expect(b).toBeLessThanOrEqual((c.indiceEm(40 + 7) + 1) * viva.V)
  })

  it('normais do domo apontam para cima na crista e têm comprimento 1', () => {
    const geo = new GeometriaJunta('circular')
    const c = cordaoDeTeste()
    const viva = new MalhaCordaoViva(c.nPosicoes, c.passoMm, geo)
    viva.atualizar(c)
    const i = c.indiceEm(100)
    const crista = i * viva.V + viva.M / 2
    expect(viva.normais[3 * crista + 1]).toBeGreaterThan(0.95)
    for (const k of new Set(viva.indices.subarray(0, viva.nIndices))) {
      expect(Math.hypot(viva.normais[3 * k], viva.normais[3 * k + 1], viva.normais[3 * k + 2])).toBeCloseTo(1, 5)
    }
  })
})

describe('cordão ao vivo nas outras juntas (H46)', () => {
  for (const junta of ['v', 't', 'sobreposta', 'canto'] as const) {
    it(`${junta}: por janelas fica igual a montar do zero, e todo índice aponta para um vértice válido`, () => {
      const forma = { junta, dimensoes: { espessuraMm: junta === 'v' ? 6 : 3, aberturaMm: junta === 'v' ? 1 : 0 } }
      const geo = new GeometriaJunta('reta')
      const c = new Cordao(undefined, undefined, undefined, forma)
      const viva = new MalhaCordaoViva(c.nPosicoes, c.passoMm, geo, undefined, forma)
      for (let x = 20; x <= 120; x += 0.25) {
        c.depositar(x, 0.3 * Math.sin(x / 5), x < 70 ? 2 : 6, x * 10)
        if (Math.round(x * 4) % 12 === 0) viva.atualizar(c, c.indiceEm(x - 10), c.indiceEm(x + 10))
      }
      viva.atualizar(c, c.indiceEm(100), c.indiceEm(130))
      const zero = new MalhaCordaoViva(c.nPosicoes, c.passoMm, geo, undefined, forma)
      zero.atualizar(c)
      expect(viva.nIndices).toBe(zero.nIndices)
      expect(Array.from(viva.posicoes)).toEqual(Array.from(zero.posicoes))
      const total = viva.raios.length
      for (let k = 0; k < viva.nIndices; k++) expect(viva.indices[k]).toBeLessThan(total)
      expect(viva.B).toBeGreaterThan(0)
    })
  }
})
