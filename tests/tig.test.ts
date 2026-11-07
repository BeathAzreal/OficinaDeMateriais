import { describe, expect, it } from 'vitest'
import { ModeloTig, pedalDaPressao, TIG } from '../src/modelo/tig'
import { PECAS_TIG, comoPecaBase, pecaTig, type PecaTig } from '../src/missoes/pecasTig'
import { DepositoEletrodo } from '../src/modelo/depositoEletrodo'
import { analiseVisualTig, avaliarTig, inspecionarTig, niveisTig } from '../src/pontuacao/tig'
import { aprovacaoEletrodo } from '../src/pontuacao/eletrodo'

interface Jeito {
  fps?: number
  corrente?: number
  velocidade?: number
  distancia?: number
  /** Intervalo entre toques da vareta (s); 0 = sem vareta. */
  cadencia?: number
  toqueS?: number
  /** Espera a poça antes de andar. */
  esperarPoca?: boolean
  rampaFinal?: boolean
}

/** Soldador simulado: pedal cheio, avanço constante, toques de vareta no ritmo. */
function soldar(p: PecaTig, j: Jeito = {}) {
  const fps = j.fps ?? 60, dt = 1 / fps
  const m = new ModeloTig(p), dep = new DepositoEletrodo(comoPecaBase(p))
  m.correnteA = j.corrente ?? (p.correnteA.min + p.correnteA.max) / 2
  m.xMm = p.inicioMm - 2
  m.distanciaMm = j.distancia ?? 2.5
  m.pedal = 1
  const depositar = (x: number, y: number, v: number) => dep.depositar(x, y, v, 0, 0.25, 0, 0, m.larguraDepositoMm)
  let t = 0
  if (j.esperarPoca !== false) while (m.raioPocaMm < 1.5 && t < 5) { m.avancar(dt, depositar); t += dt }
  let andando = 0
  while (m.xMm < p.fimMm + 1 && t < 200) {
    m.xMm += (j.velocidade ?? 2) * dt
    andando += dt
    m.mergulhar = !!j.cadencia && andando % j.cadencia < (j.toqueS ?? 0.2)
    m.avancar(dt, depositar)
    t += dt
  }
  m.mergulhar = false
  if (j.rampaFinal !== false) for (let k = 0; k < fps; k++) { m.pedal = Math.max(0, 1 - k / fps); m.avancar(dt, depositar) }
  m.pedal = 0
  m.avancar(dt, depositar)
  return { m, dep, r: avaliarTig(p, m, dep, 'profissional') }
}

describe('TIG (H92): modelo de calor, poça e vareta', () => {
  it('sem pedal não há arco nem calor; com o tungstênio longe o arco não abre', () => {
    const m = new ModeloTig(PECAS_TIG[0])
    m.distanciaMm = 2
    m.avancar(1)
    expect(m.estado).toBe('pronto')
    expect(m.energiaJ).toBe(0)
    m.pedal = 1; m.distanciaMm = 7
    m.avancar(0.5)
    expect(m.estado).toBe('afastado')
    m.distanciaMm = 3
    m.avancar(1.5)
    expect(m.estado).toBe('arco')
    expect(m.raioPocaMm).toBeGreaterThan(1)
  })

  it('mais devagar alarga a poça; mais rápido estreita', () => {
    const p = pecaTig('tig-chapa')
    const largura = (v: number) => { const { m } = soldar(p, { velocidade: v }); return m.larguraFundida(75) }
    expect(largura(1)).toBeGreaterThan(largura(2))
    expect(largura(2)).toBeGreaterThan(largura(4))
  })

  it('a vareta só funde na poça: na chapa fria ela bate e conta como defeito', () => {
    const p = pecaTig('tig-chapa')
    const m = new ModeloTig(p)
    m.distanciaMm = 2.5
    m.mergulhar = true
    m.avancar(0.5)
    expect(m.varetaFria).toBe(1)
    expect(m.toques.length).toBe(0)
  })

  it('tungstênio na poça e vareta no tungstênio contaminam; afiar só com o arco apagado', () => {
    const p = pecaTig('tig-chapa')
    const m = new ModeloTig(p)
    m.pedal = 1; m.distanciaMm = 2
    m.avancar(1)
    m.distanciaMm = 0.2
    m.avancar(0.2)
    expect(m.contaminacoes).toBe(1)
    expect(m.contaminado).toBe(true)
    expect(m.afiar()).toBe(false)
    m.distanciaMm = 0.8; m.mergulhar = true
    m.avancar(0.3)
    expect(m.varetaNoTungstenio).toBe(1)
    m.pedal = 0; m.avancar(0.1)
    expect(m.afiar()).toBe(true)
    expect(m.contaminado).toBe(false)
  })

  it('corrente acima da faixa fura a chapa fina', () => {
    const p = pecaTig('tig-topo')
    expect(soldar(p, { cadencia: 0.7 }).m.furos.length).toBe(0)
    expect(soldar(p, { corrente: p.correnteA.max + 25, cadencia: 0.7 }).m.furos.length).toBeGreaterThan(0)
  })

  it('não depende da taxa de quadros', () => {
    const p = pecaTig('tig-chapa')
    const a = soldar(p, { fps: 30, cadencia: 0.7 }), b = soldar(p, { fps: 144, cadencia: 0.7 })
    expect(a.m.larguraFundida(75)).toBeCloseTo(b.m.larguraFundida(75), 0)
    expect(a.r.nota).toBeGreaterThan(b.r.nota - 120)
    expect(a.r.nota).toBeLessThan(b.r.nota + 120)
  })
})

describe('TIG (H102): a vareta funde no ritmo do jogador', () => {
  /** Avança um passo de uma vez (salto do mouse ou da caneta), toca a vareta 150 ms e espera o resto do ciclo. */
  function passoEToque(p: PecaTig, passoMm: number, esperaS: number) {
    const dt = 1 / 60
    const m = new ModeloTig(p), dep = new DepositoEletrodo(comoPecaBase(p))
    m.correnteA = (p.correnteA.min + p.correnteA.max) / 2
    m.xMm = p.inicioMm
    m.pedal = 1
    m.distanciaMm = 2.5
    let t = 0
    const depositar = (x: number, y: number, v: number) => dep.depositar(x, y, v, t * 1000, 0.25, 0, 0, m.larguraDepositoMm)
    const rodar = (s: number, mergulhar: boolean) => { m.mergulhar = mergulhar; for (let k = 0; k < s / dt; k++) { m.avancar(dt, depositar); t += dt } }
    rodar(2, false)
    while (m.xMm < p.fimMm) { m.xMm += passoMm; rodar(esperaS, false); rodar(0.15, true); rodar(0.55 - esperaS, false) }
    return { m, r: avaliarTig(p, m, dep, 'profissional') }
  }
  for (const p of PECAS_TIG) {
    it(`avançar 2 mm e tocar logo: a vareta vai à poça que ficou atrás e funde (${p.titulo})`, () => {
      const { m, r } = passoEToque(p, 2, 0)
      expect(m.varetaFria).toBe(0)
      expect(m.toques.length).toBeGreaterThan(30)
      // Reforço dentro da faixa da peça na maior parte do trecho.
      expect(r.itens[1].pontos).toBeGreaterThan(150)
    })
  }
  it('sem poça nenhuma, a vareta continua batendo na chapa fria', () => {
    const p = PECAS_TIG[0]
    const m = new ModeloTig(p)
    m.xMm = 75
    m.distanciaMm = 2.5
    m.mergulhar = true
    m.avancar(0.3)
    expect(m.varetaFria).toBe(1)
  })
})

describe('TIG (H92): nota de 0 a 1000', () => {
  for (const p of PECAS_TIG) {
    it(`soldador atento vai bem e é aprovado no Difícil: ${p.titulo}`, () => {
      const { m, dep, r } = soldar(p, { cadencia: 0.7, velocidade: p.junta === 't' ? 1.5 : 2 })
      expect(r.cobertura).toBeGreaterThan(0.9)
      expect(r.nota).toBeGreaterThan(600)
      expect(aprovacaoEletrodo(r, 'profissional').aprovada).toBe(true)
      expect(inspecionarTig(p, m, dep).filter((d) => d.grave)).toEqual([])
    })
  }

  it('sem vareta: fundiu, mas sem reforço e sem escamas', () => {
    const p = pecaTig('tig-chapa')
    const { m, dep, r } = soldar(p)
    expect(r.cobertura).toBeGreaterThan(0.9)
    expect(r.itens.find((i) => i.nome === 'Adição e reforço')!.pontos).toBe(0)
    expect(r.itens.find((i) => i.nome === 'Escamas regulares')!.pontos).toBe(0)
    expect(inspecionarTig(p, m, dep).map((d) => d.nome)).toContain('Pouco reforço')
  })

  it('andar rápido demais deixa falta de fusão e reprova no Difícil', () => {
    const p = pecaTig('tig-chapa')
    const { m, dep, r } = soldar(p, { velocidade: 9, cadencia: 0.7 })
    expect(r.cobertura).toBeLessThan(0.5)
    expect(aprovacaoEletrodo(r, 'profissional').aprovada).toBe(false)
    expect(inspecionarTig(p, m, dep).some((d) => d.nome === 'Falta de fusão' && d.grave)).toBe(true)
  })

  it('cortar o arco de uma vez deixa cratera; soltar o pedal devagar, não', () => {
    const p = pecaTig('tig-chapa')
    expect(soldar(p, { cadencia: 0.7, rampaFinal: false }).m.crateras.length).toBe(1)
    expect(soldar(p, { cadencia: 0.7 }).m.crateras.length).toBe(0)
  })

  it('sem arco a nota é zero', () => {
    const p = pecaTig('tig-chapa')
    const m = new ModeloTig(p)
    expect(avaliarTig(p, m, new DepositoEletrodo(comoPecaBase(p)), 'aprendiz').nota).toBe(0)
  })

  it('pressão da caneta vira pedal: toque leve não acende, pedal cheio antes do fundo', () => {
    expect(pedalDaPressao(0)).toBe(0)
    expect(pedalDaPressao(0.05)).toBe(0)
    expect(pedalDaPressao(0.35)).toBeCloseTo(0.5)
    expect(pedalDaPressao(0.65)).toBe(1)
    expect(pedalDaPressao(1)).toBe(1)
  })

  it('a vareta acaba e precisa de uma nova', () => {
    const m = new ModeloTig(PECAS_TIG[0])
    expect(m.varetaRestanteMm).toBe(TIG.varetaInicialMm)
    m.varetaRestanteMm = 0
    m.novaVareta()
    expect(m.varetaRestanteMm).toBe(TIG.varetaInicialMm)
  })
})

describe('TIG (H94): passar da chapa em níveis', () => {
  const soldarP = (p: PecaTig, j: Jeito) => ({ ...soldar(p, j), p })
  const nomes = (r: ReturnType<typeof soldarP>) => inspecionarTig(r.p, r.m, r.dep).map((d) => d.nome)
  it('no ritmo certo: só a raiz aparente, sem defeito', () => {
    const r = soldarP(pecaTig('tig-chapa'), { cadencia: 0.7, corrente: 90 })
    expect(niveisTig(r.p, r.m, 75).penduradoMm).toBeGreaterThan(0)
    expect(nomes(r)).not.toContain('Penetração excessiva')
    expect(nomes(r)).not.toContain('Raiz afundada')
  })
  it('mais corrente na chapa fina: o metal passa e pendura (sem furo), depois a chapa vara', () => {
    const p = pecaTig('tig-topo')
    const passes = [57.5, 70, 80, 95].map((corrente) => soldarP(p, { cadencia: 0.7, corrente }))
    for (let k = 1; k < passes.length; k++) {
      expect(niveisTig(p, passes[k].m, 75).penduradoMm).toBeGreaterThanOrEqual(niveisTig(p, passes[k - 1].m, 75).penduradoMm)
      expect(niveisTig(p, passes[k].m, 75).afundamento).toBeGreaterThanOrEqual(niveisTig(p, passes[k - 1].m, 75).afundamento)
    }
    expect(nomes(passes[0]).filter((n) => /Penetração|Raiz|Furo/.test(n))).toEqual([])
    expect(nomes(passes[2])).toContain('Penetração excessiva')
    expect(passes[2].m.furos.length).toBe(0)
    expect(passes[2].r.penalidadeNiveis).toBeGreaterThan(0)
    expect(passes[3].m.furos.length).toBeGreaterThan(0)
    const a = analiseVisualTig(p, passes[3].m, 300, 0.5)
    expect(Math.max(...a.furoMm)).toBeGreaterThan(0)
    expect(Math.max(...a.penetracaoMm)).toBeGreaterThan(1)
  })
  it('no T não há avesso livre: só o furo conta', () => {
    const r = soldarP(pecaTig('tig-t'), { cadencia: 0.7, corrente: 150, velocidade: 0.8 })
    expect(niveisTig(r.p, r.m, 75).penduradoMm).toBe(0)
    expect(niveisTig(r.p, r.m, 75).afundamento).toBe(0)
  })
})

