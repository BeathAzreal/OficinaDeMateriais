import { describe, expect, it } from 'vitest'
import { Acionamento15, VARETA15, velocidadeAltura15, velocidadeDescida15 } from '../src/modelo/acionamento15'

/**
 * H91 (v1.9): sem ajuda na altura, o jogador precisa descer com S enquanto a vareta queima.
 * Soldador simulado a 60 quadros/s: vê a distância com 0,15 s de atraso e só dá toques em S
 * (no máximo 0,3 s cada), como no teclado; avança a 2,5 mm/s com o mouse.
 */
function soldar(opcoes: { corrente?: number; controlar?: boolean; reacaoS?: number } = {}) {
  const dt = 1 / 60, reacao = opcoes.reacaoS ?? 0.15, velocidade = 6
  const m = new Acionamento15('eletrodo')
  m.abrirAoTocar = true
  m.assistencia = 0
  m.compensar = false
  m.regular(opcoes.corrente ?? 90, 2.5)
  m.posicionar(10, 0)
  m.definirDistancia(6)
  m.pressionado = true
  const vistas: number[] = []
  let sentido = 1, desce = 0, segurando = false, quadros = 0, comArco = 0, abriu = false, apagouEm = -1
  for (let t = 0; t < 120 && m.estado !== 'fim'; t += dt) {
    vistas.push(m.distanciaMm)
    const vista = vistas[Math.max(0, vistas.length - 1 - Math.round(reacao / dt))]
    if (!abriu) segurando = true
    else if (opcoes.controlar !== false) {
      if (!segurando && vista > 1.15 * m.diametroMm) segurando = true
      else if (segurando && (vista < 0.75 * m.diametroMm || desce > 0.3)) segurando = false
    } else segurando = false
    desce = segurando ? desce + dt : 0
    // Avança a 2,5 mm/s e, ao chegar a 140 mm, volta (a vareta inteira dá mais que uma peça).
    if (abriu) { if (m.xMm >= 140) sentido = -1; else if (m.xMm <= 10) sentido = 1; m.xMm += sentido * 2.5 * dt }
    m.avancar(dt, -velocidadeDescida15(desce, velocidade, m.consumoMmS, 0, m.cosInclinado, m.estado === 'arco'))
    if (m.estado === 'arco') { abriu = true; comArco++ } else if (abriu && apagouEm < 0) apagouEm = t
    if (abriu) quadros++
    if (m.estado === 'grudado') break
  }
  const f = m.tempoFaixaS, total = f.curto + f.adequado + f.longo
  return { m, fracaoArco: comArco / Math.max(1, quadros), adequado: total ? f.adequado / total : 0, apagouEm }
}

describe('eletrodo sem ajuda na altura (H91)', () => {
  it('a descida com S é só a do jogador: não soma o consumo da vareta', () => {
    for (const s of [0.05, 0.2, 0.6]) expect(velocidadeDescida15(s, 6, 3, 0, 1, true)).toBe(velocidadeAltura15(s, 6))
    expect(VARETA15.consumoMmS).toBe(1.5)
  })

  it('com atenção (toques em S) dá para manter o arco a vareta inteira, sem grudar', () => {
    for (const corrente of [80, 90, 100]) {
      const r = soldar({ corrente })
      expect(r.m.grudadas, `${corrente} A`).toBe(0)
      expect(r.m.estado, `${corrente} A`).toBe('fim')
      expect(r.fracaoArco, `${corrente} A`).toBeGreaterThan(0.9)
      expect(r.adequado, `${corrente} A`).toBeGreaterThan(0.6)
    }
  })

  it('sem descer, a vareta queima, o arco cresce e apaga em poucos segundos', () => {
    const r = soldar({ controlar: false })
    expect(r.apagouEm).toBeGreaterThan(0)
    expect(r.apagouEm).toBeLessThan(4)
  })
})
