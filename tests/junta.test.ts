import { describe, expect, it } from 'vitest'
import { gerarDesafio, missaoDoDesafio } from '../src/arcade/desafios'
import { MISSOES } from '../src/missoes/catalogo'
import { FORMATOS, GeometriaJunta, RAIO_MINIMO_MM } from '../src/modelo/junta'
import { TIPOS_JUNTA } from '../src/modelo/juntas'
import { PECA } from '../src/modelo/parametros'
import { CONTEXTO_PADRAO } from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'
import { Vista } from '../src/render/vista'

describe('formato da junta (H41)', () => {
  it('na reta, (s, n) = (X, Y): o modelo das etapas anteriores', () => {
    const g = new GeometriaJunta('reta')
    for (const [X, Y] of [[0, 0], [37.3, -4.2], [150, 12], [80, 0.5]]) {
      const p = g.projetar(X, Y)
      expect(p.x).toBeCloseTo(X, 9)
      expect(p.y).toBeCloseTo(Y, 9)
    }
  })

  for (const f of FORMATOS) {
    it(`${f}: ida e volta (s, n) → chapa → (s, n) perto da junta, e cabe na chapa`, () => {
      const g = new GeometriaJunta(f)
      for (let s = 0; s <= PECA.comprimentoMm; s += 2.5) {
        for (const n of [-RAIO_MINIMO_MM * 0.5, -3, 0, 2, RAIO_MINIMO_MM * 0.5]) {
          const q = g.pontoEm(s, n)
          const r = g.projetar(q.x, q.y)
          // Polilinha a cada 0,25 mm: erro de até 0,2 mm no lado de dentro das curvas.
          expect(Math.abs(r.x - s)).toBeLessThan(0.2)
          expect(Math.abs(r.y - n)).toBeLessThan(0.2)
        }
        const q = g.pontoEm(s)
        expect(q.x).toBeGreaterThanOrEqual(-1e-6)
        expect(q.x).toBeLessThanOrEqual(PECA.comprimentoMm + 1e-6)
        expect(Math.abs(q.y)).toBeLessThanOrEqual(PECA.larguraChapaMm - 5)
      }
    })
  }
})

describe('vista girada (H42)', () => {
  it('sem giro na reta, a conversão é a das etapas 1–7', () => {
    const v = new Vista()
    v.ajustar(900, 400)
    const escala = v.escala
    const p = v.paraPeca(450 + 10 * escala, 200 - 5 * escala)
    expect(p.x).toBeCloseTo(85, 9)
    expect(p.y).toBeCloseTo(-5, 9)
  })

  it('com qualquer giro e formato, tela → junta → tela fecha', () => {
    const v = new Vista()
    v.ajustar(800, 500)
    for (const f of FORMATOS) {
      v.geometria = new GeometriaJunta(f)
      for (const ang of [0, 0.7, Math.PI / 2, 2.5, -1.1]) {
        v.definirAngulo(ang)
        for (const [s, n] of [[10, 0], [75, 3], [140, -6]]) {
          const tela = v.ponto(s, n)
          const r = v.paraPeca(tela.x, tela.y)
          expect(r.x).toBeCloseTo(s, 1)
          expect(r.y).toBeCloseTo(n, 1)
        }
      }
    }
  })

  it('girar não muda o tamanho da peça', () => {
    const v = new Vista()
    v.ajustar(800, 400)
    const tamanho = () => {
      const a = v.ponto(10, 0)
      const b = v.ponto(140, 0)
      return Math.hypot(b.x - a.x, b.y - a.y)
    }
    const t0 = tamanho()
    for (const ang of [0.3, Math.PI / 2, 2, -1]) {
      v.definirAngulo(ang)
      expect(tamanho()).toBeCloseTo(t0, 6)
    }
  })

  it('na junta circular a peça gira em torno do centro do círculo (posicionador)', () => {
    const v = new Vista()
    v.ajustar(800, 500)
    v.geometria = new GeometriaJunta('circular')
    const c = v.geometria.centro!
    const antes = v.daChapa(c.x, c.y)
    v.definirAngulo(1.3)
    const depois = v.daChapa(c.x, c.y)
    expect(depois.x).toBeCloseTo(antes.x, 6)
    expect(depois.y).toBeCloseTo(antes.y, 6)
    // A tocha parada na tela passa a ficar em outro ponto da junta.
    const tela = v.ponto(40, 0)
    v.definirAngulo(1.3 + 0.2)
    expect(v.paraPeca(tela.x, tela.y).x).not.toBeCloseTo(40, 0)
  })

  it('seguir a junta curva na tela dá o mesmo cordão que a reta (o modelo só vê s, n)', () => {
    const passe = (f: (typeof FORMATOS)[number], ang: number) => {
      const v = new Vista()
      v.ajustar(900, 500)
      v.geometria = new GeometriaJunta(f)
      v.definirAngulo(ang)
      const sim = new Simulacao(CONTEXTO_PADRAO)
      let t = 0
      const ler = (s: number) => {
        const tela = v.ponto(s, 0.5)
        return { t, ...v.paraPeca(tela.x, tela.y) }
      }
      sim.iniciarArco(ler(10))
      for (let s = 10; s <= 140; s += 12 * 0.008) {
        t += 8
        sim.moverTocha(ler(s))
      }
      sim.encerrarArco(ler(140))
      return sim.cordao.secao(sim.cordao.indiceEm(75))
    }
    const reta = passe('reta', 0)
    for (const f of FORMATOS) {
      const s = passe(f, 1.2)
      expect(s.larguraMm, f).toBeCloseTo(reta.larguraMm, 1)
      expect(s.yCentroMm, f).toBeCloseTo(reta.yCentroMm, 1)
    }
  })
})

describe('tipos de junta nas missões e no Arcade (H46)', () => {
  it('a História começa no topo reto e cobre os cinco tipos de junta', () => {
    expect(MISSOES[0].geometria.junta).toBe('topo')
    expect(new Set(MISSOES.map((m) => m.geometria.junta)).size).toBe(TIPOS_JUNTA.length)
  })

  it('o Arcade usa a junta e a posição da missão sorteada', () => {
    let semente = 11
    const r = () => (semente = (semente * 16807) % 2147483647) / 2147483647
    const vistos = new Set<string>()
    for (let n = 1; n <= 60; n++) {
      const d = gerarDesafio(n, r)
      const m = missaoDoDesafio(d)
      expect(d.formato).toBeUndefined()
      expect(m).toBe(MISSOES.find((x) => x.id === d.missaoId))
      vistos.add(m.geometria.junta)
    }
    expect(vistos.size).toBe(TIPOS_JUNTA.length)
  })
})

