import type { Cordao } from '../modelo/cordao'
import { analisarDefeitos, fatorIntegridade, notaSuperficie, respingosPor10mm } from '../modelo/defeitos'
import type { EventoTentativa } from '../modelo/simulacao'
import { analisarFusao, DESCRICAO_ESTADO, indiceDeformacao, type EstadoFusao, type PontoFusao } from '../modelo/fusao'
import { GASES, MATERIAIS } from '../modelo/material'
import { FUSAO } from '../modelo/parametros'
import type { Percurso } from '../modelo/percurso'
import type { ContextoProcesso } from '../modelo/processo'
import { requisitosEfetivos, type Dificuldade, type Missao } from '../missoes/catalogo'

/*
 * Pontuação automática — regras da versão pontuacao-v3 (docs/PONTUACAO.md).
 * Só usa grandezas do modelo; nada é medido pela imagem.
 *
 * v3 (Alpha v1.3): escala de 0 a 1000 e notas GRADUADAS pela distância ao
 * critério (não só dentro/fora): fusão por posição pelo índice F, geometria
 * pelo desvio em mm de largura, reforço (excesso ou falta de enchimento) e
 * alinhamento; execução por tempo sobre a junta, reinícios de arco e metal
 * no trecho. Pesos (somando 100) e condições essenciais iguais aos da v1;
 * cada ponto de peso vale 10 pontos na nota.
 */

export const VERSAO_PONTUACAO = 'pontuacao-v11'

/**
 * H90 (v1.9): aprovação por categoria. Fácil: só a nota, sem aprovação.
 * Difícil: pelo menos 20 % dos pontos de cada uma das cinco categorias.
 * Desafios do Arcade e História: só no Difícil, com pelo menos 40 % em cada.
 */
export const EXIGENCIA = { dificil: 0.2, desafio: 0.4 } as const

/** Exigência por categoria do modo, fora dos desafios e da História. */
export function exigenciaDe(d: Dificuldade): number | null {
  return d === 'aprendiz' ? null : EXIGENCIA.dificil
}
/** Nota máxima (cada ponto de peso vale ESCALA ÷ 100). */
export const ESCALA_PONTUACAO = 1000

/** Escala histórica; não reavalia tentativas salvas com regras novas. */
export function escalaDaPontuacao(versao: string): number {
  return versao === 'pontuacao-v1' || versao === 'pontuacao-v2' ? 100 : ESCALA_PONTUACAO
}

/**
 * Faixas de tolerância da nota graduada (critérios DO JOGO, em mm ou índice):
 * fora da faixa pedida, a nota daquela posição cai linearmente até zero
 * nessa distância. Inspirado na ideia de níveis de aceitação por desvio
 * (ex.: ISO 5817), sem reproduzir os limites de nenhuma norma.
 */
export const TOLERANCIAS = {
  /** Largura fora da faixa do desenho: zero a 1,5 mm além do limite. */
  larguraMm: 1.5,
  /** Reforço acima do máximo: zero a 1,0 mm além. */
  reforcoMm: 1,
  /** Junta não enchida (superfície do metal abaixo da face): zero a 1,0 mm abaixo. */
  faltaEnchimentoMm: 1,
  /** Centro do cordão fora do alinhamento: zero a 1,0 mm além. */
  alinhamentoMm: 1,
  /** Índice de fusão abaixo de 1: zero em 0,6. */
  fusaoMinima: 0.6,
  /** Reinícios de arco no trecho até zerar a parte de reinícios. */
  reinicios: 3,
  /** Metal no trecho ÷ metal na peça: zero em 80 %. */
  aproveitamentoMinimo: 0.8,
  /** Variação da largura (desvio ÷ média) que zera a regularidade. */
  variacaoMaxima: 0.2,
  /** Índice de deformação D que zera o controle térmico. */
  deformacaoMaxima: 2,
  /** Fração do tempo de arco sobre a junta abaixo da qual essa parte da Execução zera. */
  tempoUtilMinimo: 0.7,
  /** Nota mínima de uma posição com fusão excessiva (antes de perfurar). */
  excessivaMinima: 0,
} as const

/**
 * H88: modo Fácil. As faixas em que a nota cai até zero ficam duas vezes mais
 * largas (e a variação aceita na largura, 50 % maior); o Difícil usa TOLERANCIAS.
 */
export const TOLERANCIAS_FACIL = {
  larguraMm: 3,
  reforcoMm: 2,
  faltaEnchimentoMm: 2,
  alinhamentoMm: 2,
  fusaoMinima: 0.4,
  reinicios: 6,
  aproveitamentoMinimo: 0.6,
  variacaoMaxima: 0.3,
  deformacaoMaxima: 3,
  tempoUtilMinimo: 0.5,
  excessivaMinima: 0.5,
} as const

/** Tolerâncias da nota no modo escolhido (H88). */
export function toleranciasDe(d: Dificuldade) {
  return d === 'aprendiz' ? TOLERANCIAS_FACIL : TOLERANCIAS
}

export type CategoriaId = 'integridade' | 'desenho' | 'regularidade' | 'deformacao' | 'eficiencia'
export type Pesos = Record<CategoriaId, number>

export const CATEGORIAS: CategoriaId[] = ['integridade', 'desenho', 'regularidade', 'deformacao', 'eficiencia']
export const NOME_CATEGORIA: Record<CategoriaId, string> = {
  integridade: 'Fusão prevista (integridade)',
  desenho: 'Geometria do cordão',
  regularidade: 'Regularidade da largura',
  deformacao: 'Controle térmico',
  eficiencia: 'Execução',
}
export const PESOS_PADRAO: Pesos = { integridade: 40, desenho: 25, regularidade: 15, deformacao: 10, eficiencia: 10 }

/** Texto fixo de cada categoria (definição, dados, regra, limitações). */
export const FICHA_CATEGORIA: Record<CategoriaId, { definicao: string; dados: string; regra: string; limitacoes: string }> = {
  integridade: {
    definicao: 'Quanto da junta o modelo prevê fundida na medida certa, posição por posição.',
    dados: 'Índice de fusão sintético F (aporte, aquecimento, espessura, material, gás, técnica, DBCP), cobertura das bordas, enchimento da junta.',
    regra: 'Cada posição vale de 0 a 1: 1 com F entre 1 e 2; abaixo de 1 cai até 0 em F = 0,6; acima de 2 cai até 0 em F = 2,6 (perfuração). Borda descoberta, perfuração e sem cordão valem 0; junta mal enchida vale metade do enchimento. Porosidade prevista multiplica por (1 − 0,6 × risco) e sobreposição por (1 − 0,4 × índice). Pontos = peso × 10 × média.',
    limitacoes: 'Índice sintético do modelo. Poros e sobreposição previstos tiram nota (v6), mas não há trincas, inclusões nem penetração real.',
  },
  desenho: {
    definicao: 'Quanto o cordão obedece às medidas e tolerâncias do desenho, pelo tamanho do desvio.',
    dados: 'Extensão, largura, altura (reforço ou falta de enchimento) e centro do cordão, em mm; defeitos visíveis previstos (mordedura, sobreposição, escorrimento, gotas, caimento, cratera, respingos).',
    regra: 'Extensão 7/30 (fração com cordão). Largura 8/30, reforço 5/30, alinhamento 5/30 e superfície 5/30, cada posição com cordão de 0 a 1: 1 dentro da faixa, caindo linearmente até 0 a 1,5 mm (largura) ou 1,0 mm (reforço, falta de enchimento, alinhamento) além do limite. Superfície: 1 sem defeito visível, caindo com cada defeito; respingos acima de 2 por 10 mm tiram até 0,3.',
    limitacoes: 'Tolerâncias são objetivos didáticos do jogo, não requisitos de norma.',
  },
  regularidade: {
    definicao: 'Constância da largura ao longo do trecho avaliado.',
    dados: 'Coeficiente de variação da largura (desvio-padrão ÷ média).',
    regra: 'Pontos = peso × 10 × (0,20 − variação) ÷ 0,17, entre 0 e o máximo.',
    limitacoes: 'Oscilações menores que uns 2 mm são alisadas pelo modelo.',
  },
  deformacao: {
    definicao: 'Calor colocado além do necessário, ponderado pela tendência do material a deformar.',
    dados: 'Índice de deformação D (aporte médio ÷ aporte necessário × fator do material).',
    regra: 'Pontos = peso × 10 × (2 − D), entre 0 e o máximo.',
    limitacoes: 'É um índice; não há medida de empenamento.',
  },
  eficiencia: {
    definicao: 'Como o passe foi executado: arco sobre a junta, sem reinícios além dos passes previstos e com o metal onde foi pedido.',
    dados: 'Tempo de arco perto da junta no trecho; aberturas além dos passes previstos; metal no trecho ÷ metal na peça.',
    regra: 'Tempo sobre a junta 40 % ((fração − 0,70) ÷ 0,30); reinícios 30 % (1 − reinícios ÷ 3); metal no trecho 30 % ((fração − 0,80) ÷ 0,20). Cada parte entre 0 e 1.',
    limitacoes: 'Reinício é contado, não modelado: o jogo não prevê a cratera nem a sobreposição de um reinício real.',
  },
}

export interface ResultadoCategoria {
  id: CategoriaId
  nome: string
  pontos: number
  maximo: number
  explicacao: string
  detalhes: { rotulo: string; valor: string }[]
}

/** H90: no Difícil, uma linha por categoria com o mínimo exigido (o id é o da categoria). */
export interface CondicaoEssencial {
  id: CategoriaId
  descricao: string
  cumprida: boolean
  justificativa: string
}

export interface Penalidade {
  descricao: string
  pontos: number
  justificativa: string
}

export interface TrechoProblema {
  inicioMm: number
  fimMm: number
  estado: EstadoFusao
  descricao: string
}

export interface ResultadoPontuacao {
  versao: string
  pesos: Pesos
  total: number
  /** Aprovada no Difícil (todas as categorias com o mínimo). No Fácil é sempre verdadeiro e não é mostrado. */
  aprovada: boolean
  /** H90: fração mínima de cada categoria para aprovar; null = Fácil, só a nota (sem aprovação). */
  exigencia?: number | null
  categorias: ResultadoCategoria[]
  essenciais: CondicaoEssencial[]
  penalidades: Penalidade[]
  problemas: TrechoProblema[]
  /** Medidas usadas, para mostrar e para desempates. */
  medidas: {
    fracaoIntegra: number
    larguraMediaMm: number
    alturaMediaMm: number
    cvLargura: number
    deformacao: number
    /** Rendimento de deposição do gás (H29); desde a v3 não entra na nota. */
    rendimento: number
    fracaoTempoUtil: number
    /** v3: média da nota de fusão por posição (0–1). */
    notaFusao?: number
    /** v3: aberturas de arco − 1 (dentro do registro). */
    reiniciosArco?: number
    /** v3: metal no trecho pedido ÷ metal na peça. */
    aproveitamentoMetal?: number
  }
}

export interface EntradaPontuacao {
  missao: Missao
  dificuldade: Dificuldade
  contexto: ContextoProcesso
  cordao: Cordao
  percurso: Percurso
  tempoArcoMs: number
  /** Quantas vezes o arco foi aberto (v3); ausente = 1 (sem reinício). */
  aberturasDeArco?: number
  /** Aberturas e fechamentos do arco: crateras (v6, H55). Sem eles, não há crateras. */
  eventos?: readonly EventoTentativa[]
  /** H90: fração mínima de cada categoria; ausente = a do modo (Fácil: nenhuma; Difícil: 20 %). */
  exigencia?: number | null
}

const limitar = (v: number) => Math.min(1, Math.max(0, v))
/** Linear: 1 até `limite`, 0 a `faixa` além dele. */
const cair = (excesso: number, faixa: number) => limitar(1 - Math.max(0, excesso) / faixa)
const fmt1 = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtPct = (v: number) => v.toLocaleString('pt-BR', { style: 'percent', maximumFractionDigits: 0 })

export function validarPesos(p: Pesos): string[] {
  const erros: string[] = []
  for (const c of CATEGORIAS) {
    if (!Number.isFinite(p[c]) || p[c] < 0 || p[c] > 100) erros.push(`Peso de "${NOME_CATEGORIA[c]}" deve estar entre 0 e 100.`)
  }
  const soma = CATEGORIAS.reduce((s, c) => s + (p[c] || 0), 0)
  if (Math.abs(soma - 100) > 1e-9) erros.push(`Os pesos devem somar 100 (agora somam ${soma}).`)
  return erros
}

function agruparProblemas(pontos: PontoFusao[], passoMm: number): TrechoProblema[] {
  const trechos: TrechoProblema[] = []
  for (const p of pontos) {
    if (p.estado === 'adequada') continue
    const ultimo = trechos[trechos.length - 1]
    if (ultimo && ultimo.estado === p.estado && Math.abs(ultimo.fimMm - (p.xMm - passoMm / 2)) < 1e-6) {
      ultimo.fimMm = p.xMm + passoMm / 2
    } else {
      trechos.push({ inicioMm: p.xMm - passoMm / 2, fimMm: p.xMm + passoMm / 2, estado: p.estado, descricao: DESCRICAO_ESTADO[p.estado] })
    }
  }
  return trechos.filter((t) => t.fimMm - t.inicioMm >= 1)
}

export function pontuar(e: EntradaPontuacao, pesos: Pesos = PESOS_PADRAO): ResultadoPontuacao {
  const { missao, contexto, cordao } = e
  const req = requisitosEfetivos(missao, e.dificuldade)
  const passo = cordao.passoMm
  const { inicioMm: x0, fimMm: x1 } = missao.trecho
  const a0 = x0 + 2
  const a1 = x1 - 2
  const T = toleranciasDe(e.dificuldade)

  const fusao = analisarFusao(cordao, e.percurso, contexto)
  // v6: defeitos visíveis previstos (H50–H57), do mesmo registro.
  const defeitos = analisarDefeitos({ cordao, percurso: e.percurso, contexto, eventos: e.eventos, fusao })
  const secoes = Array.from({ length: cordao.nPosicoes }, (_, i) => cordao.secao(i))
  const noTrecho = (x: number) => x >= x0 && x <= x1
  const avaliado = (x: number) => x >= a0 && x <= a1
  const fAvaliado = fusao.filter((p) => avaliado(p.xMm))
  const sAvaliado = secoes.filter((s) => avaliado(s.xMm))
  const comCordao = sAvaliado.filter((s) => s.larguraMm >= 1)
  const n = Math.max(1, fAvaliado.length)
  const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0)

  // Fusão prevista: nota graduada por posição pelo índice F (H33).
  const fracaoIntegra = fAvaliado.filter((p) => p.estado === 'adequada').length / n
  const contagem = (estado: EstadoFusao) => fAvaliado.filter((p) => p.estado === estado).length / n
  const notaPosicao = (p: PontoFusao): number => {
    if (p.estado === 'adequada') return 1
    if (p.estado === 'falta') return limitar((p.indice - T.fusaoMinima) / (FUSAO.minimoAdequado - T.fusaoMinima))
    if (p.estado === 'excessiva') return T.excessivaMinima + (1 - T.excessivaMinima) * limitar((FUSAO.perfuracao - p.indice) / (FUSAO.perfuracao - FUSAO.maximoAdequado))
    if (p.estado === 'enchimento') return 0.5 * limitar(cordao.secao(cordao.indiceEm(p.xMm)).enchimento ?? 0)
    return 0
  }
  const notaFusao = fAvaliado.length ? media(fAvaliado.map((p) => notaPosicao(p) * fatorIntegridade(defeitos, cordao.indiceEm(p.xMm)))) : 0

  // Geometria: extensão + desvios graduados em mm onde há cordão.
  const noTrechoSecoes = secoes.filter((s) => noTrecho(s.xMm))
  const extensao = noTrechoSecoes.filter((s) => s.larguraMm >= 1).length / Math.max(1, noTrechoSecoes.length)
  const nota = (f: (s: (typeof comCordao)[number]) => number) => (comCordao.length ? media(comCordao.map(f)) : 0)
  const largura = nota((s) => cair(Math.max(req.larguraMinMm - s.larguraMm, s.larguraMm - req.larguraMaxMm), T.larguraMm))
  const reforco = nota((s) => (s.alturaMm < 0 ? cair(-s.alturaMm, T.faltaEnchimentoMm) : cair(s.alturaMm - req.reforcoMaxMm, T.reforcoMm)))
  const alinhamento = nota((s) => cair(Math.abs(s.yCentroMm) - req.alinhamentoMm, T.alinhamentoMm))
  const comprimentoComCordao = secoes.filter((s) => s.larguraMm >= 1).length * passo
  const respingos10 = respingosPor10mm(defeitos, comprimentoComCordao)
  const superficie = limitar(nota((s) => notaSuperficie(defeitos, cordao.indiceEm(s.xMm))) - Math.min(0.3, 0.05 * Math.max(0, respingos10 - 2)))
  const fracaoDesenho = (7 * extensao + 8 * largura + 5 * reforco + 5 * alinhamento + 5 * superficie) / 30
  // Frações estritas (dentro do limite), só para mostrar.
  const estrita = (f: (s: (typeof comCordao)[number]) => boolean) => (comCordao.length ? comCordao.filter(f).length / comCordao.length : 0)
  const larguraDentro = estrita((s) => s.larguraMm >= req.larguraMinMm && s.larguraMm <= req.larguraMaxMm)

  // Regularidade.
  const larguras = comCordao.map((s) => s.larguraMm)
  const larguraMedia = media(larguras)
  const cv = larguras.length >= 10 ? Math.sqrt(larguras.reduce((s, w) => s + (w - larguraMedia) ** 2, 0) / larguras.length) / larguraMedia : 1
  const fracaoRegularidade = larguras.length >= 10 ? limitar((T.variacaoMaxima - cv) / (T.variacaoMaxima - 0.03)) : 0
  const alturaMedia = media(comCordao.map((c) => c.alturaMm))

  // Controle térmico.
  const deformacao = indiceDeformacao(fAvaliado, contexto)
  const fracaoDeformacao = fAvaliado.some((p) => p.estado !== 'sem-cordao') ? limitar((T.deformacaoMaxima - deformacao) / (T.deformacaoMaxima - 1)) : 0

  // Execução: arco sobre a junta, reinícios e metal no trecho.
  const rendimento = GASES[contexto.gas].rendimento
  const tempoUtil = e.tempoArcoMs > 0 ? e.percurso.pertoDaJuntaEntre(x0 - 5, x1 + 5) / e.tempoArcoMs : 0
  const aberturasPlanejadas = Math.max(1, missao.aberturasPlanejadas ?? 1)
  const reinicios = Math.max(0, (e.aberturasDeArco ?? 1) - aberturasPlanejadas)
  const volumes = cordao.copiaDosVolumes()
  let metalTrecho = 0
  let metalTotal = 0
  for (let i = 0; i < volumes.length; i++) {
    metalTotal += volumes[i]
    if (noTrecho((i + 0.5) * passo)) metalTrecho += volumes[i]
  }
  // H58: metal de cordões soltos (outro ponto de solda longe da junta) é metal fora do trecho.
  metalTotal += cordao.volumeSolto()
  const aproveitamento = metalTotal > 0 ? metalTrecho / metalTotal : 0
  const fracaoEficiencia =
    0.4 * limitar((tempoUtil - T.tempoUtilMinimo) / (1 - T.tempoUtilMinimo)) + 0.3 * cair(reinicios, T.reinicios) + 0.3 * limitar((aproveitamento - T.aproveitamentoMinimo) / (1 - T.aproveitamentoMinimo))


  const fator = ESCALA_PONTUACAO / 100
  const pontos = (c: CategoriaId, fracao: number) => Math.round(pesos[c] * fator * fracao)
  const maximo = (c: CategoriaId) => pesos[c] * fator
  const categorias: ResultadoCategoria[] = [
    {
      id: 'integridade',
      nome: NOME_CATEGORIA.integridade,
      pontos: pontos('integridade', notaFusao),
      maximo: maximo('integridade'),
      explicacao:
        `Nota média de fusão ${fmtPct(notaFusao)}; fusão adequada em ${fmtPct(fracaoIntegra)} do trecho avaliado. ` +
        `Falta de fusão: ${fmtPct(contagem('falta'))}; excessiva: ${fmtPct(contagem('excessiva'))}; ` +
        `perfuração: ${fmtPct(contagem('perfuracao'))}; borda descoberta: ${fmtPct(contagem('borda'))}; ` +
        `junta não enchida: ${fmtPct(contagem('enchimento'))}; sem cordão: ${fmtPct(contagem('sem-cordao'))}. Resultado sintético do modelo.`,
      detalhes: [
        { rotulo: 'Nota de fusão', valor: fmtPct(notaFusao) },
        { rotulo: 'Fração íntegra', valor: fmtPct(fracaoIntegra) },
      ],
    },
    {
      id: 'desenho',
      nome: NOME_CATEGORIA.desenho,
      pontos: pontos('desenho', fracaoDesenho),
      maximo: maximo('desenho'),
      explicacao:
        `Extensão ${fmtPct(extensao)}. Largura (${fmt1(req.larguraMinMm)}–${fmt1(req.larguraMaxMm)} mm): nota ${fmtPct(largura)}, ${fmtPct(larguraDentro)} dentro. ` +
        `Reforço até ${fmt1(req.reforcoMaxMm)} mm (sem afundar abaixo da face): nota ${fmtPct(reforco)}. Centro a até ${fmt1(req.alinhamentoMm)} mm da junta: nota ${fmtPct(alinhamento)}. ` +
        `Superfície (defeitos visíveis previstos): nota ${fmtPct(superficie)}.`,
      detalhes: [
        { rotulo: 'Extensão', valor: fmtPct(extensao) },
        { rotulo: 'Largura', valor: fmtPct(largura) },
        { rotulo: 'Reforço', valor: fmtPct(reforco) },
        { rotulo: 'Alinhamento', valor: fmtPct(alinhamento) },
        { rotulo: 'Superfície', valor: fmtPct(superficie) },
      ],
    },
    {
      id: 'regularidade',
      nome: NOME_CATEGORIA.regularidade,
      pontos: pontos('regularidade', fracaoRegularidade),
      maximo: maximo('regularidade'),
      explicacao:
        larguras.length >= 10
          ? `A largura variou ${fmtPct(cv)} (média ${fmt1(larguraMedia)} mm). Até 3 % ganha tudo; 20 % ou mais, nada.`
          : 'Cordão curto demais para medir a regularidade.',
      detalhes: [{ rotulo: 'Variação da largura', valor: larguras.length >= 10 ? fmtPct(cv) : '—' }],
    },
    {
      id: 'deformacao',
      nome: NOME_CATEGORIA.deformacao,
      pontos: pontos('deformacao', fracaoDeformacao),
      maximo: maximo('deformacao'),
      explicacao: `Índice de deformação ${fmt1(deformacao)} (até 1 sem perda; 2 ou mais perde tudo). ${MATERIAIS[contexto.material].nome}: fator ${fmt1(MATERIAIS[contexto.material].fatorDeformacao)}.`,
      detalhes: [{ rotulo: 'Índice D', valor: fmt1(deformacao) }],
    },
    {
      id: 'eficiencia',
      nome: NOME_CATEGORIA.eficiencia,
      pontos: pontos('eficiencia', fracaoEficiencia),
      maximo: maximo('eficiencia'),
      explicacao: `${fmtPct(tempoUtil)} do tempo de arco sobre a junta; ${reinicios} reinício(s) além dos passes previstos; ${fmtPct(aproveitamento)} do metal dentro do trecho pedido.`,
      detalhes: [
        { rotulo: 'Arco sobre a junta', valor: fmtPct(tempoUtil) },
        { rotulo: 'Reinícios além dos passes previstos', valor: String(reinicios) },
        { rotulo: 'Metal no trecho', valor: fmtPct(aproveitamento) },
      ],
    },
  ]

  // H90 (v1.9): no Fácil não há aprovação, só a nota. No Difícil, cada categoria precisa de
  // pelo menos `exigencia` dos seus pontos (20 % no treino; 40 % nos desafios e na História).
  const exigencia = e.exigencia === undefined ? exigenciaDe(e.dificuldade) : e.exigencia
  const essenciais: CondicaoEssencial[] = exigencia === null ? [] : categorias.filter((c) => c.maximo > 0).map((c) => ({
    id: c.id,
    descricao: `${c.nome}: pelo menos ${fmtPct(exigencia)} dos pontos`,
    cumprida: c.pontos >= exigencia * c.maximo - 1e-9,
    justificativa: `${c.pontos} de ${c.maximo} (${fmtPct(c.pontos / c.maximo)}).`,
  }))
  const aprovada = essenciais.every((c) => c.cumprida)
  const penalidades: Penalidade[] = []

  return {
    versao: VERSAO_PONTUACAO,
    pesos: { ...pesos },
    total: categorias.reduce((s, c) => s + c.pontos, 0),
    aprovada,
    exigencia,
    categorias,
    essenciais,
    penalidades,
    problemas: agruparProblemas(fusao.filter((p) => noTrecho(p.xMm)), passo),
    medidas: {
      fracaoIntegra,
      larguraMediaMm: larguraMedia,
      alturaMediaMm: alturaMedia,
      cvLargura: larguras.length >= 10 ? cv : NaN,
      deformacao,
      rendimento,
      fracaoTempoUtil: tempoUtil,
      notaFusao,
      reiniciosArco: reinicios,
      aproveitamentoMetal: aproveitamento,
    },
  }
}

/** Notas de uma categoria, para desempates. */
export function notaCategoria(r: Pick<ResultadoPontuacao, 'categorias'>, id: CategoriaId): number {
  return r.categorias.find((c) => c.id === id)?.pontos ?? 0
}

export type CriterioDesempate = 'integridade-desenho' | 'desenho-integridade'

/**
 * Ordem: total → (integridade, desenho) na ordem escolhida, aprovada ou não
 * (v1.8, H89). Negativo se `a` fica à frente de `b`.
 */
export function compararPontuacoes(
  a: Pick<ResultadoPontuacao, 'aprovada' | 'total' | 'categorias'>,
  b: Pick<ResultadoPontuacao, 'aprovada' | 'total' | 'categorias'>,
  criterio: CriterioDesempate = 'integridade-desenho',
): number {
  if (a.total !== b.total) return b.total - a.total
  const ordem: CategoriaId[] = criterio === 'integridade-desenho' ? ['integridade', 'desenho'] : ['desenho', 'integridade']
  for (const c of ordem) {
    const d = notaCategoria(b, c) - notaCategoria(a, c)
    if (d !== 0) return d
  }
  return 0
}

