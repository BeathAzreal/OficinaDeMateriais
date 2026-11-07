import { describe, expect, it } from 'vitest'
import { analisarDefeitos } from '../src/modelo/defeitos'
import { analisarFusao } from '../src/modelo/fusao'
import { FUSAO } from '../src/modelo/parametros'
import { botaoDaTensao, CONTEXTO_PADRAO, correnteA, MAQUINA, modoTransferencia, potenciaRelativa, razaoAlturaLargura, taxaDeposicao, tensaoV, type ContextoProcesso } from '../src/modelo/processo'
import { semArco, Simulacao } from '../src/modelo/simulacao'

const aj = (V: number, alimentacao = 5) => ({ alimentacao, tensao: botaoDaTensao(V) })

/** Tocha parada no meio da chapa por `seg` segundos. */
function parado(V: number, seg: number, ctx: ContextoProcesso = CONTEXTO_PADRAO, dtMs = 8) {
  const sim = new Simulacao(ctx)
  sim.definirAjustes(aj(V))
  let t = 0
  sim.iniciarArco({ t, x: 75, y: 0 })
  while (t < seg * 1000) { t += dtMs; sim.moverTocha({ t, x: 75, y: 0 }) }
  sim.encerrarArco({ t, x: 75, y: 0 })
  const fusao = analisarFusao(sim.cordao, sim.percurso, ctx)
  const a = analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: ctx, registro: sim.registro, eventos: sim.eventos, fusao })
  const i = sim.cordao.indiceEm(75)
  return { indice: fusao[i].indice, furo: a.furoMm[i], tipos: new Set(a.ocorrencias.map((o) => o.tipo)), area: sim.cordao.secao(i).areaMm2 }
}

describe('H99: tocha parada fura a chapa fina (o metal acumulado protege só até certo ponto)', () => {
  it('quanto mais tempo parado, nunca menos fusão depois que o metal passa do limite', () => {
    const i = [6, 8, 12].map((s) => parado(22, s).indice)
    expect(i[1]).toBeGreaterThan(i[0])
    expect(i[2]).toBeGreaterThan(i[1])
  })
  it('22 V parado por 8 s na chapa de 3 mm: fura', () => {
    const r = parado(22, 8)
    expect(r.indice).toBeGreaterThan(FUSAO.perfuracao)
    expect(r.furo).toBeGreaterThan(0)
    expect(r.tipos.has('furo')).toBe(true)
  })
  it('tensão alta fura mais cedo que tensão baixa', () => {
    expect(parado(30, 2).tipos.has('furo')).toBe(true)
    expect(parado(18, 2).tipos.has('furo')).toBe(false)
  })
  it('chapa grossa aguenta mais tempo parado', () => {
    expect(parado(22, 8, { ...CONTEXTO_PADRAO, espessuraMm: 8 }).tipos.has('furo')).toBe(false)
  })
  it('independe da taxa de quadros', () => {
    const a = parado(26, 4, CONTEXTO_PADRAO, 1000 / 144).indice
    const b = parado(26, 4, CONTEXTO_PADRAO, 1000 / 30).indice
    expect(Math.abs(a - b) / a).toBeLessThan(0.02)
  })
})

describe('H100: tensão de 0 a 30 V', () => {
  it('o painel vai de 0 a 30 V e o botão 1 continua sendo 14 V (registros salvos valem o mesmo)', () => {
    expect(MAQUINA.tensaoMinV).toBe(0)
    expect(tensaoV(1)).toBeCloseTo(14, 9)
    expect(tensaoV(10)).toBeCloseTo(30, 9)
    expect(tensaoV(botaoDaTensao(0))).toBeCloseTo(0, 9)
  })
  it('abaixo de 10 V não há arco: sem corrente, sem calor, sem metal', () => {
    for (const V of [0, 5, 9.5]) {
      const a = aj(V)
      expect(modoTransferencia(a)).toBe('sem-arco')
      expect(correnteA(a)).toBe(0)
      expect(potenciaRelativa(a)).toBe(0)
      expect(taxaDeposicao(a)).toBe(0)
    }
    const sim = new Simulacao()
    sim.definirAjustes(aj(0))
    expect(semArco(sim)).toBe(true)
    let t = 0
    sim.iniciarArco({ t, x: 30, y: 0 })
    while (t < 3000) { t += 8; sim.moverTocha({ t, x: 30 + t / 200, y: 0 }) }
    sim.encerrarArco({ t, x: 45, y: 0 })
    expect(sim.cordao.secao(sim.cordao.indiceEm(37)).areaMm2).toBe(0)
  })
  it('de 10 a 14 V o arame bate: pouco calor, menos metal, cordão alto e estreito', () => {
    const a = aj(12)
    expect(modoTransferencia(a)).toBe('arame-batendo')
    expect(potenciaRelativa(a)).toBeLessThan(potenciaRelativa(aj(14)))
    expect(potenciaRelativa(a)).toBeGreaterThan(0)
    expect(taxaDeposicao(a)).toBeLessThan(taxaDeposicao(aj(14)))
    expect(razaoAlturaLargura(a)).toBeGreaterThan(razaoAlturaLargura(aj(14)))
  })
  it('a 12 V andando no ritmo certo: metal deitado sem fundir (sobreposição) e falta de fusão', () => {
    const ctx = CONTEXTO_PADRAO
    const sim = new Simulacao(ctx)
    sim.definirAjustes(aj(12))
    let t = 0, x = 20
    sim.iniciarArco({ t, x, y: 0 })
    while (x < 130) { t += 8; x += (5 * 8) / 1000; sim.moverTocha({ t, x, y: 0 }) }
    sim.encerrarArco({ t, x, y: 0 })
    const fusao = analisarFusao(sim.cordao, sim.percurso, ctx)
    const i = sim.cordao.indiceEm(75)
    expect(fusao[i].indice).toBeLessThan(FUSAO.minimoAdequado)
    const a = analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: ctx, registro: sim.registro, fusao })
    expect(Math.max(a.sobreposicaoMenos[i], a.sobreposicaoMais[i])).toBeGreaterThan(0.3)
  })
  it('de 14 V para cima nada mudou', () => {
    expect(modoTransferencia(aj(18))).toBe('curto-circuito')
    expect(taxaDeposicao(aj(14))).toBe(taxaDeposicao(aj(22)))
  })
})
