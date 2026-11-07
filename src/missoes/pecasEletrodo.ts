import { RENDIMENTO15 } from '../modelo/acionamento15'
import type { TipoJunta } from '../modelo/juntas'
import { MATERIAIS, type MaterialId } from '../modelo/material'

/**
 * Peças do treino de eletrodo revestido (SMAW). Escolhidas pelo que o processo
 * faz bem: aço carbono mais grosso, estrutura e serviço de campo (vento, sem
 * gás, peça presa no lugar). Chapa fina continua no treino MIG/MAG.
 * Correntes sugeridas são faixas do modelo didático (Iref = 36 × diâmetro, H63),
 * não recomendação de fabricante.
 */
export interface PecaEletrodo {
  id: string
  titulo: string
  /** Onde essa junta aparece no trabalho real. */
  aplicacao: string
  /** Por que eletrodo revestido aqui. */
  porque: string
  larguraMm?: number
  conjunto?: 'grade'
  /** H91: chapa inteira (sem abertura) para treinar cordões em relevo. */
  sobreChapa?: boolean
  /** H103: emenda de dois tubos (a junta de 150 mm é a volta desenrolada). */
  tubo?: { diametroMm: number }
  junta: TipoJunta
  /** H104: chapa da peça. Ausente = aço carbono (todas as peças do catálogo). */
  material?: MaterialId
  espessuraMm: number
  aberturaMm: number
  diametroMm: 2.5 | 3.2
  correnteA: { min: number; max: number }
  /** Trecho exigido, marcado na peça. */
  inicioMm: number
  fimMm: number
  objetivo: string
  /** H110: solda subaquática molhada (o local no mar, a água e o aço da estrutura). */
  subaquatica?: {
    profundidadeM: number
    /** Turbidez da água (0 = limpa, 1 = muito turva): a lanterna alcança menos. */
    turbidez: number
    /** Carbono e carbono equivalente do aço da estrutura (dureza da ZTA). */
    carbono: number
    ce: number
    local: string
    /** Estrutura do cenário onde a peça está presa. */
    estrutura: 'cais' | 'casco' | 'plataforma'
  }
}

/** Tensão do arco com o comprimento igual ao diâmetro da alma (mesma regra de acionamento15.ts). */
const tensaoNominalV = (diametroMm: number) => 20 + 2 * diametroMm
/** Avanço de referência do eletrodo revestido no treino (mm/s), cerca de 15 cm por minuto. */
export const AVANCO_REFERENCIA_MMS = 2.5

/**
 * H82: aporte de calor de referência da peça (kJ/mm): o calor que o arco põe
 * na junta com a corrente no meio da faixa sugerida, arco do tamanho do
 * diâmetro e o avanço de referência. A análise compara o calor de cada passe
 * com este valor: de 0,8 a 1,7 vez é a faixa adequada (analiseEletrodo.ts).
 */
export function aporteAlvoKJmm(p: PecaEletrodo): number {
  const corrente = (p.correnteA.min + p.correnteA.max) / 2
  return RENDIMENTO15.termico * corrente * tensaoNominalV(p.diametroMm) / AVANCO_REFERENCIA_MMS / 1000
}

export const PECAS_ELETRODO: readonly PecaEletrodo[] = [
  {
    id: 'cordao-chapa',
    titulo: 'Unir duas chapas — junta de topo',
    aplicacao: 'Duas chapas separadas e alinhadas para formar uma única peça.',
    porque: 'Montagem de chapas de aço carbono: unir as bordas pela abertura central.',
    junta: 'topo', espessuraMm: 8, aberturaMm: 2, diametroMm: 2.5, correnteA: { min: 80, max: 100 },
    inicioMm: 20, fimMm: 130,
    objetivo: 'Preencher a abertura até a face das chapas, unindo as duas bordas do INÍCIO ao FIM. Faça mais de um passe, trocando a vareta e limpando entre eles.',
  },
  {
    id: 't-estrutural',
    titulo: 'Nervura de sapata — base de equipamento',
    aplicacao: 'Nervuras, suportes e bases de estrutura metálica.',
    porque: 'Aço estrutural grosso soldado na oficina ou no campo, sem cilindro de gás.',
    junta: 't', espessuraMm: 10, aberturaMm: 0, diametroMm: 3.2, correnteA: { min: 100, max: 130 },
    inicioMm: 10, fimMm: 140,
    objetivo: 'Filete contínuo no canto, sem grudar o eletrodo; limpe a escória no fim.',
  },
  {
    id: 'v-raiz',
    titulo: 'Emenda chanfrada — longarina de ponte rolante',
    aplicacao: 'Emenda de chapas grossas de uma longarina de equipamento.',
    porque: 'O passe de raiz com eletrodo fino é clássico em chapa grossa chanfrada.',
    junta: 'v', espessuraMm: 12, aberturaMm: 2.5, diametroMm: 2.5, correnteA: { min: 75, max: 95 },
    inicioMm: 10, fimMm: 140,
    objetivo: 'Raiz contínua no fundo do chanfro com arco curto; limpe a escória antes de outro passe.',
  },
  {
    id: 'canto-portao',
    titulo: 'Conserto de grade — emenda da barra',
    aplicacao: 'Grade de aço com uma barra chata cortada em duas partes, alinhadas para o reparo.',
    porque: 'Serviço de manutenção: recompor a continuidade da barra dentro do quadro da grade.',
    conjunto: 'grade', larguraMm: 40,
    junta: 'topo', espessuraMm: 6.3, aberturaMm: 1.5, diametroMm: 2.5, correnteA: { min: 75, max: 95 },
    inicioMm: 57, fimMm: 93,
    objetivo: 'Soldar a abertura entre as duas metades da barra de 40 mm, limpar e inspecionar a união.',
  },
  {
    id: 'sobreposta-reforco',
    titulo: 'Chapa de reforço — manutenção de estrutura',
    aplicacao: 'Manutenção: reforços e remendos em estruturas já montadas.',
    porque: 'Com vento, o gás de proteção do MIG seria soprado; o revestimento do eletrodo protege.',
    junta: 'sobreposta', espessuraMm: 10, aberturaMm: 0, diametroMm: 3.2, correnteA: { min: 105, max: 130 },
    inicioMm: 10, fimMm: 140,
    objetivo: 'Filete contínuo na borda da chapa de cima; limpe toda a escória.',
  },
  // H91 (v1.9): fica no fim da lista (os índices das outras peças não mudam) e aparece primeiro no menu.
  {
    id: 'cordao-sobre-chapa',
    titulo: 'Cordões sobre chapa — treino de arco',
    aplicacao: 'Primeiro exercício do soldador: cordões retos sobre uma chapa inteira.',
    porque: 'Sem abertura para encher, o metal fica todo por cima e o cordão aparece em relevo.',
    sobreChapa: true,
    junta: 'topo', espessuraMm: 6.3, aberturaMm: 0, diametroMm: 2.5, correnteA: { min: 75, max: 95 },
    inicioMm: 20, fimMm: 130,
    objetivo: 'Um cordão reto e contínuo do INÍCIO ao FIM: avance com o mouse e desça a vareta (S) enquanto ela queima. Limpe a escória no fim.',
  },
  // H103 (v2.0): também no fim da lista, para não mudar os índices das outras.
  {
    id: 'tubo-topo',
    titulo: 'Tubo com tubo — emenda de topo',
    aplicacao: 'Emenda de tubos de aço em tubulações e estruturas tubulares.',
    porque: 'Na obra o tubo não vai para a bancada: o eletrodo dispensa o gás e solda em qualquer lugar.',
    tubo: { diametroMm: 150 / Math.PI },
    junta: 'topo', espessuraMm: 4, aberturaMm: 1.5, diametroMm: 2.5, correnteA: { min: 70, max: 90 },
    inicioMm: 2, fimMm: 148,
    objetivo: 'Dar a volta inteira na emenda: solde o trecho de cima, apague o arco e gire o tubo (⟲ ⟳) para trazer o próximo trecho para cima. Limpe a escória no fim.',
  },
]

/** H104: chapa da peça (as do catálogo são de aço carbono). */
export function materialEletrodo(p: PecaEletrodo): MaterialId {
  return p.material ?? 'aco-carbono'
}

/**
 * H104: a mesma peça em outra chapa (treino). A geometria fica; a corrente
 * sugerida acompanha o calor que a chapa pede para fundir (necessidadeFusao),
 * e com ela o aporte de referência da análise (H82). Arredonda de 5 em 5 A.
 */
export function pecaEletrodoEm(p: PecaEletrodo, material: MaterialId): PecaEletrodo {
  const antigo = materialEletrodo(p)
  if (material === antigo) return p
  if (!MATERIAIS[material].processos.includes('eletrodo')) throw new Error(`${MATERIAIS[material].nome} não vai ao eletrodo no jogo.`)
  const k = MATERIAIS[material].necessidadeFusao / MATERIAIS[antigo].necessidadeFusao
  const a5 = (v: number) => Math.round((v * k) / 5) * 5
  return { ...p, material, correnteA: { min: a5(p.correnteA.min), max: a5(p.correnteA.max) } }
}

export function pecaEletrodo(id: string): PecaEletrodo {
  return PECAS_ELETRODO.find(p => p.id === id) ?? PECAS_ELETRODO[0]
}

/** Coordenadas da largura real da peça no domínio de 150 mm da bancada. */
export function limitesPecaEletrodo(p: { larguraMm?: number }): { min: number; max: number } {
  const meia = (p.larguraMm ?? 150) / 2
  return { min: 75 - meia, max: 75 + meia }
}
