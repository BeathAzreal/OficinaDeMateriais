import { describe, expect, it } from 'vitest'
import { analisarDefeitos, PENETRACAO } from '../src/modelo/defeitos'
import { analisarFusao } from '../src/modelo/fusao'
import { CONTEXTO_PADRAO, type ContextoProcesso } from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'

/** Passe reto na chapa de 3 mm com os ajustes de referência; quanto mais devagar, mais calor por mm. */
function passe(v: number, ctx: ContextoProcesso = CONTEXTO_PADRAO) {
  const sim = new Simulacao(ctx)
  sim.definirAjustes({ alimentacao: 5, tensao: 5.5 })
  let t = 0, x = 5
  sim.iniciarArco({ t, x, y: 0 })
  while (x < 145) { t += 8; x += (v * 8) / 1000; sim.moverTocha({ t, x, y: 0 }) }
  sim.encerrarArco({ t, x, y: 0 })
  const a = analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: ctx, fusao: analisarFusao(sim.cordao, sim.percurso, ctx) })
  const i = sim.cordao.indiceEm(75)
  const tipos = new Set(a.ocorrencias.filter((o) => o.inicioMm <= 75 && o.fimMm >= 75).map((o) => o.tipo))
  return { pendurado: a.penetracaoMm[i], afundamento: a.afundamento[i], furo: a.furoMm[i], tipos, a }
}

describe('H94: passar da chapa em níveis, até varar', () => {
  it('no ritmo certo não aparece nada no avesso', () => {
    const r = passe(6)
    expect(r.pendurado).toBe(0)
    expect(r.tipos.size).toBe(0)
  })
  it('um pouco devagar: a raiz aparece no avesso, ainda sem defeito', () => {
    const r = passe(4)
    expect(r.pendurado).toBeGreaterThan(0)
    expect(r.pendurado).toBeLessThan(PENETRACAO.limiteAvessoMm)
    expect(r.tipos.size).toBe(0)
  })
  it('mais devagar: o metal passa e pendura no avesso, e a face começa a afundar (sem furo)', () => {
    const r = passe(3)
    expect(r.pendurado).toBeGreaterThan(PENETRACAO.limiteAvessoMm)
    expect(r.furo).toBe(0)
    expect(r.tipos.has('penetracao-excessiva')).toBe(true)
  })
  it('ainda mais devagar: a poça cai pela raiz e a face afunda bastante', () => {
    const r = passe(2.5)
    expect(r.afundamento).toBeGreaterThan(0.5)
    expect(r.furo).toBe(0)
    expect(r.tipos.has('raiz-afundada')).toBe(true)
  })
  it('no limite: a chapa vara e abre um furo', () => {
    const r = passe(2)
    // H101: o buraco nasce pequeno no ponto mais quente e alarga com mais calor (tests/consumoChapa.test.ts).
    expect(r.furo).toBeGreaterThan(0)
    expect(r.tipos.has('furo')).toBe(true)
  })
  it('os níveis crescem juntos: metal no avesso, afundamento e furo nunca diminuem com mais calor', () => {
    const niveis = [6, 4, 3, 2.5, 2].map((v) => passe(v))
    for (let k = 1; k < niveis.length; k++) {
      expect(niveis[k].pendurado).toBeGreaterThanOrEqual(niveis[k - 1].pendurado)
      expect(niveis[k].afundamento).toBeGreaterThanOrEqual(niveis[k - 1].afundamento)
      expect(niveis[k].furo).toBeGreaterThanOrEqual(niveis[k - 1].furo)
    }
  })
  it('no filete não há avesso livre: só o furo conta', () => {
    const r = passe(3, { ...CONTEXTO_PADRAO, junta: 't' })
    expect(r.pendurado).toBe(0)
    expect(r.afundamento).toBe(0)
  })
})
