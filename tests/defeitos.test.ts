import { describe, expect, it } from 'vitest'
import { contextoDaMissao, MISSOES, type Preparo } from '../src/missoes/catalogo'
import { analisarDefeitos, formaDomo, notaSuperficie, sorteioFixo, type AnaliseDefeitos, type TipoDefeito } from '../src/modelo/defeitos'
import type { PosicaoPeca } from '../src/modelo/juntas'
import type { Ajustes, ContextoProcesso } from '../src/modelo/processo'
import { reproduzir } from '../src/modelo/replay'
import { Simulacao } from '../src/modelo/simulacao'
import { pontuar } from '../src/pontuacao/regras'

/*
 * Defeitos visíveis (H50–H57): as DIREÇÕES da prática, no caso de
 * referência (aço carbono 3 mm, topo reto, argônio + CO₂, 5,5 / 5).
 */
const MISSAO = MISSOES.find((m) => m.id === 'suporte-carbono')!
const PREPARO: Preparo = { diametroArameMm: 1, gas: 'ar-co2', oxidoRemovido: true, tecnica: 'neutra', dbcpMm: 15 }
const REF: Ajustes = { alimentacao: 5, tensao: 5.5 }
const ctxRef = (m: Partial<Preparo> = {}): ContextoProcesso => contextoDaMissao(MISSAO, { ...PREPARO, ...m })
const PLANA: PosicaoPeca = { rolagemGraus: 0, giroGraus: 0 }
const SOBRECABECA: PosicaoPeca = { rolagemGraus: 180, giroGraus: 0 }
const HORIZONTAL: PosicaoPeca = { rolagemGraus: 90, giroGraus: 0 }
const VERTICAL_DESCENDO: PosicaoPeca = { rolagemGraus: 90, giroGraus: 90 }

function passe(ctx: ContextoProcesso, op: { ajustes?: Ajustes; v?: number; pos?: PosicaoPeca; pararMs?: number; quadrosMs?: number } = {}) {
  const sim = new Simulacao(ctx)
  sim.definirAjustes(op.ajustes ?? REF)
  if (op.pos) sim.definirPosicao(op.pos)
  const v = op.v ?? 5 // v1.8 (H87): metade da velocidade de antes
  let t = 1000
  let x = 6
  sim.iniciarArco({ t, x, y: 0 })
  let quadro = t
  while (x < 143) {
    t += 8
    x = Math.min(143, x + (v * 8) / 1000)
    sim.moverTocha({ t, x, y: 0 })
    if (op.quadrosMs) while (quadro + op.quadrosMs <= t) sim.avancarTempo((quadro += op.quadrosMs))
  }
  if (op.pararMs) {
    t += op.pararMs
    sim.moverTocha({ t, x, y: 0 })
  }
  sim.encerrarArco({ t, x, y: 0 })
  return sim
}

const analisar = (sim: Simulacao) => analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: sim.contexto, registro: sim.registro, eventos: sim.eventos })
/** Média de uma grandeza no meio do cordão (30 a 130 mm). */
const meio = (v: Float32Array) => {
  let s = 0
  for (let i = 60; i < 260; i++) s += v[i]
  return s / 200
}
const tipos = (a: AnaliseDefeitos): TipoDefeito[] => [...new Set(a.ocorrencias.map((o) => o.tipo))]

describe('defeitos visíveis (H50–H57)', () => {
  it('referência na plana, parando no fim: nenhum defeito e superfície perfeita', () => {
    const a = analisar(passe(ctxRef(), { pararMs: 800 }))
    expect(a.ocorrencias).toEqual([])
    expect(a.gotas).toHaveLength(0)
    expect(a.respingos).toHaveLength(0)
    expect(a.poros).toHaveLength(0)
    for (let i = 60; i < 260; i++) expect(notaSuperficie(a, i)).toBe(1)
  })

  it('cratera (H55): fechar o arco andando deixa cratera; parar um instante enche', () => {
    expect(tipos(analisar(passe(ctxRef())))).toEqual(['cratera'])
    expect(tipos(analisar(passe(ctxRef(), { pararMs: 800 })))).toEqual([])
    const a = analisar(passe(ctxRef()))
    const c = a.ocorrencias.find((o) => o.tipo === 'cratera')!
    expect(c.inicioMm).toBeGreaterThan(138)
  })

  it('cratera coberta por um passe depois deixa de existir', () => {
    const sim = new Simulacao(ctxRef())
    sim.definirAjustes(REF)
    let t = 1000
    let x = 20
    sim.iniciarArco({ t, x, y: 0 })
    while (x < 80) sim.moverTocha({ t: (t += 8), x: (x += 0.08), y: 0 })
    sim.encerrarArco({ t, x, y: 0 })
    // Segundo passe começa antes do fim do primeiro e passa por cima da cratera.
    t += 2000
    x = 70
    sim.iniciarArco({ t, x, y: 0 })
    while (x < 120) sim.moverTocha({ t: (t += 8), x: (x += 0.08), y: 0 })
    sim.moverTocha({ t: (t += 400), x, y: 0 })
    sim.encerrarArco({ t, x, y: 0 })
    expect(analisar(sim).ocorrencias.filter((o) => o.tipo === 'cratera')).toEqual([])
  })

  it('gravidade (H50): sobrecabeça com poça grande pinga; a mesma solda na plana não', () => {
    const cabeca = analisar(passe(ctxRef(), { v: 3.5, pos: SOBRECABECA }))
    const plana = analisar(passe(ctxRef(), { v: 3.5, pos: PLANA }))
    expect(tipos(cabeca)).toContain('gotejamento')
    expect(cabeca.gotas.length).toBeGreaterThan(10)
    expect(plana.gotas).toHaveLength(0)
    expect(meio(plana.gotejamento)).toBe(0)
    // Poça pequena (mais rápido) na sobrecabeça: sem gotas.
    expect(analisar(passe(ctxRef(), { v: 5, pos: SOBRECABECA })).gotas).toHaveLength(0)
  })

  it('gravidade (H50): na vertical descendente a poça grande escorre e sobrepõe', () => {
    const a = analisar(passe(ctxRef(), { v: 3.5, pos: VERTICAL_DESCENDO }))
    expect(tipos(a)).toEqual(expect.arrayContaining(['escorrimento', 'sobreposicao']))
    expect(meio(a.rolos)).toBeGreaterThan(0.5)
    // Mais rápido, poça menor: quase nada.
    expect(meio(analisar(passe(ctxRef(), { v: 5, pos: VERTICAL_DESCENDO })).rolos)).toBeLessThan(0.1)
  })

  it('gravidade (H50): na horizontal o metal cai para a chapa de baixo; a de cima fica mordida', () => {
    const a = analisar(passe(ctxRef(), { v: 3.5, pos: HORIZONTAL }))
    // Rolagem 90° com giro 0: a gravidade puxa para +n.
    expect(meio(a.caimento)).toBeGreaterThan(0.5)
    expect(meio(a.mordeduraMenos)).toBeGreaterThan(meio(a.mordeduraMais))
    expect(meio(a.sobreposicaoMais)).toBeGreaterThan(meio(a.sobreposicaoMenos))
    expect(tipos(a)).toEqual(expect.arrayContaining(['caimento', 'mordedura', 'sobreposicao']))
  })

  it('mordedura (H52): arco longo morde a borda; na referência não', () => {
    const longo = analisar(passe(ctxRef(), { ajustes: { alimentacao: 5, tensao: 8 } }))
    expect(meio(longo.mordeduraMenos)).toBeGreaterThan(longo.limiteMordeduraMm)
    expect(meio(analisar(passe(ctxRef())).mordeduraMenos)).toBe(0)
  })

  it('sobreposição (H53): devagar com arco curto deita o metal sem fundir', () => {
    const a = analisar(passe(ctxRef(), { ajustes: { alimentacao: 2.5, tensao: 3.5 }, v: 1.5 }))
    expect(tipos(a)).toContain('sobreposicao')
    expect(meio(analisar(passe(ctxRef())).sobreposicaoMenos)).toBe(0)
  })

  it('respingos (H54): CO₂ puro respinga mais que a mistura; arco fora do equilíbrio mais ainda', () => {
    const mistura = analisar(passe(ctxRef()))
    const co2 = analisar(passe(ctxRef({ gas: 'co2' })))
    const desequilibrado = analisar(passe(ctxRef({ gas: 'co2' }), { ajustes: { alimentacao: 5, tensao: 3 } }))
    expect(mistura.respingos).toHaveLength(0)
    expect(co2.respingos.length).toBeGreaterThan(0)
    expect(desequilibrado.respingos.length).toBeGreaterThan(co2.respingos.length)
    expect(tipos(desequilibrado)).toContain('respingos')
    // Presos na chapa, fora do cordão.
    for (const r of co2.respingos) expect(Math.abs(r.nMm)).toBeGreaterThan(2)
  })

  it('porosidade (H57): alumínio sem limpar o óxido, arco longo e DBCP grande', () => {
    const al = MISSOES.find((m) => m.id === 'aluminio-componente')!
    const sujo = contextoDaMissao(al, { diametroArameMm: 1, gas: 'ar', oxidoRemovido: false, tecnica: 'neutra', dbcpMm: 15 })
    const limpo = contextoDaMissao(al, { diametroArameMm: 1, gas: 'ar', oxidoRemovido: true, tecnica: 'neutra', dbcpMm: 15 })
    expect(meio(analisar(passe(sujo)).porosidade)).toBeGreaterThan(meio(analisar(passe(limpo)).porosidade))
    expect(tipos(analisar(passe(sujo)))).toContain('porosidade')
    expect(analisar(passe(sujo)).poros.length).toBeGreaterThan(0)
    expect(meio(analisar(passe(ctxRef({ dbcpMm: 20 }))).porosidade)).toBeGreaterThan(meio(analisar(passe(ctxRef())).porosidade))
  })

  it('empeno (H57): mais calor por mm, mais empeno', () => {
    expect(analisar(passe(ctxRef(), { v: 2.5 })).empenoGraus).toBeGreaterThan(analisar(passe(ctxRef(), { v: 5 })).empenoGraus)
    expect(analisar(passe(ctxRef())).empenoGraus).toBeGreaterThan(0)
  })

  it('escamas (H56): espaçamento acompanha a velocidade (devagar → juntas)', () => {
    const fase = (a: AnaliseDefeitos) => Math.abs(a.escamaFase[260] - a.escamaFase[60]) / 100
    const devagar = analisar(passe(ctxRef(), { v: 2.5 }))
    const rapido = analisar(passe(ctxRef(), { v: 5 }))
    // Ciclos por mm: o dobro devagar.
    expect(fase(devagar) / fase(rapido)).toBeCloseTo(2, 1)
    expect(rapido.escamaDir[100]).toBe(1)
  })

  it('o mesmo registro dá os mesmos defeitos: replay e qualquer taxa de quadros', () => {
    const sim = passe(ctxRef({ gas: 'co2' }), { v: 3.5, pos: SOBRECABECA, ajustes: { alimentacao: 5, tensao: 3.5 } })
    const a = analisar(sim)
    const r = reproduzir(sim.contexto, sim.eventos)
    const b = analisar(r)
    expect(b.ocorrencias).toEqual(a.ocorrencias)
    expect(b.gotas).toEqual(a.gotas)
    expect(b.respingos).toEqual(a.respingos)
    // Mesmas leituras com quadros de 7 ms e de 33 ms: o mesmo desenho.
    for (const quadrosMs of [7, 33]) {
      const c = analisar(passe(ctxRef({ gas: 'co2' }), { v: 3.5, pos: SOBRECABECA, ajustes: { alimentacao: 5, tensao: 3.5 }, quadrosMs }))
      expect(c.gotas).toEqual(a.gotas)
      expect(c.ocorrencias).toEqual(a.ocorrencias)
    }
  })

  it('sorteio fixo: mesma entrada, mesmo número, entre 0 e 1', () => {
    expect(sorteioFixo(10, 3)).toBe(sorteioFixo(10, 3))
    expect(sorteioFixo(10, 3)).not.toBe(sorteioFixo(11, 3))
    for (let i = 0; i < 200; i++) {
      const v = sorteioFixo(i, 1)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('forma do domo: o caimento só muda o lado do metal, não a quantidade', () => {
    const area = (c: number) => {
      let s = 0
      for (let k = 0; k < 2000; k++) s += formaDomo(-1 + (k + 0.5) / 1000, c, 0, 0) / 1000
      return s
    }
    expect(area(0.8)).toBeCloseTo(area(0), 3)
    expect(formaDomo(0.5, 0.8, 0, 0)).toBeGreaterThan(formaDomo(-0.5, 0.8, 0, 0))
    expect(formaDomo(0, 0, 0, 0)).toBe(1)
    expect(formaDomo(1, 0, 0, 0)).toBe(0)
  })

  describe('pontuação v6: defeitos visíveis entram na nota', () => {
    const nota = (sim: Simulacao) =>
      pontuar({ missao: MISSAO, dificuldade: 'aprendiz', contexto: sim.contexto, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs, eventos: sim.eventos })
    const cat = (r: ReturnType<typeof nota>, id: string) => r.categorias.find((c) => c.id === id)!
    const sup = (r: ReturnType<typeof nota>) => cat(r, 'desenho').detalhes.find((d) => d.rotulo === 'Superfície')!.valor

    it('referência parando no fim: superfície 100 %', () => {
      expect(sup(nota(passe(ctxRef(), { pararMs: 800 })))).toBe('100%')
    })

    it('gotas na sobrecabeça baixam a geometria; a mesma solda na plana não', () => {
      const cabeca = nota(passe(ctxRef(), { v: 3.5, pos: SOBRECABECA }))
      const plana = nota(passe(ctxRef(), { v: 3.5, pos: PLANA }))
      expect(Number.parseInt(sup(cabeca), 10)).toBeLessThan(50)
      expect(sup(plana)).not.toBe(sup(cabeca))
    })

    it('porosidade tira nota de fusão; no Fácil não há aprovação (H90)', () => {
      const al = MISSOES.find((m) => m.id === 'aluminio-componente')!
      const base = { diametroArameMm: 1, gas: 'ar' as const, tecnica: 'neutra' as const, dbcpMm: 15 }
      const r = (oxidoRemovido: boolean) => {
        const ctx = contextoDaMissao(al, { ...base, oxidoRemovido })
        const sim = passe(ctx, { pararMs: 800 })
        return pontuar({ missao: al, dificuldade: 'aprendiz', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs, eventos: sim.eventos })
      }
      const sujo = r(false)
      const limpo = r(true)
      expect(cat(sujo, 'integridade').pontos).toBeLessThan(cat(limpo, 'integridade').pontos)
      expect(sujo.essenciais).toEqual([])
      expect(sujo.exigencia).toBeNull()
    })

    it('cratera no fim custa pouco (é só a ponta), mas aparece', () => {
      const com = nota(passe(ctxRef()))
      const sem = nota(passe(ctxRef(), { pararMs: 800 }))
      expect(cat(sem, 'desenho').pontos - cat(com, 'desenho').pontos).toBeLessThanOrEqual(5)
    })
  })
})
