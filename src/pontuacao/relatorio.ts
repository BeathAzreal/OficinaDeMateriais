import type { Cordao } from '../modelo/cordao'
import { analisarDefeitos, type OcorrenciaDefeito } from '../modelo/defeitos'
import { analisarFusao, aporteNecessario, margemCoberturaBordas, type EstadoFusao, type PontoFusao } from '../modelo/fusao'
import { gravidade, juntaDe, NOME_POSICAO, posicaoDe, type CodigoPosicao } from '../modelo/juntas'
import { GASES } from '../modelo/material'
import { DBCP } from '../modelo/parametros'
import type { Percurso } from '../modelo/percurso'
import {
  correnteRelativa,
  dbcpDe,
  equilibrioArco,
  INFO_TECNICA,
  potenciaRelativa,
  razaoEfetiva,
  taxaDeposicao,
  tecnicaDe,
  volumeArameRelativo,
  type Ajustes,
  type CondicaoArco,
  type ContextoProcesso,
} from '../modelo/processo'
import type { EventoTentativa } from '../modelo/simulacao'
import { requisitosEfetivos, type Dificuldade, type Missao } from '../missoes/catalogo'
import { VERSAO_PONTUACAO, type ResultadoPontuacao } from './regras'

/*
 * Relatório técnico ESTRUTURADO de uma tentativa (Alpha v1.3), para a
 * didática (textos e explicações ficam com quem consome este relatório).
 * Só números e códigos: nada de frases prontas. Três tipos de informação
 * ficam separados de propósito:
 *   - observação: o que o modelo calculou no cordão (largura, altura…);
 *   - fator: grandezas de processo calculadas no mesmo trecho que podem
 *     explicar a observação (permanência, aporte, ajustes…), SEM escolher
 *     uma causa única;
 *   - limitação: o que o modelo não permite concluir.
 * É uma função pura do mesmo registro que gera a nota (replay): o mesmo
 * registro dá o mesmo relatório. Versão própria em VERSAO_RELATORIO.
 */

export const VERSAO_RELATORIO = 'relatorio-tecnico-v2'

/** Tamanho dos trechos do relatório (mm). */
export const TRECHO_RELATORIO_MM = 10

export interface RegulagemUsada {
  ajustes: Ajustes
  /** Volume de arame por segundo, relativo (1 = alimentação 5 com arame 1,0 mm), H1. */
  volumeArameRelativo: number
  /** Metal depositado por segundo (mm³/s do jogo), H1 + H29. */
  metalMm3s: number
  /** Corrente relativa (H28 revista, H48). */
  correnteRelativa: number
  /** Potência relativa do arco = corrente × tensão relativas (H31). */
  potenciaRelativa: number
  /** Altura ÷ largura da seção (forma, H9 + H38). */
  razaoForma: number
  /** Estabilidade do arco (H10, H44). */
  arco: { condicao: CondicaoArco; desvioPontos: number }
}

export interface TrechoRelatorio {
  inicioMm: number
  fimMm: number
  /** Observação: medidas do cordão no trecho (médias onde há cordão). */
  observacao: {
    fracaoComCordao: number
    larguraMediaMm: number
    alturaMediaMm: number
    centroMedioMm: number
    areaMediaMm2: number
    /** Índice de fusão sintético médio (H33). */
    indiceFusaoMedio: number
    estadoPredominante: EstadoFusao
  }
  /** Fatores calculados no trecho (não são "a causa"; podem agir juntos). */
  fatores: {
    /** Velocidade efetiva = comprimento ÷ tempo de arco no trecho (mm/s); null se o arco não passou. */
    velocidadeEfetivaMms: number | null
    /** Velocidade efetiva ÷ mediana dos trechos desta tentativa (1 = típica). */
    velocidadeRelativa: number | null
    /** Aporte relativo por mm ÷ aporte necessário para fundir a espessura (H33). */
    aporteRelativoNecessario: number
    /** Desvio médio da tocha em relação à linha da junta (mm). */
    desvioMedioMm: number
  }
  /** Desvios em relação ao pedido (frações do trecho com cordão). */
  desvios: { larguraAbaixo: number; larguraAcima: number; reforcoAcima: number; foraDoAlinhamento: number }
}

export type TipoOcorrencia = Exclude<EstadoFusao, 'adequada'>

export interface Ocorrencia {
  tipo: TipoOcorrencia
  inicioMm: number
  fimMm: number
  comprimentoMm: number
  /** Grandeza que decide a ocorrência, com o limiar usado (critério do jogo). */
  magnitude: { grandeza: string; valor: number; limiar: number }
  /** Regra que faz a ocorrência aparecer (código e regra do modelo). */
  condicao: string
  /** O que a previsão NÃO permite concluir. */
  limitacao: string
}

export interface RelatorioTecnico {
  versaoRelatorio: string
  versaoPontuacao: string
  preparo: {
    materialId: string
    espessuraMm: number
    aberturaMm: number
    junta: string
    diametroArameMm: number
    gas: string
    tecnica: string
    anguloAvancoGraus: number
    dbcpMm: number
    oxidoRemovido: boolean
  }
  /** Uma entrada por regulagem usada com o arco aberto, na ordem. */
  regulagens: RegulagemUsada[]
  /** Posições de soldagem usadas com o arco aberto (H47). */
  posicoes: { codigo: CodigoPosicao; nome: string; rolagemGraus: number; giroGraus: number }[]
  trechos: TrechoRelatorio[]
  ocorrencias: Ocorrencia[]
  consumo: {
    tempoArcoS: number
    /** Fração do tempo de arco com a tocha perto da junta, no trecho pedido (eficiência). */
    fracaoTempoSobreJunta: number
    aberturasDeArco: number
    /** Metal no cordão (mm³ do jogo). */
    metalDepositadoMm3: number
    /** Metal dentro do trecho pedido (mm³). */
    metalNoTrechoMm3: number
    /**
     * Arame correspondente ao metal que ficou na peça, somando o que o gás não
     * aproveitou (H29), em mm de arame. Arco aberto fora da peça não entra.
     */
    arameConsumidoMm: number
  }
  /** Índices sintéticos globais (H33, H36). */
  indices: { fracaoIntegra: number; deformacao: number }
  /**
   * Defeitos visíveis previstos (v2, H50–H57): tipo, trecho, maior valor e
   * limiar do jogo. Os textos (nome, causa, correção) ficam com quem exibe;
   * defeitos.ts tem NOME_DEFEITO e CONSELHO_DEFEITO de base.
   */
  defeitos: { ocorrencias: OcorrenciaDefeito[]; respingos: number; poros: number; gotas: number; empenoGraus: number }
  /** Limitações gerais do modelo (códigos estáveis). */
  limitacoes: string[]
}

const LIMITACOES_GERAIS = [
  'modelo-qualitativo: números do jogo; tendências, não valores de processo',
  'sem-penetracao-real: a fusão é um índice sintético, não profundidade medida',
  'defeitos-por-regra: porosidade, mordedura e afins são previstos por regras do jogo; trincas e inclusões não são calculadas',
  'aparencia-nao-indica-qualidade: o cordão desenhado não mostra qualidade interna',
  'arco-nao-modelado: comprimento do arco e transferência metálica não são calculados',
  'sem-qualificacao: não substitui ensaio, procedimento qualificado nem prática supervisionada',
]

const CONDICAO: Record<TipoOcorrencia, { grandeza: string; condicao: string; limitacao: string }> = {
  'sem-cordao': { grandeza: 'largura (mm)', condicao: 'H14: largura abaixo de 1 mm', limitacao: 'Só diz que não há metal depositado ali.' },
  perfuracao: { grandeza: 'índice de fusão', condicao: 'H33: índice acima do limiar de perfuração', limitacao: 'Previsão sintética de calor demais; não simula o furo nem a poça escorrendo.' },
  enchimento: { grandeza: 'enchimento da junta', condicao: 'H46 (V) ou H18 revista (fresta do topo): metal menor que a área a encher', limitacao: 'Supõe a junta cheia por igual; não modela passes separados nem penetração.' },
  borda: { grandeza: 'margem de cobertura (mm)', condicao: 'H34 (topo) ou H46 (filete): o cordão não cobre as duas bordas', limitacao: 'Cobertura vista na face; não diz se as bordas fundiram em profundidade.' },
  falta: { grandeza: 'índice de fusão', condicao: 'H33: índice abaixo do mínimo adequado', limitacao: 'Previsão sintética; não mede a penetração.' },
  excessiva: { grandeza: 'índice de fusão', condicao: 'H33: índice acima do máximo adequado', limitacao: 'Previsão sintética de calor além do necessário.' },
}

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0)

/** Regulagens e posições realmente usadas com o arco aberto, na ordem dos eventos. */
function usosDoRegistro(eventos: readonly EventoTentativa[], ctx: ContextoProcesso): { ajustes: Ajustes[]; posicoes: RelatorioTecnico['posicoes']; aberturas: number } {
  let ajustes: Ajustes | null = null
  let posicao = ctx.posicaoInicial ?? { rolagemGraus: 0, giroGraus: 0 }
  const usados: Ajustes[] = []
  const posicoes: RelatorioTecnico['posicoes'] = []
  let aberturas = 0
  for (const e of eventos) {
    if (e.tipo === 'ajustes') ajustes = e.ajustes
    else if (e.tipo === 'posicao') posicao = { rolagemGraus: e.rolagemGraus, giroGraus: e.giroGraus }
    else if (e.tipo === 'inicio') {
      aberturas++
      if (ajustes && !usados.some((a) => a.alimentacao === ajustes!.alimentacao && a.tensao === ajustes!.tensao)) usados.push(ajustes)
      const codigo = posicaoDe(gravidade(posicao))
      if (!posicoes.some((p) => p.rolagemGraus === posicao.rolagemGraus && p.giroGraus === posicao.giroGraus)) {
        posicoes.push({ codigo, nome: NOME_POSICAO[codigo], rolagemGraus: posicao.rolagemGraus, giroGraus: posicao.giroGraus })
      }
    }
  }
  return { ajustes: usados, posicoes, aberturas }
}

function regulagem(a: Ajustes, ctx: ContextoProcesso): RegulagemUsada {
  const eq = equilibrioArco(a, ctx)
  return {
    ajustes: a,
    volumeArameRelativo: volumeArameRelativo(a, ctx),
    metalMm3s: taxaDeposicao(a, ctx),
    correnteRelativa: correnteRelativa(a, ctx),
    potenciaRelativa: potenciaRelativa(a, ctx),
    razaoForma: razaoEfetiva(a, ctx),
    arco: { condicao: eq.condicao, desvioPontos: eq.desvio },
  }
}

export interface EntradaRelatorio {
  missao: Missao
  dificuldade: Dificuldade
  contexto: ContextoProcesso
  cordao: Cordao
  percurso: Percurso
  eventos: readonly EventoTentativa[]
  tempoArcoMs: number
  /** A pontuação deste mesmo registro (pontuar). */
  resultado: ResultadoPontuacao
}

export function relatorioTecnico(e: EntradaRelatorio): RelatorioTecnico {
  const { missao, contexto: ctx, cordao, percurso, resultado } = e
  const req = requisitosEfetivos(missao, e.dificuldade)
  const passo = cordao.passoMm
  const fusao = analisarFusao(cordao, percurso, ctx)
  const necessario = aporteNecessario(ctx)
  const usos = usosDoRegistro(e.eventos, ctx)
  const { inicioMm: x0, fimMm: x1 } = missao.trecho

  // Trechos de TRECHO_RELATORIO_MM dentro do pedido.
  const trechos: TrechoRelatorio[] = []
  for (let a = x0; a < x1 - 1e-9; a += TRECHO_RELATORIO_MM) {
    const b = Math.min(x1, a + TRECHO_RELATORIO_MM)
    const idx: number[] = []
    for (let i = 0; i < cordao.nPosicoes; i++) {
      const x = (i + 0.5) * passo
      if (x >= a && x < b) idx.push(i)
    }
    const secoes = idx.map((i) => cordao.secao(i))
    const pontos: PontoFusao[] = idx.map((i) => fusao[i])
    const com = secoes.filter((s) => s.larguraMm >= 1)
    const contagem = new Map<EstadoFusao, number>()
    for (const p of pontos) contagem.set(p.estado, (contagem.get(p.estado) ?? 0) + 1)
    const predominante = [...contagem.entries()].sort((p, q) => q[1] - p[1])[0]?.[0] ?? 'sem-cordao'
    const tempoMs = percurso.permanenciaEntre(a, b)
    const fr = (f: (s: (typeof com)[number]) => boolean) => (com.length ? com.filter(f).length / com.length : 0)
    trechos.push({
      inicioMm: a,
      fimMm: b,
      observacao: {
        fracaoComCordao: secoes.length ? com.length / secoes.length : 0,
        larguraMediaMm: media(com.map((s) => s.larguraMm)),
        alturaMediaMm: media(com.map((s) => s.alturaMm)),
        centroMedioMm: media(com.map((s) => s.yCentroMm)),
        areaMediaMm2: media(com.map((s) => s.areaMm2)),
        indiceFusaoMedio: media(pontos.map((p) => p.indice)),
        estadoPredominante: predominante,
      },
      fatores: {
        velocidadeEfetivaMms: tempoMs > 0 ? (b - a) / (tempoMs / 1000) : null,
        velocidadeRelativa: null,
        aporteRelativoNecessario: necessario > 0 ? media(pontos.map((p) => p.aporteMm)) / necessario : 0,
        desvioMedioMm: media(com.map((s) => Math.abs(s.yCentroMm))),
      },
      desvios: {
        larguraAbaixo: fr((s) => s.larguraMm < req.larguraMinMm),
        larguraAcima: fr((s) => s.larguraMm > req.larguraMaxMm),
        reforcoAcima: fr((s) => s.alturaMm > req.reforcoMaxMm),
        foraDoAlinhamento: fr((s) => Math.abs(s.yCentroMm) > req.alinhamentoMm),
      },
    })
  }
  const velocidades = trechos.map((t) => t.fatores.velocidadeEfetivaMms).filter((v): v is number => v !== null).sort((a, b) => a - b)
  const mediana = velocidades.length ? velocidades[Math.floor(velocidades.length / 2)] : 0
  for (const t of trechos) if (t.fatores.velocidadeEfetivaMms !== null && mediana > 0) t.fatores.velocidadeRelativa = t.fatores.velocidadeEfetivaMms / mediana

  // Ocorrências: os mesmos trechos com problema da pontuação, com magnitude e limitação.
  const ocorrencias: Ocorrencia[] = resultado.problemas
    .filter((p): p is typeof p & { estado: TipoOcorrencia } => p.estado !== 'adequada')
    .map((p) => {
      const nos = fusao.filter((f) => f.xMm >= p.inicioMm && f.xMm < p.fimMm)
      const c = CONDICAO[p.estado]
      let valor: number
      let limiar: number
      if (p.estado === 'sem-cordao') {
        valor = media(nos.map((f) => cordao.secao(cordao.indiceEm(f.xMm)).larguraMm))
        limiar = 1
      } else if (p.estado === 'enchimento') {
        valor = media(nos.map((f) => cordao.secao(cordao.indiceEm(f.xMm)).enchimento ?? 1))
        limiar = 1
      } else if (p.estado === 'borda') {
        valor = Math.min(...nos.map((f) => margemCoberturaBordas(cordao.secao(cordao.indiceEm(f.xMm)), ctx)))
        limiar = 0
      } else {
        valor = p.estado === 'falta' ? Math.min(...nos.map((f) => f.indice)) : Math.max(...nos.map((f) => f.indice))
        limiar = p.estado === 'falta' ? 1 : p.estado === 'excessiva' ? 2 : 2.6
      }
      return { tipo: p.estado, inicioMm: p.inicioMm, fimMm: p.fimMm, comprimentoMm: p.fimMm - p.inicioMm, magnitude: { grandeza: c.grandeza, valor, limiar }, condicao: c.condicao, limitacao: c.limitacao }
    })

  // Consumo: o metal que entra pelo bico é volume de arame; o gás só aproveita parte (H29).
  const rendimento = GASES[ctx.gas].rendimento
  const areaArame = (Math.PI * ctx.diametroArameMm ** 2) / 4
  const volumes = cordao.copiaDosVolumes()
  let noTrecho = 0
  for (let i = 0; i < volumes.length; i++) {
    const x = (i + 0.5) * passo
    if (x >= x0 && x <= x1) noTrecho += volumes[i]
  }
  const metal = cordao.volumeTotal()
  const tecnica = tecnicaDe(ctx)
  return {
    versaoRelatorio: VERSAO_RELATORIO,
    versaoPontuacao: resultado.versao ?? VERSAO_PONTUACAO,
    preparo: {
      materialId: ctx.material,
      espessuraMm: ctx.espessuraMm,
      aberturaMm: ctx.aberturaMm,
      junta: juntaDe(ctx),
      diametroArameMm: ctx.diametroArameMm,
      gas: ctx.gas,
      tecnica,
      anguloAvancoGraus: INFO_TECNICA[tecnica].anguloAvancoGraus,
      dbcpMm: dbcpDe(ctx),
      oxidoRemovido: ctx.oxidoRemovido,
    },
    defeitos: (() => {
      const d = analisarDefeitos({ cordao, percurso, contexto: ctx, eventos: e.eventos })
      return { ocorrencias: d.ocorrencias, respingos: d.respingos.length, poros: d.poros.length, gotas: d.gotas.length, empenoGraus: d.empenoGraus }
    })(),
    regulagens: usos.ajustes.map((a) => regulagem(a, ctx)),
    posicoes: usos.posicoes,
    trechos,
    ocorrencias,
    consumo: {
      tempoArcoS: e.tempoArcoMs / 1000,
      fracaoTempoSobreJunta: resultado.medidas.fracaoTempoUtil,
      aberturasDeArco: usos.aberturas,
      metalDepositadoMm3: metal,
      metalNoTrechoMm3: noTrecho,
      arameConsumidoMm: rendimento > 0 ? metal / rendimento / areaArame : 0,
    },
    indices: { fracaoIntegra: resultado.medidas.fracaoIntegra, deformacao: resultado.medidas.deformacao },
    limitacoes: [...LIMITACOES_GERAIS, ...(dbcpDe(ctx) !== DBCP.referenciaMm ? ['dbcp-relativa: a DBCP muda a corrente pela forma da relação de fusão do arame; os números são do jogo'] : [])],
  }
}
