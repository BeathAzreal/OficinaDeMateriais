import { describe, expect, it } from 'vitest'
import { compactar, descompactar, eventosValidos } from '../src/dados/eventos'
import { Cordao } from '../src/modelo/cordao'
import { analisarFusao } from '../src/modelo/fusao'
import {
  areaChanfroMm2,
  areaParaLargura,
  chapasNaJunta,
  efeitoPosicao,
  gravidade,
  INFO_JUNTA,
  larguraTopoChanfroMm,
  perfilNaJunta,
  pontosDeBaixo,
  posicaoDe,
  secaoNaJunta,
  TIPOS_JUNTA,
  type TipoJunta,
} from '../src/modelo/juntas'
import { CONTEXTO_PADRAO, type ContextoProcesso } from '../src/modelo/processo'
import { reproduzir } from '../src/modelo/replay'
import { Simulacao } from '../src/modelo/simulacao'

const D = { espessuraMm: 6, aberturaMm: 1 }

/** Cordão com volume uniforme numa fatia longa, na forma da junta. */
function cordaoCom(junta: TipoJunta, areaMm2: number, y = 0, d = D) {
  const c = new Cordao(undefined, undefined, undefined, junta === 'topo' ? null : { junta, dimensoes: d })
  for (let x = 20; x <= 130; x += 0.25) c.depositar(x, y, areaMm2 * 0.25, x)
  return c.secao(c.indiceEm(75))
}

describe('seção do cordão em cada junta (H46)', () => {
  it('topo reto sem abertura: a mesma seção de sempre', () => {
    const base = new Cordao()
    const comForma = new Cordao(undefined, undefined, undefined, { junta: 'topo', dimensoes: { ...D, aberturaMm: 0 } })
    for (const c of [base, comForma]) for (let x = 20; x <= 130; x += 0.25) c.depositar(x, 0.3, 3, x)
    const { areaReforcoMm2: _r, enchimento: _e, ...semExtras } = comForma.secao(150)
    expect(semExtras).toEqual(base.secao(150))
  })

  it('topo reto com abertura (v1.3): o metal enche a fresta antes de virar reforço', () => {
    const d = { espessuraMm: 3, aberturaMm: 1 }
    const fresta = d.aberturaMm * d.espessuraMm
    const base = new Cordao()
    const topo = new Cordao(undefined, undefined, undefined, { junta: 'topo', dimensoes: d })
    for (const c of [base, topo]) for (let x = 20; x <= 130; x += 0.25) c.depositar(x, 0, 3, x)
    const b = base.secao(150)
    const t = topo.secao(150)
    // Mesmo metal; o reforço é o que sobra da fresta, com a mesma forma (H3).
    expect(t.areaMm2).toBeCloseTo(b.areaMm2, 9)
    expect(t.areaReforcoMm2!).toBeCloseTo(b.areaMm2 - fresta, 9)
    expect((2 / 3) * t.larguraMm * t.alturaMm).toBeCloseTo(b.areaMm2 - fresta, 6)
    expect(t.alturaMm).toBeLessThan(b.alturaMm)
    expect(t.larguraMm).toBeLessThan(b.larguraMm)
    // Pouco metal: a fresta fica pela metade e a superfície do metal fica abaixo da face.
    const pouco = new Cordao(undefined, undefined, undefined, { junta: 'topo', dimensoes: d })
    for (let x = 20; x <= 130; x += 0.25) pouco.depositar(x, 0, 0.25 * (fresta / 2), x)
    const p = pouco.secao(150)
    expect(p.enchimento!).toBeCloseTo(0.5, 2)
    expect(p.alturaMm).toBeCloseTo(-1.5, 2)
  })

  it('topo reto com abertura: cordão fora da fresta fica sobre a chapa, não dentro dela', () => {
    const d = { espessuraMm: 3, aberturaMm: 1 }
    const base = new Cordao()
    const fora = new Cordao(undefined, undefined, undefined, { junta: 'topo', dimensoes: d })
    // Pouco metal, 6 mm ao lado da fresta: antes ia para "dentro da chapa" (altura negativa).
    for (const c of [base, fora]) for (let x = 20; x <= 130; x += 0.25) c.depositar(x, 6, 0.25, x)
    const b = base.secao(150)
    const f = fora.secao(150)
    expect(f.alturaMm).toBeGreaterThan(0)
    expect(f.alturaMm).toBeCloseTo(b.alturaMm, 9)
    expect(f.larguraMm).toBeCloseTo(b.larguraMm, 9)
    expect(f.yCentroMm).toBeCloseTo(6, 6)
    expect(f.enchimento).toBe(1)
  })

  it('V: o metal enche o chanfro primeiro; só o que sobra vira reforço', () => {
    const Ach = areaChanfroMm2(D)
    const meio = cordaoCom('v', 0.5 * Ach)
    expect(meio.enchimento).toBeCloseTo(0.5, 2)
    expect(meio.alturaMm).toBeLessThan(0) // superfície do metal abaixo do topo das chapas
    expect(meio.larguraMm).toBeLessThan(larguraTopoChanfroMm(D))
    const cheio = cordaoCom('v', 1.4 * Ach)
    expect(cheio.enchimento).toBeCloseTo(1.4, 2)
    expect(cheio.alturaMm).toBeGreaterThan(0)
    // O reforço sempre cobre as bordas do V.
    expect(cheio.larguraMm).toBeGreaterThan(larguraTopoChanfroMm(D))
    expect(cheio.areaReforcoMm2).toBeCloseTo(0.4 * Ach, 1)
  })

  for (const junta of ['t', 'sobreposta', 'canto'] as TipoJunta[]) {
    it(`${junta}: filete de pernas iguais com a tocha na raiz; fora dela, uma perna encolhe`, () => {
      const s = cordaoCom(junta, 12)
      const [z1, z2] = s.pernasMm!
      expect(z1).toBeCloseTo(z2, 6)
      expect(s.larguraMm).toBeCloseTo(Math.hypot(z1, z2), 6)
      const torto = cordaoCom(junta, 12, 2)
      expect(torto.pernasMm![0]).toBeGreaterThan(torto.pernasMm![1])
    })
  }

  it('filete: tensão baixa (razão alta) deixa convexo; alta, plano ou côncavo', () => {
    const base = cordaoCom('topo', 12)
    const convexo = secaoNaJunta(base, 't', D, 0.45)
    const concavo = secaoNaJunta(base, 't', D, 0.18)
    expect(convexo.alturaMm).toBeGreaterThan(0)
    expect(concavo.alturaMm).toBeLessThan(0)
  })

  for (const junta of TIPOS_JUNTA) {
    it(`${junta}: areaParaLargura é o inverso da seção`, () => {
      for (const largura of [6, 8, 10]) {
        const razao = 0.35
        const A = areaParaLargura(junta, D, largura, razao)
        const base = new Cordao(undefined, undefined, undefined, null)
        for (let x = 20; x <= 130; x += 0.25) base.depositar(x, 0, A * 0.25, x, razao)
        const s = secaoNaJunta(base.secao(150), junta, D, razao)
        if (junta === 'v' && largura <= larguraTopoChanfroMm(D) + 1.4) continue
        expect(s.larguraMm).toBeCloseTo(largura, 1)
      }
    })

    it(`${junta}: perfil com ${pontosDeBaixo(junta)} pontos embaixo e chapas no sentido anti-horário`, () => {
      const s = cordaoCom(junta, 1.2 * areaChanfroMm2(D))
      const p = perfilNaJunta(s, junta, D, 16)
      expect(p.topo).toHaveLength(17)
      expect(p.baixo).toHaveLength(pontosDeBaixo(junta))
      for (const chapa of chapasNaJunta(junta, D)) {
        let area = 0
        chapa.forEach(([x0, y0], i) => {
          const [x1, y1] = chapa[(i + 1) % chapa.length]
          area += x0 * y1 - x1 * y0
        })
        expect(area).toBeGreaterThan(0)
      }
    })
  }

  it('estado novo: V aberto é "chanfro não preenchido"; filete torto é "borda"', () => {
    const ctxV: ContextoProcesso = { ...CONTEXTO_PADRAO, junta: 'v', espessuraMm: 6 }
    const sim = new Simulacao(ctxV)
    sim.iniciarArco({ t: 0, x: 10, y: 0 })
    for (let t = 20, x = 10; x < 140; t += 20, x += 0.4) sim.moverTocha({ t, x, y: 0 })
    sim.encerrarArco({ t: 99999, x: 140, y: 0 })
    expect(analisarFusao(sim.cordao, sim.percurso, ctxV).find((p) => p.xMm === 75.25)!.estado).toBe('enchimento')

    const ctxT: ContextoProcesso = { ...CONTEXTO_PADRAO, junta: 't' }
    const torto = new Simulacao(ctxT)
    torto.iniciarArco({ t: 0, x: 10, y: 4 })
    for (let t = 20, x = 10; x < 140; t += 20, x += 0.25) torto.moverTocha({ t, x, y: 4 })
    torto.encerrarArco({ t: 99999, x: 140, y: 4 })
    expect(analisarFusao(torto.cordao, torto.percurso, ctxT).find((p) => p.xMm === 75.25)!.estado).toBe('borda')
  })
})

describe('posição de soldagem (H47)', () => {
  it('gravidade e nome da posição', () => {
    expect(posicaoDe(gravidade({ rolagemGraus: 0, giroGraus: 0 }))).toBe('plana')
    expect(posicaoDe(gravidade({ rolagemGraus: 90, giroGraus: 0 }))).toBe('horizontal')
    expect(posicaoDe(gravidade({ rolagemGraus: 90, giroGraus: 90 }))).toBe('vertical')
    expect(posicaoDe(gravidade({ rolagemGraus: 180, giroGraus: 37 }))).toBe('sobrecabeca')
    // O filete em T chega na horizontal; tombado 45° fica na plana.
    expect(posicaoDe(gravidade({ rolagemGraus: INFO_JUNTA.t.rolagemInicialGraus, giroGraus: 0 }))).toBe('horizontal')
  })

  it('efeitos: plana não muda nada; sobrecabeça convexa e funde menos; subir funde mais que descer', () => {
    expect(efeitoPosicao(gravidade({ rolagemGraus: 0, giroGraus: 0 }), 1)).toEqual({ razao: 1, fusao: 1, desvioMm: 0 })
    const cabeca = efeitoPosicao(gravidade({ rolagemGraus: 180, giroGraus: 0 }), 1)
    expect(cabeca.razao).toBeGreaterThan(1)
    expect(cabeca.fusao).toBeLessThan(1)
    const g = gravidade({ rolagemGraus: 90, giroGraus: 90 })
    // Gravidade ao longo de +s: avançar em −s é subir.
    expect(efeitoPosicao(g, -1).fusao).toBeGreaterThan(efeitoPosicao(g, 1).fusao)
    // Na horizontal o metal escorre para o lado de baixo (+n na tela).
    expect(efeitoPosicao(gravidade({ rolagemGraus: 90, giroGraus: 0 }), 1).desvioMm).toBeGreaterThan(0)
  })

  it('a peça não se mexe com o arco aberto nem presa na estrutura', () => {
    const sim = new Simulacao(CONTEXTO_PADRAO)
    sim.iniciarArco({ t: 0, x: 10, y: 0 })
    expect(sim.definirPosicao({ rolagemGraus: 90, giroGraus: 0 })).toBe(false)
    sim.encerrarArco({ t: 100, x: 12, y: 0 })
    expect(sim.definirPosicao({ rolagemGraus: 90, giroGraus: 0 })).toBe(true)
    const fixa = new Simulacao({ ...CONTEXTO_PADRAO, posicaoFixa: true, posicaoInicial: { rolagemGraus: 90, giroGraus: 90 } })
    expect(fixa.definirPosicao({ rolagemGraus: 0, giroGraus: 0 })).toBe(false)
    expect(fixa.posicao).toEqual({ rolagemGraus: 90, giroGraus: 90 })
  })

  it('a posição entra no registro só ao abrir o arco, e o replay dá o mesmo cordão', () => {
    const ctx: ContextoProcesso = { ...CONTEXTO_PADRAO, junta: 't', posicaoInicial: { rolagemGraus: 45, giroGraus: 0 } }
    const sim = new Simulacao(ctx)
    let t = 1000
    const passe = (x0: number, x1: number) => {
      sim.iniciarArco({ t, x: x0, y: 0 })
      for (let x = x0; x <= x1; x += 0.3) sim.moverTocha({ t: (t += 20), x, y: 0.2 })
      sim.encerrarArco({ t: (t += 20), x: x1, y: 0.2 })
      t += 5000
    }
    passe(10, 70) // como chegou: sem evento de posição
    for (let g = 0; g <= 90; g += 10) sim.definirPosicao({ rolagemGraus: 45 - g / 2, giroGraus: g }) // girando com o arco fechado
    passe(70, 140)
    const posicoes = sim.eventos.filter((e) => e.tipo === 'posicao')
    expect(posicoes).toEqual([{ tipo: 'posicao', rolagemGraus: 0, giroGraus: 90 }])
    const c = compactar(sim.eventos)
    expect(eventosValidos(c)).toBe(true)
    const r = reproduzir(ctx, descompactar(c))
    for (const i of [40, 120, 200, 260]) {
      expect(r.cordao.secao(i).larguraMm).toBeCloseTo(sim.cordao.secao(i).larguraMm, 2)
      expect(r.cordao.secao(i).yCentroMm).toBeCloseTo(sim.cordao.secao(i).yCentroMm, 2)
    }
    expect(r.posicao).toEqual(sim.posicao)
  })

  it('registros antigos (sem posição) continuam válidos e dão a solda plana', () => {
    const antigo = { versao: 1 as const, t0: 0, lista: [['a', 5, 5.5], ['i', 0, 10, 0], ['m', 500, 16, 0], ['f', 520, 16, 0]] as never }
    expect(eventosValidos(antigo)).toBe(true)
    expect(reproduzir(CONTEXTO_PADRAO, descompactar(antigo)).posicao).toEqual({ rolagemGraus: 0, giroGraus: 0 })
  })
})
