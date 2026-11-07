import { describe, expect, it } from 'vitest'
import { analisarDefeitos } from '../src/modelo/defeitos'
import { analisarFusao } from '../src/modelo/fusao'
import {
  alimentacaoMMin, botaoDaAlimentacao, botaoDaTensao, CONTEXTO_PADRAO, correnteA, equilibrioArco, modoTransferencia, tensaoV, textoAlimentacao, textoTensao,
  type Ajustes, type ContextoProcesso,
} from '../src/modelo/processo'
import { Simulacao } from '../src/modelo/simulacao'

/** Ajustes pelos números do painel (m/min e V). */
const painel = (mMin: number, v: number): Ajustes => ({ alimentacao: botaoDaAlimentacao(mMin), tensao: botaoDaTensao(v) })

function passe(a: Ajustes, ctx: ContextoProcesso = CONTEXTO_PADRAO, v = 6): Simulacao {
  const sim = new Simulacao(ctx)
  sim.definirAjustes(a)
  let t = 0, x = 5
  sim.iniciarArco({ t, x, y: 0 })
  while (x < 145) { t += 8; x += (v * 8) / 1000; sim.moverTocha({ t, x, y: 0 }) }
  sim.encerrarArco({ t, x, y: 0 })
  return sim
}
const fusaoMedia = (sim: Simulacao, ctx: ContextoProcesso = CONTEXTO_PADRAO) => {
  const f = analisarFusao(sim.cordao, sim.percurso, ctx).filter((p) => p.xMm > 20 && p.xMm < 130)
  return f.reduce((s, p) => s + p.indice, 0) / f.length
}
const respingos = (sim: Simulacao) => analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: CONTEXTO_PADRAO }).respingos.length

describe('H93: máquina MIG em unidades reais', () => {
  it('o painel vai de 14 a 30 V e de 1 a 15 m/min; a referência é 22 V, 7,2 m/min e ~170 A', () => {
    expect(tensaoV(1)).toBe(14)
    expect(tensaoV(10)).toBe(30)
    expect(alimentacaoMMin(1)).toBe(1)
    expect(alimentacaoMMin(10)).toBe(15)
    expect(tensaoV(5.5)).toBe(22)
    expect(alimentacaoMMin(5)).toBeCloseTo(7.22, 2)
    expect(correnteA({ alimentacao: 5, tensao: 5.5 })).toBeCloseTo(170, 0)
    expect(textoTensao(botaoDaTensao(18.5))).toBe('18,5 V')
    expect(textoAlimentacao(botaoDaAlimentacao(6))).toBe('6,0 m/min')
  })

  it('mais alimentação dá mais corrente; arame mais fino, menos', () => {
    expect(correnteA(painel(10, 25))).toBeGreaterThan(correnteA(painel(5, 25)))
    expect(correnteA(painel(6, 20), { ...CONTEXTO_PADRAO, diametroArameMm: 0.8 })).toBeLessThan(correnteA(painel(6, 20)))
  })

  it('modo de transferência: curto-circuito, globular e spray (só com argônio)', () => {
    expect(modoTransferencia(painel(5, 18.5))).toBe('curto-circuito')
    expect(modoTransferencia({ alimentacao: 5, tensao: 5.5 })).toBe('curto-circuito')
    expect(modoTransferencia(painel(7, 24))).toBe('globular')
    expect(modoTransferencia(painel(12, 27))).toBe('spray')
    expect(modoTransferencia(painel(12, 27), { ...CONTEXTO_PADRAO, gas: 'co2' })).toBe('globular')
  })

  it('no spray o arco certo é mais longo: ~25–26 V fica equilibrado (e 22 V é arco curto); com CO₂ continua globular', () => {
    expect(equilibrioArco(painel(12, 25.5)).condicao).toBe('equilibrado')
    expect(equilibrioArco(painel(12, 22)).condicao).toBe('curto')
    expect(modoTransferencia(painel(12, 25.5), { ...CONTEXTO_PADRAO, gas: 'co2' })).toBe('globular')
  })
})

describe('H93: os ajustes mudam a solda', () => {
  it('tensão baixa demais para o arame (arco curto): o metal deita sem fundir as bordas', () => {
    const certo = passe(painel(6, 20.5)), curto = passe(painel(6, 15.5))
    expect(fusaoMedia(curto)).toBeLessThan(0.8 * fusaoMedia(certo))
  })

  it('globular respinga mais que curto-circuito e spray com a mesma mistura', () => {
    expect(respingos(passe(painel(7, 24)))).toBeGreaterThan(respingos(passe(painel(6, 20.5))))
    expect(respingos(passe(painel(12, 27), CONTEXTO_PADRAO, 12))).toBeLessThan(respingos(passe(painel(7, 24))))
  })

  it('spray penetra mais (funde mais) que o mesmo calor em globular', () => {
    // Mesma alimentação e quase a mesma tensão, de um lado e do outro da transição.
    const globular = passe(painel(10.5, 23.5), CONTEXTO_PADRAO, 10), spray = passe(painel(10.5, 24), CONTEXTO_PADRAO, 10)
    expect(modoTransferencia(painel(10.5, 23.5))).toBe('globular')
    expect(modoTransferencia(painel(10.5, 24))).toBe('spray')
    expect(fusaoMedia(spray)).toBeGreaterThan(1.1 * fusaoMedia(globular))
  })

  it('tensão mais alta deixa o cordão mais largo e baixo com o mesmo metal', () => {
    const largura = (sim: Simulacao) => sim.cordao.secao(sim.cordao.indiceEm(75)).larguraMm
    expect(largura(passe(painel(6, 22)))).toBeGreaterThan(largura(passe(painel(6, 18))))
  })
})
