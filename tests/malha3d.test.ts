import { describe, expect, it } from 'vitest'
import { Cordao, type SecaoLocal } from '../src/modelo/cordao'
import { FORMATOS, GeometriaJunta } from '../src/modelo/junta'
import { PECA } from '../src/modelo/parametros'
import { contornoFresta, DIVISOES_PERFIL, LARGURA_MINIMA_3D_MM, malhaCordao, paraMundo, perfilSecao } from '../src/render/malha3d'

const secao = (larguraMm: number, alturaMm: number, yCentroMm = 0): SecaoLocal => ({
  xMm: 0,
  areaMm2: (2 / 3) * larguraMm * alturaMm,
  larguraMm,
  alturaMm,
  razaoAlturaLargura: larguraMm > 0 ? alturaMm / larguraMm : 0,
  yCentroMm,
  espalhamentoMm: 0,
  larguraSemOscilacaoMm: larguraMm,
  instabilidade: 0,
  tUltimoDepositoMs: 0,
})

describe('vista 3D: seção → vértices (H3)', () => {
  it('o perfil é o domo de corte.ts: zero nas bordas, altura no centro, área (2/3)·w·h', () => {
    const s = secao(8, 2.8, 0.6)
    const p = perfilSecao(s, 400)
    expect(p[0].u).toBeCloseTo(0.6 - 4, 9)
    expect(p[p.length - 1].u).toBeCloseTo(0.6 + 4, 9)
    expect(p[0].z).toBeCloseTo(0, 9)
    expect(p[p.length - 1].z).toBeCloseTo(0, 9)
    expect(p[200].z).toBeCloseTo(2.8, 9)
    let area = 0
    for (let k = 0; k + 1 < p.length; k++) area += ((p[k].z + p[k + 1].z) / 2) * (p[k + 1].u - p[k].u)
    expect(area).toBeCloseTo(s.areaMm2, 3)
  })

  it('na reta, cada vértice do domo fica em x = s − 75, z = u, y = altura; a face de cima aponta para cima', () => {
    const geo = new GeometriaJunta('reta')
    const secoes = [secao(0, 0), secao(6, 2), secao(6, 2), secao(0, 0)]
    const m = malhaCordao(secoes, 0.5, geo)
    expect(m.trechos).toEqual([[1, 2]])
    // Fatias: ponta (s = 0,5), centros (0,75 e 1,25), ponta (s = 1,5).
    const M = DIVISOES_PERFIL
    const v = (k: number) => [m.posicoes[3 * k], m.posicoes[3 * k + 1], m.posicoes[3 * k + 2]]
    expect(v(0)[0]).toBeCloseTo(0.5 - PECA.comprimentoMm / 2, 6)
    expect(v(M + 1)[0]).toBeCloseTo(0.75 - PECA.comprimentoMm / 2, 6)
    expect(v(3 * (M + 1) + M)[0]).toBeCloseTo(1.5 - PECA.comprimentoMm / 2, 6)
    expect(v(M / 2)[1]).toBeCloseTo(2, 6) // crista
    expect(v(M / 2)[2]).toBeCloseTo(0, 6)
    expect(v(0)[2]).toBeCloseTo(-3, 6) // borda: u = −w/2
    expect(v(0)[1]).toBeCloseTo(0, 6)
    // Primeiro triângulo do domo: normal com y > 0.
    const [a, b, c] = [m.indices[0], m.indices[1], m.indices[2]].map(v)
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    expect(ab[2] * ac[0] - ab[0] * ac[2]).toBeGreaterThan(0)
    // Todos os índices apontam para vértices existentes.
    expect(Math.max(...m.indices)).toBeLessThan(m.raios.length)
  })

  it(`fatias com largura < ${LARGURA_MINIMA_3D_MM} mm não aparecem e separam os trechos`, () => {
    const geo = new GeometriaJunta('reta')
    const secoes = [secao(5, 1.5), secao(0.29, 0.1), secao(5, 1.5), secao(5, 1.5), secao(0.1, 0.03)]
    const m = malhaCordao(secoes, 0.5, geo)
    expect(m.trechos).toEqual([[0, 0], [2, 3]])
    expect(malhaCordao([secao(0.2, 0.05)], 0.5, geo).indices.length).toBe(0)
  })

  for (const f of FORMATOS) {
    it(`${f}: um cordão real da simulação vira malha sobre a linha da junta`, () => {
      const geo = new GeometriaJunta(f)
      const cordao = new Cordao()
      for (let x = 20; x <= 130; x += 0.25) cordao.depositar(x, 0, 2, x * 10)
      const secoes = Array.from({ length: cordao.nPosicoes }, (_, i) => cordao.secao(i))
      const m = malhaCordao(secoes, cordao.passoMm, geo)
      expect(m.trechos.length).toBe(1)
      // A crista de cada fatia (vértice do meio) está em cima da junta.
      const [i0] = m.trechos[0]
      const M = DIVISOES_PERFIL
      for (const j of [1, 50, 120]) {
        const k = j * (M + 1) + M / 2
        const s = (i0 + j - 0.5) * cordao.passoMm
        const p = geo.pontoEm(s, secoes[i0 + j - 1].yCentroMm)
        const [x, , z] = paraMundo(p.x, p.y, 0)
        expect(m.posicoes[3 * k]).toBeCloseTo(x, 4)
        expect(m.posicoes[3 * k + 2]).toBeCloseTo(z, 4)
        expect(m.posicoes[3 * k + 1]).toBeCloseTo(secoes[i0 + j - 1].alturaMm, 4)
      }
    })
  }

  it('o contorno da fresta tem a largura da abertura', () => {
    const geo = new GeometriaJunta('curva')
    const c = contornoFresta(geo, 1)
    const meio = c.length / 2
    for (const k of [0, 37, 150, meio - 1]) {
      const a = c[k]
      const b = c[c.length - 1 - k]
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(1, 6)
    }
  })
})
