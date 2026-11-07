import { describe, expect, it } from 'vitest'
import { analisarFusao, indiceDeformacao } from '../src/modelo/fusao'
import type { Ajustes, ContextoProcesso } from '../src/modelo/processo'
import { CONTEXTO_PADRAO } from '../src/modelo/processo'
import { reproduzir } from '../src/modelo/replay'
import { Simulacao } from '../src/modelo/simulacao'

interface Passe {
  ctx?: ContextoProcesso
  ajustes?: Ajustes
  velocidade?: (x: number) => number
  lateral?: number
  quadroMs?: number
  pausaMs?: number
}

function passe(o: Passe = {}): Simulacao {
  const sim = new Simulacao(o.ctx ?? CONTEXTO_PADRAO)
  if (o.ajustes) sim.definirAjustes(o.ajustes)
  const vel = o.velocidade ?? (() => 6) // v1.8 (H87): metade da velocidade de antes
  const y = o.lateral ?? 0
  let t = 0
  let x = 5
  let quadro = 0
  let pausou = false
  sim.iniciarArco({ t, x, y })
  while (x < 145) {
    t += 8
    if (o.pausaMs && !pausou && x > 70) {
      t += o.pausaMs
      pausou = true
    }
    x += vel(x) * 0.008
    if (o.quadroMs) {
      while (quadro < t) {
        sim.avancarTempo(quadro)
        quadro += o.quadroMs
      }
    }
    sim.moverTocha({ t, x, y })
  }
  sim.encerrarArco({ t, x, y })
  return sim
}

const noMeio = (sim: Simulacao, x = 75) =>
  analisarFusao(sim.cordao, sim.percurso, sim.contexto)[sim.cordao.indiceEm(x)]

describe('índice de fusão sintético (H31–H34)', () => {
  it('aço 3 mm na referência fica na faixa adequada', () => {
    const p = noMeio(passe())
    expect(p.estado).toBe('adequada')
    expect(p.indice).toBeGreaterThan(1.2)
    expect(p.indice).toBeLessThan(1.7)
  })

  it('rápido demais → falta de fusão; chapa fina na referência → perfuração', () => {
    expect(noMeio(passe({ velocidade: () => 15 })).estado).toBe('falta')
    expect(noMeio(passe({ ctx: { ...CONTEXTO_PADRAO, espessuraMm: 1.5 } })).estado).toBe('perfuracao')
  })

  it('devagar demais não aumenta a fusão sem limite (amortecimento)', () => {
    const lento = noMeio(passe({ velocidade: () => 1 })).indice
    const medio = noMeio(passe({ velocidade: () => 2.5 })).indice
    // H101: o que derreteu não volta, então o metal que chega depois não baixa mais o índice.
    // Mesmo assim, com 2,5× o calor por mm, a fusão sobe muito menos que 2,5× (amortecimento).
    expect(lento / medio).toBeLessThan(1.25)
  })

  it('tocha fora da junta → borda não coberta', () => {
    expect(noMeio(passe({ lateral: 5 })).estado).toBe('borda')
  })

  it('não depende da taxa de quadros (inclui o aquecimento acumulado)', () => {
    const a = passe({ pausaMs: 2400 }).percurso.copiaDosAportesEfetivos()
    const b = passe({ pausaMs: 2400, quadroMs: 1000 / 23 }).percurso.copiaDosAportesEfetivos()
    let maior = 0
    for (let i = 0; i < a.length; i++) maior = Math.max(maior, Math.abs(a[i] - b[i]))
    expect(maior).toBeLessThan(1e-9)
  })
})

describe('materiais com comportamento próprio (H35)', () => {
  const aluminio: ContextoProcesso = { ...CONTEXTO_PADRAO, material: 'aluminio', gas: 'ar', diametroArameMm: 1.2 }
  const aco: ContextoProcesso = { ...CONTEXTO_PADRAO, diametroArameMm: 1.2 }
  const ajustes = { alimentacao: 7, tensao: 9.5 }

  it('no alumínio a fusão cresce ao longo do passe muito mais que no aço', () => {
    const cresceAl = noMeio(passe({ ctx: aluminio, ajustes, velocidade: () => 12.5 }), 130).indice /
      noMeio(passe({ ctx: aluminio, ajustes, velocidade: () => 12.5 }), 20).indice
    const cresceAco = noMeio(passe({ ctx: aco, ajustes, velocidade: () => 12.5 }), 130).indice /
      noMeio(passe({ ctx: aco, ajustes, velocidade: () => 12.5 }), 20).indice
    expect(cresceAl).toBeGreaterThan(1.25)
    expect(cresceAco).toBeLessThan(1.1)
  })

  it('alumínio sem remover o óxido funde menos', () => {
    const limpo = noMeio(passe({ ctx: aluminio, ajustes, velocidade: () => 12.5 })).indice
    const sujo = noMeio(passe({ ctx: { ...aluminio, oxidoRemovido: false }, ajustes, velocidade: () => 12.5 })).indice
    expect(sujo / limpo).toBeCloseTo(0.6, 5)
  })

  it('inox deforma mais que aço carbono com o mesmo calor relativo', () => {
    const inox: ContextoProcesso = { ...CONTEXTO_PADRAO, material: 'inox-austenitico', gas: 'ar-co2-baixo' }
    const deformacao = (ctx: ContextoProcesso) => {
      const sim = passe({ ctx })
      return indiceDeformacao(analisarFusao(sim.cordao, sim.percurso, ctx), ctx)
    }
    // Com o mesmo aporte, o inox precisa de menos e deforma mais: D bem maior.
    expect(deformacao(inox)).toBeGreaterThan(1.5 * deformacao(CONTEXTO_PADRAO))
  })
})

describe('replay', () => {
  it('reproduz exatamente o cordão e o calor da tentativa', () => {
    const original = passe({ pausaMs: 1600, quadroMs: 16, ajustes: { alimentacao: 6, tensao: 6 } })
    const copia = reproduzir(original.contexto, original.eventos)
    const a = original.cordao.copiaDosVolumes()
    const b = copia.cordao.copiaDosVolumes()
    const fa = original.percurso.copiaDosAportesEfetivos()
    const fb = copia.percurso.copiaDosAportesEfetivos()
    for (let i = 0; i < a.length; i++) {
      expect(b[i]).toBeCloseTo(a[i], 9)
      expect(fb[i]).toBeCloseTo(fa[i], 9)
    }
  })
})

describe('técnica de deslocamento (H38)', () => {
  const comTecnica = (tecnica: 'empurrando' | 'neutra' | 'puxando') => {
    const ctx: ContextoProcesso = { ...CONTEXTO_PADRAO, tecnica }
    const sim = passe({ ctx })
    const s = sim.cordao.secao(sim.cordao.indiceEm(75))
    return { s, F: noMeio(sim).indice, volume: sim.cordao.volumeTotal() }
  }

  it('puxando: mais estreito, mais alto e mais fusão; empurrando: o contrário; mesmo metal', () => {
    const n = comTecnica('neutra')
    const p = comTecnica('puxando')
    const e = comTecnica('empurrando')
    expect(p.s.larguraMm).toBeLessThan(n.s.larguraMm)
    expect(p.s.alturaMm).toBeGreaterThan(n.s.alturaMm)
    expect(p.F).toBeGreaterThan(n.F)
    expect(e.s.larguraMm).toBeGreaterThan(n.s.larguraMm)
    expect(e.F).toBeLessThan(n.F)
    expect(p.volume).toBeCloseTo(n.volume, 6)
    expect(e.volume).toBeCloseTo(n.volume, 6)
  })

  it('sem técnica informada equivale à neutra (dados antigos)', () => {
    const antigo = passe().cordao.copiaDosVolumes()
    const neutra = passe({ ctx: { ...CONTEXTO_PADRAO, tecnica: 'neutra' } }).cordao.copiaDosVolumes()
    expect([...antigo]).toEqual([...neutra])
  })
})
