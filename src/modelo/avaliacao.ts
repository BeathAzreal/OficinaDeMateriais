import type { Cordao, SecaoLocal } from './cordao'
import type { AnaliseMovimento } from './movimento'
import { AVALIACAO } from './parametros'
import { areaAlvo, type ContextoProcesso, type Ajustes } from './processo'

/*
 * Avaliação ao fim da tentativa (H13–H17).
 *
 * Tudo aqui é GEOMETRIA DO MODELO: largura, altura, centro e continuidade do
 * cordão calculado. Nada fala de penetração, fusão ou defeitos internos.
 * As faixas ("regular", "centrado"...) são critérios do jogo.
 */

export type Regularidade = 'muito regular' | 'regular' | 'irregular'
export type Alinhamento = 'centrado' | 'levemente deslocado' | 'deslocado'

export interface Estatistica {
  media: number
  min: number
  max: number
  desvioPadrao: number
}

export interface Medidas {
  /** Trecho da junta efetivamente medido (H14). */
  regiao: { inicioMm: number; fimMm: number }
  largura: Estatistica
  altura: Estatistica
  area: Estatistica
  /** Desvio-padrão ÷ média da largura (H15). */
  cvLargura: number
  regularidade: Regularidade
  /** Distância do centro do cordão à linha da junta (H16). */
  desvioCentro: { medioAbsMm: number; maxAbsMm: number; xDoMaximoMm: number }
  alinhamento: Alinhamento
  /** Trechos sem cordão dentro da região (H14). */
  interrupcoes: { quantidade: number; comprimentoMm: number }
  /** Fração da região com área de seção dentro do alvo do jogo (H17). */
  fracaoNoAlvo: number
}

export interface Avaliacao {
  /** null quando não há cordão suficiente para medir. */
  medidas: Medidas | null
  comprimentoComCordaoMm: number
  /** Fração da junta em que o cordão passa por cima da linha da junta (vista de cima, H16). */
  fracaoLinhaCoberta: number
  /** Todas as fatias do cordão, para o gráfico de perfil e o corte. */
  perfil: SecaoLocal[]
}

/** Dados de uma tentativa encerrada: a avaliação e as condições em que foi feita. */
export interface Tentativa {
  contexto?: ContextoProcesso
  avaliacao: Avaliacao
  /** Velocidade efetiva por trecho (H20); null se não há região avaliada. */
  movimento: AnaliseMovimento | null
  ajustesUsados: Ajustes[]
  tempoArcoMs: number
  aberturasDeArco: number
}

function estatistica(valores: number[]): Estatistica {
  const n = valores.length
  const media = valores.reduce((s, v) => s + v, 0) / n
  const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / n
  return { media, min: Math.min(...valores), max: Math.max(...valores), desvioPadrao: Math.sqrt(variancia) }
}

export function classificarRegularidade(cv: number): Regularidade {
  if (cv <= AVALIACAO.cvMuitoRegular) return 'muito regular'
  if (cv <= AVALIACAO.cvRegular) return 'regular'
  return 'irregular'
}

export function classificarAlinhamento(desvioMedioMm: number): Alinhamento {
  if (desvioMedioMm <= AVALIACAO.desvioCentradoMm) return 'centrado'
  if (desvioMedioMm <= AVALIACAO.desvioLeveMm) return 'levemente deslocado'
  return 'deslocado'
}

export function avaliar(cordao: Cordao): Avaliacao {
  const perfil = Array.from({ length: cordao.nPosicoes }, (_, i) => cordao.secao(i))
  const temCordao = (s: SecaoLocal) => s.larguraMm >= AVALIACAO.larguraMinimaMm
  const passo = cordao.passoMm

  const comCordao = perfil.filter(temCordao)
  const cobrem = comCordao.filter((s) => Math.abs(s.yCentroMm) <= s.larguraMm / 2)
  const base = {
    perfil,
    comprimentoComCordaoMm: comCordao.length * passo,
    fracaoLinhaCoberta: (cobrem.length * passo) / cordao.comprimentoMm,
  }
  if (comCordao.length === 0) return { ...base, medidas: null }

  // H14: do primeiro ao último ponto com cordão, menos as pontas.
  const inicioMm = comCordao[0].xMm - passo / 2 + AVALIACAO.aparaPontasMm
  const fimMm = comCordao[comCordao.length - 1].xMm + passo / 2 - AVALIACAO.aparaPontasMm
  if (fimMm - inicioMm < AVALIACAO.comprimentoMinimoMm) return { ...base, medidas: null }

  const naRegiao = perfil.filter((s) => s.xMm >= inicioMm && s.xMm <= fimMm)
  const medidos = naRegiao.filter(temCordao)
  if (medidos.length === 0) return { ...base, medidas: null }

  let quantidade = 0
  let fatiasSemCordao = 0
  naRegiao.forEach((s, k) => {
    if (temCordao(s)) return
    fatiasSemCordao++
    if (k === 0 || temCordao(naRegiao[k - 1])) quantidade++
  })

  const alvo = areaAlvo()
  const noAlvo = naRegiao.filter((s) => s.areaMm2 >= alvo.minMm2 && s.areaMm2 <= alvo.maxMm2).length

  const largura = estatistica(medidos.map((s) => s.larguraMm))
  const desvios = medidos.map((s) => Math.abs(s.yCentroMm))
  const desvioMedio = desvios.reduce((a, b) => a + b, 0) / desvios.length
  const desvioMax = Math.max(...desvios)
  const cvLargura = largura.desvioPadrao / largura.media

  return {
    ...base,
    medidas: {
      regiao: { inicioMm, fimMm },
      largura,
      altura: estatistica(medidos.map((s) => s.alturaMm)),
      area: estatistica(medidos.map((s) => s.areaMm2)),
      cvLargura,
      regularidade: classificarRegularidade(cvLargura),
      desvioCentro: {
        medioAbsMm: desvioMedio,
        maxAbsMm: desvioMax,
        xDoMaximoMm: medidos[desvios.indexOf(desvioMax)].xMm,
      },
      alinhamento: classificarAlinhamento(desvioMedio),
      interrupcoes: { quantidade, comprimentoMm: fatiasSemCordao * passo },
      fracaoNoAlvo: noAlvo / naRegiao.length,
    },
  }
}
