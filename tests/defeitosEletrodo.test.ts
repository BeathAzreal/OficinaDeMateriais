import { describe, expect, it } from 'vitest'
import { Acionamento15 } from '../src/modelo/acionamento15'
import { analisarEletrodo } from '../src/modelo/analiseEletrodo'
import { inspecionarDefeitos, type InspecaoEletrodo } from '../src/pontuacao/defeitosEletrodo'
import { DepositoEletrodo } from '../src/modelo/depositoEletrodo'
import { limitesPecaEletrodo, pecaEletrodo, type PecaEletrodo } from '../src/missoes/pecasEletrodo'
import { avaliarEletrodo, descontoDefeitos, MODOS_ELETRODO } from '../src/pontuacao/eletrodo'
import { RegistroPasse } from '../src/modelo/registroPasse'

interface Tecnica {
  corrente?: number
  /** Velocidade de avanço (mm/s). */
  v: number
  /** Velocidade de cada passe (substitui `v` no passe de mesmo índice). */
  vPasses?: number[]
  /** Comprimento do arco mantido (mm). */
  arco?: number
  passes?: number
  limparEntrePasses?: boolean
  /** Fica parado no fim do passe antes de afastar (enche a cratera). */
  pararNoFim?: boolean
  /** Abre o arco à frente e volta por cima do início. */
  recuarNaAbertura?: boolean
}

/** Soldador simulado a 60 quadros/s, com a mão firme: mantém o arco e o avanço pedidos. */
function soldar(peca: PecaEletrodo, t: Tecnica): { r: InspecaoEletrodo; dep: DepositoEletrodo; m: Acionamento15 } {
  const dt = 1 / 60
  const dep = new DepositoEletrodo(peca)
  const reg = new RegistroPasse(300, 0.5)
  const m = new Acionamento15('eletrodo')
  m.limitesX = limitesPecaEletrodo(peca)
  m.superficie = (y) => dep.altura(m.xMm, y)
  m.abrirAoTocar = true
  m.compensar = true
  m.regular(t.corrente ?? (peca.correnteA.min + peca.correnteA.max) / 2, peca.diametroMm)
  const arco = t.arco ?? m.diametroMm
  let tMs = 0, inclAntes = 0
  const passo = (vx: number) => {
    m.xMm += vx * dt
    const antes = m.estado
    m.avancar(dt, 0, (vol, f) => {
      dep.depositar(m.xMm, m.yMm, vol, tMs, f?.razao, 0, f?.instabilidade ?? 0)
      if (f) reg.depositar(m.xMm, f, tMs, m.escoria.inclusaoMm3 - inclAntes)
      inclAntes = m.escoria.inclusaoMm3
    })
    if (antes !== 'arco' && m.estado === 'arco') reg.inicioArco(m.xMm, m.yMm, tMs, false)
    if (antes === 'arco' && m.estado !== 'arco') reg.fimArco(m.xMm, m.yMm, tMs, m.estado === 'fim' ? 'fim-da-vareta' : m.estado === 'grudado' ? 'grudou' : 'afastou')
    if (m.estado === 'arco' && Math.abs(m.distanciaMm - arco) > 0.05) m.definirDistancia(arco)
    tMs += dt * 1000
  }
  const abrir = (x: number) => {
    m.posicionar(x, 0)
    m.pressionado = true
    m.definirDistancia(0.2)
    passo(0)
    m.definirDistancia(arco)
  }
  const esfriar = () => {
    m.soltar()
    for (let i = 0; i < 600; i++) { m.avancar(dt); tMs += dt * 1000 }
  }
  const limpar = () => {
    esfriar()
    for (let x = peca.inicioMm - 6; x <= peca.fimMm + 6; x += 2) { m.escoria.martelar(x, 0); m.escoria.escovar(x, 0) }
  }
  const passes = t.passes ?? 1
  for (let p = 0; p < passes; p++) {
    let x = peca.inicioMm
    if (t.recuarNaAbertura) { abrir(x + 6); for (let k = 0; k < 40; k++) passo(-6 / 40 / dt) } else abrir(x)
    while (m.xMm < peca.fimMm) {
      if (m.estado === 'fim') {
        // Troca de vareta: reabre um pouco antes do fim do cordão e volta por cima da emenda.
        x = m.xMm
        m.soltar(); m.trocarVareta()
        if (t.recuarNaAbertura) { abrir(x + 4); for (let k = 0; k < 30; k++) passo(-8 / 30 / dt) } else abrir(x)
        continue
      }
      if (m.estado !== 'arco') { abrir(m.xMm); continue }
      passo(t.vPasses?.[p] ?? t.v)
    }
    if (t.pararNoFim) for (let k = 0; k < 21; k++) passo(0)
    reg.fimArco(m.xMm, m.yMm, tMs, 'afastou')
    m.soltar(); m.definirDistancia(15)
    if (t.limparEntrePasses !== false || p === passes - 1) limpar()
    else esfriar()
  }
  return { r: inspecionarDefeitos(peca, dep, reg, analisarEletrodo(peca, dep, reg)), dep, m }
}

const bom: Tecnica = { v: 2.5, pararNoFim: true, recuarNaAbertura: true }
const tipos = (r: InspecaoEletrodo) => r.defeitos.map((d) => d.tipo)
const graves = (r: InspecaoEletrodo) => r.defeitos.filter((d) => d.grave).map((d) => d.tipo)

const PECAS = ['cordao-chapa', 't-estrutural', 'v-raiz', 'canto-portao', 'sobreposta-reforco']
/** Peças com raiz aberta (abertura entre as chapas): calor demais fura. */
const RAIZ_ABERTA = ['cordao-chapa', 'v-raiz', 'canto-portao']

describe('defeitos do eletrodo sobre o depósito (H82–H85)', () => {
  it('técnica boa: nenhum defeito e calor perto da referência em todas as peças', () => {
    for (const id of PECAS) {
      const { r } = soldar(pecaEletrodo(id), bom)
      expect(r.defeitos, id).toEqual([])
      expect(r.aporteMedioKJmm / r.aporteAlvoKJmm, id).toBeGreaterThan(0.85)
      expect(r.aporteMedioKJmm / r.aporteAlvoKJmm, id).toBeLessThan(1.3)
    }
  }, 60000)

  it('avanço rápido demais: falta de fusão, marcada como grave', () => {
    for (const id of PECAS) expect(graves(soldar(pecaEletrodo(id), { ...bom, v: 6 }).r), id).toContain('falta-de-fusao')
  }, 60000)

  it('avanço lento demais: perfura a raiz aberta; no filete, calor em excesso', () => {
    for (const id of PECAS) {
      const { r } = soldar(pecaEletrodo(id), { ...bom, v: 1 })
      if (RAIZ_ABERTA.includes(id)) expect(graves(r), id).toContain('perfuracao')
      else expect(tipos(r), id).toContain('excesso-de-calor')
    }
  }, 60000)

  it('H94: calor demais em níveis — metal pendurado no avesso, raiz afundada e, no limite, furo', () => {
    for (const id of ['cordao-chapa', 'cordao-sobre-chapa']) {
      const peca = pecaEletrodo(id)
      // Na chapa fechada é preciso mais calor para cada nível (fator 1,15).
      const [pendura, afunda, fura] = id === 'cordao-chapa' ? [1.4, 1.25, 1.15] : [1.2, 1.05, 1.05]
      expect(tipos(soldar(peca, { ...bom, v: 1.6 }).r), id).toEqual([])
      const r1 = tipos(soldar(peca, { ...bom, v: pendura }).r)
      expect(r1, id).toContain('penetracao-excessiva')
      expect(r1, id).not.toContain('perfuracao')
      expect(tipos(soldar(peca, { ...bom, v: afunda }).r), id).toContain('raiz-afundada')
      expect(graves(soldar(peca, { ...bom, v: fura }).r), id).toContain('perfuracao')
    }
  }, 120000)

  it('H97: segundo passe com calor funde no primeiro; passe frio por cima não liga (grave)', () => {
    const peca = pecaEletrodo('cordao-sobre-chapa')
    const quente = soldar(peca, { ...bom, passes: 2 })
    expect(tipos(quente.r)).not.toContain('falta-de-fusao-entre-passes')
    const frio = soldar(peca, { ...bom, passes: 2, vPasses: [2.5, 4.5] })
    expect(graves(frio.r)).toContain('falta-de-fusao-entre-passes')
    // O corte lê as mesmas camadas: espessura de interface sem fundir, quase nada no quente e muito no frio.
    const semFundir = (dep: DepositoEletrodo) => {
      let mal = 0, total = 0
      for (const l of dep.camadas.values()) for (const c of l.slice(1)) if (c.espessuraMm >= 0.2) { total += c.espessuraMm; if (c.fundiu === false) mal += c.espessuraMm }
      return mal / total
    }
    expect(semFundir(quente.dep)).toBeLessThan(0.1)
    expect(semFundir(frio.dep)).toBeGreaterThan(0.5)
  }, 60000)

  it('trechos repetidos do mesmo defeito viram uma linha só', () => {
    const { r } = soldar(pecaEletrodo('cordao-chapa'), { ...bom, v: 1 })
    const furos = r.defeitos.filter((d) => d.tipo === 'perfuracao')
    expect(furos).toHaveLength(1)
    expect(furos[0].trechos).toBeGreaterThan(1)
    expect(furos[0].fimMm - furos[0].inicioMm).toBeGreaterThan(50)
  }, 30000)

  it('arco longo: poros e respingos', () => {
    const { r } = soldar(pecaEletrodo('cordao-chapa'), { ...bom, arco: 4.6 })
    expect(tipos(r)).toContain('porosidade')
    expect(tipos(r)).toContain('respingos')
  }, 30000)

  it('apagar o arco de uma vez no fim deixa cratera; parar um instante enche', () => {
    expect(tipos(soldar(pecaEletrodo('t-estrutural'), { v: 2.5 }).r)).toContain('cratera')
    expect(tipos(soldar(pecaEletrodo('t-estrutural'), bom).r)).not.toContain('cratera')
  }, 30000)

  it('vários passes sem limpar a escória fria: inclusão de escória; limpando entre eles, nenhuma', () => {
    for (const id of ['cordao-chapa', 'sobreposta-reforco']) {
      expect(graves(soldar(pecaEletrodo(id), { ...bom, passes: 3, limparEntrePasses: false }).r), id).toContain('inclusao-de-escoria')
      expect(tipos(soldar(pecaEletrodo(id), { ...bom, passes: 3 }).r), id).not.toContain('inclusao-de-escoria')
    }
  }, 60000)

  it('a lista não muda a nota de 0 a 1000 nem o metal depositado', () => {
    const peca = pecaEletrodo('t-estrutural')
    const { dep, m } = soldar(peca, bom)
    const antes = avaliarEletrodo(peca, dep, m), volume = dep.volumeTotal()
    const reg = new RegistroPasse(300, 0.5)
    inspecionarDefeitos(peca, dep, reg, analisarEletrodo(peca, dep, reg))
    expect(avaliarEletrodo(peca, dep, m)).toEqual(antes)
    expect(dep.volumeTotal()).toBe(volume)
  }, 30000)

  it('peça sem solda: nenhum defeito e nenhum calor', () => {
    const peca = pecaEletrodo('cordao-chapa')
    const dep = new DepositoEletrodo(peca), reg = new RegistroPasse(300, 0.5)
    const r = inspecionarDefeitos(peca, dep, reg, analisarEletrodo(peca, dep, reg))
    expect(r.defeitos).toEqual([])
    expect(r.aporteMedioKJmm).toBe(0)
  })

  it('reabrir o arco começa outro passe: a volta por cima da emenda não soma calor', () => {
    const reg = new RegistroPasse(300, 0.5)
    const forma = { razao: 0.25, instabilidade: 0, energiaJ: 40, dtS: 1 / 60 }
    reg.inicioArco(50, 0, 0, false)
    for (let k = 0; k < 10; k++) reg.depositar(50, forma, k * 16)
    reg.fimArco(50, 0, 160, 'fim-da-vareta')
    reg.inicioArco(50, 0, 200, false)
    for (let k = 0; k < 10; k++) reg.depositar(50, forma, 200 + k * 16)
    const p = reg.aportePorPasse(reg.indiceEm(50))
    expect(p.passes).toBe(2)
    expect(p.max).toBeCloseTo(p.min, 6)
  })
})

describe('modos Fácil e Difícil da nota do eletrodo (H88)', () => {
  const nota = (id: string, t: Tecnica, modo: 'aprendiz' | 'profissional') => {
    const peca = pecaEletrodo(id)
    const { r, dep, m } = soldar(peca, t)
    const regras = MODOS_ELETRODO[modo]
    return avaliarEletrodo(peca, dep, m, regras.nivel, { preenchimentoCheio: regras.preenchimentoCheio, escoriaMax: regras.escoriaMax, descontoDefeitos: descontoDefeitos(modo, r.defeitos) })
  }

  it('desconto pelos defeitos: graves custam pouco no Fácil e muito no Difícil, sempre com teto', () => {
    const graves = [{ grave: true }, { grave: true }, { grave: true }, { grave: true }]
    const leves = [{ grave: false }, { grave: false }]
    expect(descontoDefeitos('aprendiz', [...graves, ...leves])).toBe(75)
    expect(descontoDefeitos('profissional', [...graves, ...leves])).toBe(300 + 30)
    expect(descontoDefeitos('profissional', [])).toBe(0)
  })

  it('a mesma solda nunca vale menos no Fácil; com falta de fusão, o Difícil cai bem mais', () => {
    for (const t of [bom, { ...bom, v: 6 }, { ...bom, passes: 3 }]) {
      expect(nota('t-estrutural', t, 'aprendiz').nota).toBeGreaterThanOrEqual(nota('t-estrutural', t, 'profissional').nota)
    }
    const facil = nota('t-estrutural', { ...bom, v: 6 }, 'aprendiz')
    const dificil = nota('t-estrutural', { ...bom, v: 6 }, 'profissional')
    expect(dificil.penalidadeDefeitos).toBeGreaterThanOrEqual(100)
    expect(facil.nota - dificil.nota).toBeGreaterThanOrEqual(50)
  }, 60000)

  it('sem ajuste, a nota é a mesma da v1.6 (nível C)', () => {
    const peca = pecaEletrodo('t-estrutural')
    const { dep, m } = soldar(peca, bom)
    expect(avaliarEletrodo(peca, dep, m, 'C', { preenchimentoCheio: 0.8, escoriaMax: 200, descontoDefeitos: 0 })).toEqual(avaliarEletrodo(peca, dep, m))
  }, 30000)
})
