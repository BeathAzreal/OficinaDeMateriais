import { describe, expect, it } from 'vitest'
import { analisarDefeitos } from '../src/modelo/defeitos'
import { analisarFusao } from '../src/modelo/fusao'
import { MODELO } from '../src/modelo/parametros'
import { CONTEXTO_PADRAO, fatorFormaAlimentacao, razaoAlturaLargura, razaoPelaTensao, type Ajustes } from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'

/** Passe reto na chapa de 3 mm, a v mm/s, lendo a tocha a cada dtMs. */
function passe(ajustes: Ajustes, v: number, dtMs = 8, comRegistro = true) {
  const ctx = CONTEXTO_PADRAO
  const sim = new Simulacao(ctx)
  sim.definirAjustes(ajustes)
  let t = 0, x = 5
  sim.iniciarArco({ t, x, y: 0 })
  while (x < 145) { t += dtMs; x += (v * dtMs) / 1000; sim.moverTocha({ t, x, y: 0 }) }
  sim.encerrarArco({ t, x, y: 0 })
  const a = analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: ctx, registro: comRegistro ? sim.registro : undefined, fusao: analisarFusao(sim.cordao, sim.percurso, ctx) })
  const i = sim.cordao.indiceEm(75)
  return { humping: a.humping[i], tipos: new Set(a.ocorrencias.map((o) => o.tipo)), secao: sim.cordao.secao(i) }
}

describe('H98: mais arame, cordão mais achatado (direção da Tab. 3 de Banaee et al. 2023)', () => {
  it('na alimentação de referência nada muda', () => {
    expect(fatorFormaAlimentacao({ alimentacao: 5, tensao: 5.5 })).toBe(1)
    expect(razaoAlturaLargura({ alimentacao: 5, tensao: 5.5 })).toBeCloseTo(MODELO.razaoAlturaLargura, 9)
  })
  it('a razão altura/largura cai com a alimentação, dentro dos limites do jogo', () => {
    const r = [1, 3, 5, 7, 10].map((alimentacao) => razaoAlturaLargura({ alimentacao, tensao: 5.5 }))
    for (let k = 1; k < r.length; k++) expect(r[k]).toBeLessThanOrEqual(r[k - 1])
    expect(r[r.length - 1]).toBeLessThan(r[2])
    for (const alimentacao of [0, 1, 10]) {
      const f = fatorFormaAlimentacao({ alimentacao, tensao: 5.5 })
      expect(f).toBeGreaterThanOrEqual(MODELO.formaAlimentacaoMin)
      expect(f).toBeLessThanOrEqual(MODELO.formaAlimentacaoMax)
    }
  })
  it('a tensão continua mandando sozinha na parte dela', () => {
    expect(razaoPelaTensao({ alimentacao: 9, tensao: 5.5 })).toBe(razaoPelaTensao({ alimentacao: 2, tensao: 5.5 }))
  })
  it('o cordão simulado com mais arame sai mais baixo para a largura', () => {
    // Mesma área por mm: o dobro de arame andando no dobro da velocidade.
    const pouco = passe({ alimentacao: 4, tensao: 5.5 }, 5).secao
    const muito = passe({ alimentacao: 8, tensao: 5.5 }, 10).secao
    expect(muito.alturaMm / muito.larguraMm).toBeLessThan(pouco.alturaMm / pouco.larguraMm)
  })
})

describe('H98: humping (corcovas) com avanço rápido e corrente alta', () => {
  it('corrente de referência andando rápido: sem corcovas', () => {
    const r = passe({ alimentacao: 5, tensao: 5.5 }, 15)
    expect(r.humping).toBe(0)
    expect(r.tipos.has('humping')).toBe(false)
  })
  it('corrente alta no ritmo certo: sem corcovas', () => {
    expect(passe({ alimentacao: 9, tensao: 7.5 }, 9).humping).toBe(0)
  })
  it('corrente alta andando rápido: corcovas e o defeito', () => {
    const r = passe({ alimentacao: 9, tensao: 7.5 }, 15)
    expect(r.humping).toBeGreaterThan(0.5)
    expect(r.tipos.has('humping')).toBe(true)
  })
  it('sem o registro dos ajustes não há como saber a corrente: sem corcovas', () => {
    expect(passe({ alimentacao: 9, tensao: 7.5 }, 15, 8, false).humping).toBe(0)
  })
  it('independe da taxa de quadros', () => {
    const a = passe({ alimentacao: 9, tensao: 7.5 }, 13, 1000 / 144).humping
    const b = passe({ alimentacao: 9, tensao: 7.5 }, 13, 1000 / 30).humping
    expect(Math.abs(a - b)).toBeLessThan(0.1)
  })
})
