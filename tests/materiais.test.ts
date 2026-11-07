import { describe, expect, it } from 'vitest'
import { comJunta, comMaterial, contextoDaMissao, espessurasPara, PECA_PADRAO, pecaLivre, preparoPadrao, type Missao } from '../src/missoes/catalogo'
import { aporteAlvoKJmm, PECAS_ELETRODO, pecaEletrodoEm } from '../src/missoes/pecasEletrodo'
import { pecaTig, pecaTigEm } from '../src/missoes/pecasTig'
import { analisarDefeitos } from '../src/modelo/defeitos'
import { analisarFusao } from '../src/modelo/fusao'
import { TIPOS_JUNTA } from '../src/modelo/juntas'
import { gasesDoMaterial, MATERIAIS, materiaisDoProcesso, type MaterialId } from '../src/modelo/material'
import { Simulacao } from '../src/modelo/simulacao'
import { ModeloTig } from '../src/modelo/tig'
import { TRACOS_MATERIAL } from '../src/ui/componentes/material'

/*
 * H104 (v2.0): chapas com características próprias (espessura, calor para
 * fundir, aquecimento, deformação, limpeza) que o treino deixa trocar.
 */
const IDS = Object.keys(MATERIAIS) as MaterialId[]

/** Um passe reto e constante na peça, com a máquina de referência. */
function passe(m: Missao, oxidoRemovido = true, v = 5) {
  const ctx = contextoDaMissao(m, { ...preparoPadrao(m), oxidoRemovido })
  const sim = new Simulacao(ctx)
  sim.definirAjustes({ alimentacao: 5, tensao: 5.5 })
  let t = 1000, x = 6
  sim.iniciarArco({ t, x, y: 0 })
  while (x < 143) {
    t += 8
    x = Math.min(143, x + (v * 8) / 1000)
    sim.moverTocha({ t, x, y: 0 })
  }
  const aquecimento = sim.estado(t).aquecimento
  sim.encerrarArco({ t, x, y: 0 })
  return { sim, aquecimento }
}

const indiceMedio = (m: Missao) => {
  const { sim } = passe(m)
  const pontos = analisarFusao(sim.cordao, sim.percurso, sim.contexto).filter((p) => p.xMm > 30 && p.xMm < 130)
  return pontos.reduce((s, p) => s + p.indice, 0) / pontos.length
}

describe('catálogo de chapas (H104)', () => {
  it('há chapas novas, cada uma com gás, estoque de espessuras e processos', () => {
    for (const novo of ['aco-galvanizado', 'aco-medio-carbono', 'inox-ferritico', 'cobre'] as const) expect(IDS).toContain(novo)
    for (const id of IDS) {
      const m = MATERIAIS[id]
      expect(gasesDoMaterial(id).length, id).toBeGreaterThan(0)
      expect(m.ficha.espessurasMm.length, id).toBeGreaterThan(0)
      expect(m.ficha.pontos.length, id).toBeGreaterThan(0)
      expect(m.processos, id).toContain('MIG/MAG')
      expect(!!m.tig, id).toBe(m.processos.includes('TIG'))
      expect(!!m.limpeza, id).toBe(m.exigeLimpeza)
    }
  })

  it('cada chapa tem características únicas: nenhuma tem a mesma ficha de outra', () => {
    const fichas = IDS.map((id) => TRACOS_MATERIAL.map((t) => t.nivel(MATERIAIS[id])).join(''))
    expect(new Set(fichas).size).toBe(IDS.length)
  })

  it('galvanizado não vai ao TIG; alumínio e cobre não vão ao eletrodo', () => {
    expect(materiaisDoProcesso('TIG')).not.toContain('aco-galvanizado')
    expect(materiaisDoProcesso('eletrodo')).not.toContain('aluminio')
    expect(materiaisDoProcesso('eletrodo')).not.toContain('cobre')
  })
})

describe('treino livre do MIG/MAG em qualquer chapa (H104)', () => {
  it('toda chapa, espessura e junta possível monta um contexto válido', () => {
    for (const id of materiaisDoProcesso('MIG/MAG')) for (const junta of TIPOS_JUNTA) for (const e of espessurasPara(id, junta)) {
      const m = comMaterial(comJunta(PECA_PADRAO, junta), id, e)
      expect(m.geometria.espessuraMm).toBe(e)
      expect(() => contextoDaMissao(m, preparoPadrao(m)), `${id} ${junta} ${e}`).not.toThrow()
    }
  })

  it('a espessura vem do estoque da chapa; chapa fina não aceita o V', () => {
    expect(comMaterial(PECA_PADRAO, 'aco-galvanizado').geometria.espessuraMm).toBe(2)
    expect(comMaterial(PECA_PADRAO, 'aco-medio-carbono').geometria.espessuraMm).toBe(4)
    const v = comJunta(PECA_PADRAO, 'v')
    expect(comMaterial(v, 'aco-medio-carbono').geometria).toMatchObject({ junta: 'v', espessuraMm: 6 })
    expect(comMaterial(v, 'inox-ferritico').geometria.junta).toBe('topo')
  })

  it('a peça da tentativa volta igual a partir do contexto', () => {
    const m = comMaterial(comJunta(PECA_PADRAO, 't'), 'cobre', 3)
    const ctx = contextoDaMissao(m, preparoPadrao(m))
    expect(pecaLivre(ctx).geometria).toEqual(m.geometria)
    expect(pecaLivre(ctx).material).toBe('cobre')
  })

  it('o cobre pede muito mais calor que o aço; o inox, menos', () => {
    const em = (id: MaterialId) => indiceMedio(comMaterial(PECA_PADRAO, id, 3))
    const aco = em('aco-carbono')
    expect(em('cobre')).toBeLessThan(0.6 * aco)
    expect(em('inox-austenitico')).toBeGreaterThan(aco)
  })

  it('o inox ferrítico esquenta mais que o aço carbono, e o médio carbono menos', () => {
    const calor = (id: MaterialId, e: number) => passe(comMaterial(PECA_PADRAO, id, e)).aquecimento
    const aco = calor('aco-carbono', 1.5)
    expect(calor('inox-ferritico', 1.5)).toBeGreaterThan(aco)
    expect(calor('aco-medio-carbono', 4)).toBeLessThan(aco)
  })

  it('galvanizado com o zinco na borda: menos fusão e mais poro', () => {
    const m = comMaterial(PECA_PADRAO, 'aco-galvanizado', 2)
    const poro = (limpo: boolean) => {
      const { sim } = passe(m, limpo)
      const a = analisarDefeitos({ cordao: sim.cordao, percurso: sim.percurso, contexto: sim.contexto, registro: sim.registro, eventos: sim.eventos })
      return a.porosidade.reduce((s, v) => s + v, 0)
    }
    expect(poro(false)).toBeGreaterThan(poro(true))
  })
})

describe('eletrodo e TIG em outra chapa (H104)', () => {
  it('eletrodo: a corrente sugerida e o aporte de referência seguem a chapa', () => {
    const p = PECAS_ELETRODO[0]
    const medio = pecaEletrodoEm(p, 'aco-medio-carbono'), inox = pecaEletrodoEm(p, 'inox-austenitico')
    expect(medio.material).toBe('aco-medio-carbono')
    expect(medio.espessuraMm).toBe(p.espessuraMm)
    expect(aporteAlvoKJmm(medio)).toBeGreaterThan(aporteAlvoKJmm(p))
    expect(aporteAlvoKJmm(inox)).toBeLessThan(aporteAlvoKJmm(p))
    expect(() => pecaEletrodoEm(p, 'cobre')).toThrow()
  })

  it('TIG: o cobre na corrente do aço mal funde; na corrente sugerida para ele, funde', () => {
    const p = pecaTig('tig-t')
    const largura = (peca: typeof p, corrente: number) => {
      const m = new ModeloTig(peca)
      m.correnteA = corrente
      m.xMm = 30
      m.distanciaMm = 2.5
      m.pedal = 1
      const dt = 1 / 60
      for (let t = 0; t < 1.5; t += dt) m.avancar(dt)
      while (m.xMm < 100) { m.xMm += 2 * dt; m.avancar(dt) }
      let s = 0
      for (let x = 60; x < 95; x++) s += m.larguraFundida(x)
      return s / 35
    }
    const meio = (q: typeof p) => (q.correnteA.min + q.correnteA.max) / 2
    const aco = largura(p, meio(p))
    const cobre = pecaTigEm(p, 'cobre')
    expect(meio(cobre)).toBeGreaterThan(1.8 * meio(p))
    expect(largura(cobre, meio(p))).toBeLessThan(0.5 * aco)
    expect(Math.abs(largura(cobre, meio(cobre)) - aco)).toBeLessThan(1.5)
    expect(() => pecaTigEm(p, 'aco-galvanizado')).toThrow()
  }, 60000)
})
