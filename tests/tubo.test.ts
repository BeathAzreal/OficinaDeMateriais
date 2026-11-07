import { describe, expect, it } from 'vitest'
import { analisarDefeitos } from '../src/modelo/defeitos'
import { analisarFusao } from '../src/modelo/fusao'
import { gravidadeTubo, posicaoDe } from '../src/modelo/juntas'
import { PECA } from '../src/modelo/parametros'
import { CONTEXTO_PADRAO, type ContextoProcesso } from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'

const D = PECA.comprimentoMm / Math.PI
const TUBO: ContextoProcesso = { ...CONTEXTO_PADRAO, tubo: { diametroMm: D } }
const topo = PECA.comprimentoMm / 2
const s = (graus: number) => topo + (graus * Math.PI * D) / 360

describe('H103: gravidade em volta da emenda de dois tubos', () => {
  const fixo = { rolagemGraus: 0, giroGraus: 0 }
  it('em cima é plana, no lado é vertical e embaixo é sobrecabeça', () => {
    expect(posicaoDe(gravidadeTubo(fixo, s(0), D, topo))).toBe('plana')
    expect(posicaoDe(gravidadeTubo(fixo, s(90), D, topo))).toBe('vertical')
    expect(posicaoDe(gravidadeTubo(fixo, s(-90), D, topo))).toBe('vertical')
    expect(posicaoDe(gravidadeTubo(fixo, s(180), D, topo))).toBe('sobrecabeca')
  })
  it('no lado, avançando no sentido da volta, o metal desce (t > 0); do outro lado, sobe', () => {
    expect(gravidadeTubo(fixo, s(90), D, topo).t).toBeCloseTo(1, 6)
    expect(gravidadeTubo(fixo, s(-90), D, topo).t).toBeCloseTo(-1, 6)
  })
  it('girar o tubo no próprio eixo leva outro trecho para cima', () => {
    expect(posicaoDe(gravidadeTubo({ rolagemGraus: 0, giroGraus: -90 }, s(90), D, topo))).toBe('plana')
  })
  it('com o eixo do tubo de pé, a solda em volta é horizontal (2G)', () => {
    for (const g of [0, 90, 180, 270]) expect(posicaoDe(gravidadeTubo({ rolagemGraus: 90, giroGraus: 0 }, s(g), D, topo))).toBe('horizontal')
  })
})

/** Um passe de x0 a x1 a v mm/s com o tubo na posição dada. */
function passe(sim: Simulacao, x0: number, x1: number, v: number, t0: number) {
  let t = t0, x = x0
  sim.iniciarArco({ t, x, y: 0 })
  while (x < x1) { t += 8; x += (v * 8) / 1000; sim.moverTocha({ t, x, y: 0 }) }
  sim.encerrarArco({ t, x, y: 0 })
  return t + 3000
}

describe('H103: o efeito da gravidade aparece onde o tubo está', () => {
  const defeitos = (sim: Simulacao) => analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: TUBO, registro: sim.registro, eventos: sim.eventos, fusao: analisarFusao(sim.cordao, sim.percurso, TUBO) })
  const media = (v: Float32Array, a: number, b: number) => { let m = 0; for (let i = Math.round(a / 0.5); i < Math.round(b / 0.5); i++) m = Math.max(m, v[i]); return m }

  it('tubo fixo (5G), volta inteira com a poça grande: gotas embaixo, escorrimento nos lados, nada em cima', () => {
    const sim = new Simulacao(TUBO)
    sim.definirAjustes({ alimentacao: 7, tensao: 6.5 })
    passe(sim, 3, 147, 4, 0)
    const a = defeitos(sim)
    expect(media(a.gotejamento, s(150), s(178))).toBeGreaterThan(0.2)
    expect(Math.max(media(a.rolos, s(70), s(110)), media(a.rolos, s(-110), s(-70)))).toBeGreaterThan(0.2)
    expect(media(a.gotejamento, s(-20), s(20))).toBe(0)
    expect(media(a.rolos, s(-20), s(20))).toBe(0)
  })
  it('girando o tubo a cada 45° para soldar sempre perto do alto (1G): sem gotas nem escorrimento', () => {
    const sim = new Simulacao(TUBO)
    sim.definirAjustes({ alimentacao: 7, tensao: 6.5 })
    let t = 0
    // Oito trechos de 45°: antes de cada um, o tubo gira para trazer o trecho para cima.
    for (let k = 0; k < 8; k++) {
      const a0 = -180 + 45 * k, a1 = a0 + 45
      expect(sim.definirPosicao({ rolagemGraus: 0, giroGraus: -(a0 + 22.5) })).toBe(true)
      t = passe(sim, Math.max(3, s(a0)), Math.min(147, s(a1)), 4, t)
    }
    const a = defeitos(sim)
    expect(Math.max(...a.gotejamento)).toBeLessThan(0.05)
    expect(Math.max(...a.rolos)).toBeLessThan(0.2)
  })
})

describe('H103: desenho do tubo (curvaTubo.ts)', async () => {
  const THREE = await import('three')
  const { acertarTubo, curvarPonto, desdobrarPonto, poseNoTubo } = await import('../src/render/curvaTubo')
  const c = { raio: D / 2, giro: 0.4 }
  it('curvar e desdobrar voltam ao mesmo ponto (x na volta, altura e lado)', () => {
    for (const [x, y, z] of [[0, 0, 0], [30, 1.5, -12], [-70, -2, 40], [74, 3, 5]]) {
      const q = curvarPonto(c, x, y, z)
      const p = desdobrarPonto(c, q.x, q.y, q.z)
      expect(p.x).toBeCloseTo(x, 6)
      expect(p.y).toBeCloseTo(y, 6)
      expect(p.z).toBeCloseTo(z, 6)
    }
  })
  it('a volta inteira tem a circunferência da junta (150 mm)', () => {
    expect(2 * Math.PI * c.raio).toBeCloseTo(PECA.comprimentoMm, 6)
  })
  it('um raio de cima acerta o alto do tubo, e o alto é o ponto x = −giro·R', () => {
    const q = acertarTubo(c, new THREE.Vector3(0, 300, 7), new THREE.Vector3(0, -1, 0))!
    expect(q.y).toBeCloseTo(0, 6)
    const p = desdobrarPonto(c, q.x, q.y, q.z)
    expect(p.x).toBeCloseTo(-c.giro * c.raio, 6)
    expect(p.z).toBeCloseTo(7, 6)
    expect(acertarTubo(c, new THREE.Vector3(100, 300, 0), new THREE.Vector3(0, -1, 0))).toBeNull()
  })
  it('a pose rígida leva o ponto (x, 0, z) ao ponto curvado e o "para cima" à normal do tubo', () => {
    const m = poseNoTubo(c, 20, 3)
    const p = new THREE.Vector3(20, 0, 3).applyMatrix4(m)
    const q = curvarPonto(c, 20, 0, 3)
    expect(p.distanceTo(q)).toBeLessThan(1e-9)
    const cima = new THREE.Vector3(20, 1, 3).applyMatrix4(m).sub(p)
    const normal = curvarPonto(c, 20, 1, 3).sub(q)
    expect(cima.distanceTo(normal)).toBeLessThan(1e-9)
  })
})
