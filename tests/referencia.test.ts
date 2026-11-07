import { describe, expect, it } from 'vitest'
import { compactar } from '../src/dados/eventos'
import { contextoDaMissao, MISSOES, validarPreparo, type Preparo } from '../src/missoes/catalogo'
import { analisarFusao } from '../src/modelo/fusao'
import { MATERIAIS } from '../src/modelo/material'
import { DBCP, MODELO } from '../src/modelo/parametros'
import {
  correnteRelativa,
  dbcpDe,
  potenciaRelativa,
  razaoEfetiva,
  taxaDeposicao,
  volumeArameRelativo,
  type Ajustes,
  type ContextoProcesso,
} from '../src/modelo/processo'
import { reproduzir } from '../src/modelo/replay'
import { Simulacao } from '../src/modelo/simulacao'
import { pontuarRegistro, relatorioDoRegistro } from '../src/pontuacao/oficial'
import { pontuar } from '../src/pontuacao/regras'
import { relatorioTecnico } from '../src/pontuacao/relatorio'

/*
 * CASO DE REFERÊNCIA (docs/HIPOTESES.md, "Caso de referência"):
 * MIG/MAG, aço de baixo carbono 3,0 mm, junta de topo reto com abertura de
 * 1,0 mm, posição plana; arame de 1,0 mm, argônio + CO₂, técnica neutra,
 * DBCP 15 mm; tensão 5,5 e alimentação 5 (botões); passe reto de 10 a
 * 140 mm a 10 mm/s. Sobre ele se conferem as tendências; as outras juntas,
 * materiais e posições continuam cobertos pelos testes de cada área.
 */
const MISSAO = MISSOES.find((m) => m.id === 'suporte-carbono')!
const PREPARO: Preparo = { diametroArameMm: 1, gas: 'ar-co2', oxidoRemovido: true, tecnica: 'neutra', dbcpMm: 15 }
const AJUSTES: Ajustes = { alimentacao: 5, tensao: 5.5 }
const ctxRef = (mudar: Partial<Preparo> = {}): ContextoProcesso => contextoDaMissao(MISSAO, { ...PREPARO, ...mudar })

/** Passe reto com leituras a cada 8 ms; `quadros` chama avancarTempo como o laço da tela. */
/** v1.8 (H87): velocidades na metade das de antes (a física foi desacelerada). */
function passe(ctx: ContextoProcesso, ajustes: Ajustes = AJUSTES, v = 5, op: { x0?: number; x1?: number; y?: number; quadrosMs?: number } = {}) {
  const sim = new Simulacao(ctx)
  sim.definirAjustes(ajustes)
  const x0 = op.x0 ?? MISSAO.trecho.inicioMm - 4
  const x1 = op.x1 ?? MISSAO.trecho.fimMm + 3
  const y = op.y ?? 0
  let t = 1000
  let x = x0
  sim.iniciarArco({ t, x, y })
  let proximoQuadro = t
  while (x < x1) {
    t += 8
    x = Math.min(x1, x + v * 0.008)
    sim.moverTocha({ t, x, y })
    if (op.quadrosMs) while (proximoQuadro + op.quadrosMs <= t) sim.avancarTempo((proximoQuadro += op.quadrosMs))
  }
  sim.encerrarArco({ t, x, y })
  return { sim, t }
}

const indiceMedio = (sim: Simulacao, ctx: ContextoProcesso) => {
  const pts = analisarFusao(sim.cordao, sim.percurso, ctx).filter((p) => p.xMm > 30 && p.xMm < 120)
  return pts.reduce((s, p) => s + p.indice, 0) / pts.length
}
const larguraMedia = (sim: Simulacao) => {
  let soma = 0
  let n = 0
  for (let i = 0; i < sim.cordao.nPosicoes; i++) {
    const s = sim.cordao.secao(i)
    if (s.xMm > 30 && s.xMm < 120) {
      soma += s.larguraMm
      n++
    }
  }
  return soma / n
}

describe('caso de referência: o que cada ajuste muda (e o que não muda)', () => {
  it('na referência, metal, corrente e potência relativos valem 1 (calibração)', () => {
    const ctx = ctxRef()
    expect(volumeArameRelativo(AJUSTES, ctx)).toBeCloseTo(1, 12)
    expect(correnteRelativa(AJUSTES, ctx)).toBeCloseTo(1, 12)
    expect(potenciaRelativa(AJUSTES, ctx)).toBeCloseTo(1, 12)
    expect(taxaDeposicao(AJUSTES, ctx)).toBeCloseTo(MODELO.taxaDeposicaoMm3s, 9)
  })

  it('alimentação: o metal cresce na proporção; a corrente cresce menos (relação de fusão do arame, H48)', () => {
    const ctx = ctxRef()
    const dobro = { ...AJUSTES, alimentacao: 10 }
    expect(taxaDeposicao(dobro, ctx) / taxaDeposicao(AJUSTES, ctx)).toBeCloseTo(2, 12)
    const i = correnteRelativa(dobro, ctx)
    expect(i).toBeGreaterThan(1)
    expect(i).toBeLessThan(2)
  })

  it('tensão: não muda metal nem corrente; muda a forma (mais achatado) e a potência', () => {
    const ctx = ctxRef()
    const alta = { ...AJUSTES, tensao: 8 }
    expect(taxaDeposicao(alta, ctx)).toBe(taxaDeposicao(AJUSTES, ctx))
    expect(correnteRelativa(alta, ctx)).toBe(correnteRelativa(AJUSTES, ctx))
    expect(razaoEfetiva(alta, ctx)).toBeLessThan(razaoEfetiva(AJUSTES, ctx))
    expect(potenciaRelativa(alta, ctx)).toBeGreaterThan(potenciaRelativa(AJUSTES, ctx))
  })

  it('DBCP maior: mesmo metal, menos corrente e menos fusão no mesmo passe (H48)', () => {
    const perto = ctxRef({ dbcpMm: 10 })
    const longe = ctxRef({ dbcpMm: 20 })
    expect(taxaDeposicao(AJUSTES, perto)).toBe(taxaDeposicao(AJUSTES, longe))
    expect(correnteRelativa(AJUSTES, perto)).toBeGreaterThan(1)
    expect(correnteRelativa(AJUSTES, longe)).toBeLessThan(1)
    const a = passe(perto).sim
    const b = passe(longe).sim
    expect(a.cordao.volumeTotal()).toBeCloseTo(b.cordao.volumeTotal(), 6)
    expect(indiceMedio(a, perto)).toBeGreaterThan(indiceMedio(b, longe))
  })

  it('arame mais grosso com a mesma alimentação: mais metal e mais corrente', () => {
    const fino = ctxRef({ diametroArameMm: 0.8 })
    const grosso = ctxRef({ diametroArameMm: 1.2 })
    expect(taxaDeposicao(AJUSTES, grosso)).toBeGreaterThan(taxaDeposicao(AJUSTES, fino))
    expect(correnteRelativa(AJUSTES, grosso)).toBeGreaterThan(correnteRelativa(AJUSTES, fino))
  })

  it('velocidade maior: cordão mais estreito e menos fusão por mm', () => {
    const ctx = ctxRef()
    const devagar = passe(ctx, AJUSTES, 4).sim
    const rapido = passe(ctx, AJUSTES, 7).sim
    expect(larguraMedia(rapido)).toBeLessThan(larguraMedia(devagar))
    expect(indiceMedio(rapido, ctx)).toBeLessThan(indiceMedio(devagar, ctx))
  })

  it('puxando funde mais que empurrando no mesmo passe, com o mesmo metal (H38)', () => {
    const puxando = ctxRef({ tecnica: 'puxando' })
    const empurrando = ctxRef({ tecnica: 'empurrando' })
    const a = passe(puxando).sim
    const b = passe(empurrando).sim
    expect(a.cordao.volumeTotal()).toBeCloseTo(b.cordao.volumeTotal(), 6)
    expect(indiceMedio(a, puxando)).toBeGreaterThan(indiceMedio(b, empurrando))
  })

  it('o passe de referência é aprovado na missão de referência', () => {
    const ctx = ctxRef()
    const { sim } = passe(ctx)
    const r = pontuar({ missao: MISSAO, dificuldade: 'aprendiz', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs })
    expect(r.aprovada).toBe(true)
  })
})

describe('conservação, tempo e pausa', () => {
  it('todo o metal que sai sobre a peça fica no cordão: volume = taxa × tempo de arco', () => {
    const ctx = ctxRef()
    const { sim } = passe(ctx)
    expect(sim.cordao.volumeTotal()).toBeCloseTo((taxaDeposicao(AJUSTES, ctx) * sim.tempoDeArcoMs) / 1000, 6)
  })

  it('tocha parada com o arco aberto continua depositando e aquecendo', () => {
    const ctx = ctxRef()
    const sim = new Simulacao(ctx)
    sim.definirAjustes(AJUSTES)
    sim.iniciarArco({ t: 0, x: 75, y: 0 })
    sim.avancarTempo(1000)
    const q1 = sim.estado(1000).aquecimento
    sim.avancarTempo(2050)
    // Consolidado até 2050 − 50 ms (a leitura que ainda pode chegar, H5): 2 s de metal no mesmo lugar.
    expect(sim.tempoDeArcoMs).toBeCloseTo(2000, 6)
    expect(sim.cordao.volumeTotal()).toBeCloseTo(2 * taxaDeposicao(AJUSTES, ctx), 6)
    expect(q1).toBeGreaterThan(0)
    expect(sim.estado(2050).aquecimento).toBeGreaterThan(q1)
  })

  it('pausa (interromperArco) não transforma o tempo parado em solda; encerrar com o relógio transformaria', () => {
    const ctx = ctxRef()
    const montar = () => {
      const sim = new Simulacao(ctx)
      sim.definirAjustes(AJUSTES)
      sim.iniciarArco({ t: 0, x: 75, y: 0 })
      sim.avancarTempo(500)
      return sim
    }
    const pausado = montar()
    pausado.interromperArco()
    const fechadoTarde = montar()
    fechadoTarde.encerrarArco({ t: 5500, x: 75, y: 0 })
    expect(pausado.arcoAberto).toBe(false)
    // Só o que já estava consolidado (450 ms) virou metal.
    expect(pausado.tempoDeArcoMs).toBeCloseTo(450, 6)
    expect(fechadoTarde.tempoDeArcoMs).toBeCloseTo(5500, 6)
    // E o registro da pausa reproduz a mesma coisa.
    expect(reproduzir(ctx, pausado.eventos).cordao.volumeTotal()).toBeCloseTo(pausado.cordao.volumeTotal(), 9)
  })

  it('arco aberto fora da peça conta tempo de arco, mas não deposita nem aquece a peça', () => {
    const ctx = ctxRef()
    const sim = new Simulacao(ctx)
    sim.definirAjustes(AJUSTES)
    sim.iniciarArco({ t: 0, x: -20, y: 0 })
    sim.avancarTempo(3000)
    expect(sim.tempoDeArcoMs).toBeGreaterThan(2900)
    expect(sim.cordao.volumeTotal()).toBe(0)
    expect(sim.estado(3000).aquecimento).toBe(0)
  })

  it('o mesmo gesto dá o mesmo cordão e o mesmo aquecimento a 30, 60 e 144 quadros/s', () => {
    const ctx = ctxRef()
    const ref = passe(ctx, AJUSTES, 5, { quadrosMs: 1000 / 30 }).sim
    for (const fps of [60, 144]) {
      const s = passe(ctx, AJUSTES, 5, { quadrosMs: 1000 / fps }).sim
      expect(s.cordao.volumeTotal()).toBeCloseTo(ref.cordao.volumeTotal(), 6)
      expect(Array.from(s.percurso.copiaDosAportesEfetivos())).toEqual(Array.from(ref.percurso.copiaDosAportesEfetivos()).map((v) => expect.closeTo(v, 9)))
    }
  })
})

describe('limites e entradas inválidas', () => {
  it('DBCP fora da faixa do jogo volta à referência; a bancada só aceita as opções', () => {
    expect(dbcpDe({ ...ctxRef(), dbcpMm: 100 })).toBe(DBCP.referenciaMm)
    expect(dbcpDe({ ...ctxRef(), dbcpMm: Number.NaN })).toBe(DBCP.referenciaMm)
    const { dbcpMm: _ignorado, ...semDbcp } = ctxRef()
    expect(dbcpDe(semDbcp)).toBe(DBCP.referenciaMm)
    expect(validarPreparo(MISSAO, { ...PREPARO, dbcpMm: 13 })).toHaveLength(1)
    for (const mm of DBCP.opcoesMm) expect(validarPreparo(MISSAO, { ...PREPARO, dbcpMm: mm })).toEqual([])
  })

  it('preparo antigo (sem DBCP) dá o mesmo resultado que DBCP 15 mm', () => {
    const { dbcpMm: _ignorado, ...antigo } = PREPARO
    const a = passe(contextoDaMissao(MISSAO, antigo)).sim
    const b = passe(ctxRef()).sim
    expect(Array.from(a.percurso.copiaDosAportesEfetivos())).toEqual(Array.from(b.percurso.copiaDosAportesEfetivos()))
  })
})

describe('nota, replay e relatório técnico', () => {
  it('o mesmo registro dá sempre a mesma nota e o mesmo relatório; o ao vivo coincide com o replay', () => {
    const ctx = ctxRef({ tecnica: 'puxando', dbcpMm: 10 })
    const { sim } = passe(ctx, { alimentacao: 6, tensao: 6.5 }, 5.5, { quadrosMs: 16.7 })
    const ao_vivo = pontuar({ missao: MISSAO, dificuldade: 'aprendiz', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs })
    const registro = compactar(sim.eventos)
    const a = relatorioDoRegistro(MISSAO, 'aprendiz', ctx, registro)
    const b = relatorioDoRegistro(MISSAO, 'aprendiz', ctx, registro)
    expect(a.resultado.total).toBe(ao_vivo.total)
    expect(a.resultado).toEqual(b.resultado)
    expect(a.relatorio).toEqual(b.relatorio)
    expect(pontuarRegistro(MISSAO, 'aprendiz', ctx, registro).resultado.total).toBe(a.resultado.total)
  })

  it('o relatório traz regulagem, trechos, ocorrências e consumo coerentes com a nota', () => {
    const ctx = ctxRef()
    // Passe com um buraco no meio (arco fechado de 60 a 80 mm) e um trecho lento (80 a 95 mm).
    const sim = new Simulacao(ctx)
    sim.definirAjustes(AJUSTES)
    let t = 0
    const andar = (x0: number, x1: number, v: number) => {
      sim.iniciarArco({ t, x: x0, y: 0 })
      for (let x = x0; x < x1; ) {
        t += 8
        x = Math.min(x1, x + v * 0.008)
        sim.moverTocha({ t, x, y: 0 })
      }
      sim.encerrarArco({ t, x: x1, y: 0 })
    }
    andar(6, 60, 5)
    andar(80, 95, 2)
    andar(95, 143, 5)
    const resultado = pontuar({ missao: MISSAO, dificuldade: 'aprendiz', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs })
    const r = relatorioTecnico({ missao: MISSAO, dificuldade: 'aprendiz', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, eventos: sim.eventos, tempoArcoMs: sim.tempoDeArcoMs, resultado })
    expect(r.versaoPontuacao).toBe('pontuacao-v11')
    expect(r.preparo).toMatchObject({ dbcpMm: 15, tecnica: 'neutra', anguloAvancoGraus: 0, junta: 'topo' })
    expect(r.regulagens).toHaveLength(1)
    expect(r.regulagens[0].correnteRelativa).toBeCloseTo(1, 9)
    expect(r.regulagens[0].arco.condicao).toBe('equilibrado')
    expect(r.posicoes.map((p) => p.codigo)).toEqual(['plana'])
    expect(r.consumo.aberturasDeArco).toBe(3)
    // Trechos cobrem o pedido, de 10 em 10 mm.
    expect(r.trechos[0].inicioMm).toBe(MISSAO.trecho.inicioMm)
    expect(r.trechos[r.trechos.length - 1].fimMm).toBe(MISSAO.trecho.fimMm)
    // O buraco aparece como ocorrência localizada; o trecho lento, como fator (velocidade relativa baixa), não como causa única.
    const buraco = r.ocorrencias.find((o) => o.tipo === 'sem-cordao')!
    expect(buraco.inicioMm).toBeGreaterThan(59)
    expect(buraco.fimMm).toBeLessThan(82)
    const lento = r.trechos.find((tr) => tr.inicioMm === 80)!
    expect(lento.fatores.velocidadeRelativa!).toBeLessThan(0.6)
    expect(lento.observacao.larguraMediaMm).toBeGreaterThan(r.trechos[1].observacao.larguraMediaMm)
    // Consumo: arame = metal ÷ rendimento ÷ seção do arame.
    expect(r.consumo.arameConsumidoMm).toBeCloseTo(r.consumo.metalDepositadoMm3 / (Math.PI / 4), 6)
    expect(r.limitacoes.length).toBeGreaterThan(3)
    expect(MATERIAIS[ctx.material].id).toBe('aco-carbono')
  })

  it('pontuacao-v10: escala 0–1000; um buraco no cordão perde na extensão, não de novo na largura', () => {
    const ctx = ctxRef()
    const sim = new Simulacao(ctx)
    sim.definirAjustes(AJUSTES)
    let t = 0
    for (const [x0, x1] of [[6, 60], [80, 143]] as const) {
      sim.iniciarArco({ t, x: x0, y: 0 })
      for (let x: number = x0; x < x1; ) {
        t += 8
        x = Math.min(x1, x + 5 * 0.008)
        sim.moverTocha({ t, x, y: 0 })
      }
      sim.encerrarArco({ t, x: x1, y: 0 })
    }
    const r = pontuar({ missao: MISSAO, dificuldade: 'aprendiz', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs, aberturasDeArco: 2 })
    expect(r.versao).toBe('pontuacao-v11')
    expect(r.categorias.reduce((s, c) => s + c.maximo, 0)).toBe(1000)
    const desenho = r.categorias.find((c) => c.id === 'desenho')!
    const pct = (rotulo: string) => Number.parseInt(desenho.detalhes.find((d) => d.rotulo === rotulo)!.valor, 10)
    expect(r.problemas.some((p) => p.estado === 'sem-cordao')).toBe(true)
    expect(pct('Extensão')).toBeLessThan(95)
    // A largura só avalia o cordão que existe: só as pontas que afinam perto do buraco perdem um pouco.
    expect(pct('Largura')).toBeGreaterThanOrEqual(85)
    expect(r.medidas.reiniciosArco).toBe(1)
  })

  it('pontuacao-v10: nota graduada — um pouco fora da faixa perde pouco, muito fora perde tudo', () => {
    const ctx = ctxRef()
    const notaLargura = (v: number) => {
      const { sim } = passe(ctx, AJUSTES, v)
      const r = pontuar({ missao: MISSAO, dificuldade: 'profissional', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs })
      return { r, largura: r.medidas.larguraMediaMm, nota: Number.parseInt(r.categorias.find((c) => c.id === 'desenho')!.detalhes.find((d) => d.rotulo === 'Largura')!.valor, 10) }
    }
    const certo = notaLargura(5)
    const largo = notaLargura(2.75)
    const muitoLargo = notaLargura(1.75)
    expect(certo.nota).toBe(100)
    expect(largo.largura).toBeGreaterThan(9.5)
    expect(largo.nota).toBeLessThan(certo.nota)
    expect(largo.nota).toBeGreaterThan(muitoLargo.nota)
    expect(muitoLargo.nota).toBe(0)
  })

  it('pontuacao-v10: Fácil sem aprovação; Difícil pede 20 % em cada categoria; desafios e História, 40 % (H90)', () => {
    const ctx = ctxRef()
    for (const v of [5, 3.25, 1.75, 1.2]) {
      const { sim } = passe(ctx, AJUSTES, v)
      const nota = (dificuldade: 'aprendiz' | 'profissional', exigencia?: number) =>
        pontuar({ missao: MISSAO, dificuldade, contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs, exigencia })
      const facil = nota('aprendiz')
      expect(facil.exigencia).toBeNull()
      expect(facil.essenciais).toEqual([])
      expect(facil.aprovada).toBe(true)
      for (const [r, minimo] of [[nota('profissional'), 0.2], [nota('profissional', 0.4), 0.4]] as const) {
        expect(r.exigencia).toBe(minimo)
        expect(r.essenciais.map((e) => e.id)).toEqual(r.categorias.map((c) => c.id))
        expect(r.aprovada).toBe(r.categorias.every((c) => c.pontos >= minimo * c.maximo))
      }
    }
    // Passe bom: aprovado no Difícil; passe muito lento: alguma categoria fica abaixo de 40 %.
    const bom = passe(ctx, AJUSTES, 5).sim
    expect(pontuar({ missao: MISSAO, dificuldade: 'profissional', contexto: ctx, cordao: bom.cordao, percurso: bom.percurso, tempoArcoMs: bom.tempoDeArcoMs }).aprovada).toBe(true)
    const lento = passe(ctx, AJUSTES, 1.2).sim
    expect(pontuar({ missao: MISSAO, dificuldade: 'profissional', contexto: ctx, cordao: lento.cordao, percurso: lento.percurso, tempoArcoMs: lento.tempoDeArcoMs, exigencia: 0.4 }).aprovada).toBe(false)
  })

  it('pontuacao-v10: sem trava (H89) — condição essencial descumprida não zera categorias nem limita o conceito', async () => {
    const { conceito } = await import('../src/ui/componentes/pontuacao')
    const ctx = ctxRef()
    // Devagar demais: fusão excessiva no trecho, a integridade mínima não é atingida.
    const { sim } = passe(ctx, AJUSTES, 1.5)
    const r = pontuar({ missao: MISSAO, dificuldade: 'profissional', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs })
    expect(r.aprovada).toBe(false)
    expect(r.penalidades).toEqual([])
    expect(r.total).toBe(r.categorias.reduce((s, c) => s + c.pontos, 0))
    expect(conceito(900, false)).toBe('A')
    expect(conceito(960, false)).toBe('S')
  })

  it('pontuacao-v10: Fácil tem faixas mais largas que Difícil; a mesma solda nunca vale menos no Fácil (H88)', () => {
    const ctx = ctxRef()
    for (const v of [7, 6, 5, 4, 3.25, 2.75, 2.25, 1.75]) {
      const { sim } = passe(ctx, AJUSTES, v)
      const nota = (dificuldade: 'aprendiz' | 'profissional') =>
        pontuar({ missao: MISSAO, dificuldade, contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs })
      expect(nota('aprendiz').total).toBeGreaterThanOrEqual(nota('profissional').total)
    }
    const { sim } = passe(ctx, AJUSTES, 2.75)
    const facil = pontuar({ missao: MISSAO, dificuldade: 'aprendiz', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs })
    const dificil = pontuar({ missao: MISSAO, dificuldade: 'profissional', contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs })
    expect(facil.total).toBeGreaterThan(dificil.total + 80)
  })

  it('pontuacao-v10: reinícios de arco e metal fora do trecho baixam a Execução', () => {
    const ctx = ctxRef()
    const { sim } = passe(ctx)
    const base = { missao: MISSAO, dificuldade: 'aprendiz' as const, contexto: ctx, cordao: sim.cordao, percurso: sim.percurso, tempoArcoMs: sim.tempoDeArcoMs }
    const execucao = (aberturas: number) => pontuar({ ...base, aberturasDeArco: aberturas }).categorias.find((c) => c.id === 'eficiencia')!.pontos
    expect(execucao(1)).toBeGreaterThan(execucao(2))
    expect(execucao(2)).toBeGreaterThan(execucao(4))
    // Passe que avança 30 mm além do FIM: mais metal fora do trecho.
    const alem = passe(ctx, AJUSTES, 5, { x1: MISSAO.trecho.fimMm + 30 }).sim
    const r = pontuar({ ...base, cordao: alem.cordao, percurso: alem.percurso, tempoArcoMs: alem.tempoDeArcoMs })
    expect(r.medidas.aproveitamentoMetal!).toBeLessThan(pontuar(base).medidas.aproveitamentoMetal!)
  })
})
