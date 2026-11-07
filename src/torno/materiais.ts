/*
 * O que faz: materiais do torno convencional (v2.2, H108). Parâmetros
 * SINTÉTICOS do jogo, com a ordem de grandeza dos dados da Usinagem anterior
 * (src/setores/usinagem/dados/materiais): energia de corte (Kienzle), vida
 * da aresta (Taylor), janela de aresta postiça, rugosidade mínima e casca.
 * Onde mexer: um material novo é só um item a mais em MATERIAIS_TORNO.
 */

export type MaterialTornoId = 'aco-1045' | 'aluminio-6061' | 'latao-360' | 'inox-304'

/** Como o cavaco sai: fita longa, espiral que quebra, lascas curtas. */
export type FormaCavaco = 'fita' | 'espiral' | 'curto'

export interface MaterialTorno {
  id: MaterialTornoId
  nome: string
  descricao: string
  /** Kienzle: kc = kc11 · h^(−mc) (N/mm², h em mm). */
  kc11: number
  mc: number
  /** Velocidade de corte recomendada para metal duro (m/min): faixa didática do jogo. */
  vcFaixa: { min: number; max: number }
  /** Taylor do jogo: a aresta chega a VB = 0,3 mm em `vidaRefS` segundos de corte a `vcRef`; vida ∝ (vcRef/vc)^expoente. */
  vcRef: number
  vidaRefS: number
  expoente: number
  /** Aresta postiça: piora cheia até `plena`, some em `fim` (m/min); `fator` multiplica a Ra. */
  apc: { plena: number; fim: number; fator: number }
  /** Módulo de elasticidade (N/mm²): a peça em balanço flete com a força. */
  moduloE: number
  /** Menor Ra que o material permite (µm). */
  raMinimo: number
  /** Casca de fornecimento (carepa): espessura (mm) e quanto acelera o desgaste ao cortá-la. */
  casca: { espessuraMm: number; desgaste: number } | null
  cavaco: { forma: FormaCavaco; quebraAcimaF: number | null; azulaAcimaVc: number | null }
  cores: { bruta: string; usinada: string; cavaco: string }
}

export const MATERIAIS_TORNO: Record<MaterialTornoId, MaterialTorno> = {
  'aco-1045': {
    id: 'aco-1045',
    nome: 'Aço 1045 laminado',
    descricao: 'Aço médio carbono, laminado a quente, com carepa dura na superfície. Cavaco em fita; com avanço maior, o quebra-cavaco enrola e quebra.',
    kc11: 1700, mc: 0.25, vcFaixa: { min: 150, max: 250 }, vcRef: 200, vidaRefS: 240, expoente: 4,
    apc: { plena: 45, fim: 120, fator: 2.5 }, moduloE: 210000, raMinimo: 0.4,
    casca: { espessuraMm: 0.25, desgaste: 2 },
    cavaco: { forma: 'fita', quebraAcimaF: 0.15, azulaAcimaVc: 180 },
    cores: { bruta: '#3d4248', usinada: '#d9dee4', cavaco: '#b9bec4' },
  },
  'aluminio-6061': {
    id: 'aluminio-6061',
    nome: 'Alumínio 6061-T6',
    descricao: 'Leve e macio: corta com pouca força e velocidade alta. O cavaco sai em fita longa e gruda na aresta em velocidade baixa.',
    kc11: 800, mc: 0.23, vcFaixa: { min: 300, max: 800 }, vcRef: 1200, vidaRefS: 400, expoente: 4,
    apc: { plena: 80, fim: 250, fator: 1.5 }, moduloE: 70000, raMinimo: 0.3,
    casca: null,
    cavaco: { forma: 'fita', quebraAcimaF: 0.25, azulaAcimaVc: null },
    cores: { bruta: '#a9b2bb', usinada: '#eef2f6', cavaco: '#e3e8ed' },
  },
  'latao-360': {
    id: 'latao-360',
    nome: 'Latão de corte livre',
    descricao: 'Feito para usinar: o chumbo quebra o cavaco em lascas curtas e o acabamento sai bom com facilidade.',
    kc11: 780, mc: 0.18, vcFaixa: { min: 200, max: 500 }, vcRef: 600, vidaRefS: 400, expoente: 4,
    apc: { plena: 0, fim: 1, fator: 0 }, moduloE: 100000, raMinimo: 0.3,
    casca: null,
    cavaco: { forma: 'curto', quebraAcimaF: null, azulaAcimaVc: null },
    cores: { bruta: '#9c7f3c', usinada: '#ecd796', cavaco: '#e2c66f' },
  },
  'inox-304': {
    id: 'inox-304',
    nome: 'Inox 304',
    descricao: 'Encrua e esquenta: pede velocidade moderada e avanço firme. Desgasta a aresta depressa e o cavaco sai em fita dura, azulada.',
    kc11: 2100, mc: 0.21, vcFaixa: { min: 120, max: 180 }, vcRef: 140, vidaRefS: 200, expoente: 3.5,
    apc: { plena: 30, fim: 90, fator: 2 }, moduloE: 195000, raMinimo: 0.5,
    casca: null,
    cavaco: { forma: 'fita', quebraAcimaF: 0.2, azulaAcimaVc: 140 },
    cores: { bruta: '#7b8188', usinada: '#e8ecf0', cavaco: '#c7ccd2' },
  },
}

/** Fator da aresta postiça na Ra (0 fora da janela). */
export function fatorApc(m: MaterialTorno, vc: number): number {
  const { plena, fim, fator } = m.apc
  if (fator <= 0 || vc >= fim) return 0
  if (vc <= plena) return fator
  const t = (vc - plena) / (fim - plena)
  return fator * (1 - t * t * (3 - 2 * t))
}
