import type { PecaEletrodo } from './pecasEletrodo'
import { MATERIAIS, type MaterialId } from '../modelo/material'

/**
 * Peças do treino TIG (GTAW, H92). Chapa fina, onde o TIG é escolhido pelo
 * controle da poça: inox e aço carbono. No treino a chapa pode ser trocada
 * por outra que vá ao TIG (H104). Faixas de corrente didáticas do jogo, não
 * recomendação de fabricante.
 */
export interface PecaTig {
  id: string
  titulo: string
  aplicacao: string
  objetivo: string
  material: MaterialId
  junta: 'topo' | 't'
  espessuraMm: number
  /** Diâmetro da vareta de adição (mm). */
  varetaMm: 1.6 | 2.4
  correnteA: { min: number; max: number }
  inicioMm: number
  fimMm: number
  /** Chapa inteira (sem emenda): cordões sobre a chapa. */
  sobreChapa?: boolean
  /** H103: emenda de dois tubos (a junta de 150 mm é a volta desenrolada). */
  tubo?: { diametroMm: number }
}

export const PECAS_TIG: readonly PecaTig[] = [
  {
    id: 'tig-chapa',
    titulo: 'Cordões sobre chapa — inox 2 mm',
    aplicacao: 'Primeiro exercício do TIG: abrir a poça, mergulhar a vareta e avançar no ritmo.',
    objetivo: 'Um cordão reto do INÍCIO ao FIM: segure a poça com o pedal, toque a vareta na frente da poça e avance um pouco a cada toque.',
    material: 'inox-austenitico', junta: 'topo', espessuraMm: 2, varetaMm: 1.6, correnteA: { min: 60, max: 90 },
    inicioMm: 35, fimMm: 115, sobreChapa: true,
  },
  {
    id: 'tig-topo',
    titulo: 'Emenda de chapa fina — inox 1,5 mm',
    aplicacao: 'Bordas encostadas de duas chapas finas: tampas, dutos e peças de cozinha industrial.',
    objetivo: 'Fundir as duas bordas do INÍCIO ao FIM sem furar a chapa, com um pouco de vareta para dar reforço.',
    material: 'inox-austenitico', junta: 'topo', espessuraMm: 1.5, varetaMm: 1.6, correnteA: { min: 45, max: 70 },
    inicioMm: 35, fimMm: 115,
  },
  {
    id: 'tig-t',
    titulo: 'Filete em T — aço carbono 3 mm',
    aplicacao: 'Suportes e reforços de chapa fina onde o acabamento aparece.',
    objetivo: 'Filete contínuo no canto: a poça precisa molhar as duas chapas antes de cada toque da vareta.',
    material: 'aco-carbono', junta: 't', espessuraMm: 3, varetaMm: 2.4, correnteA: { min: 100, max: 140 },
    inicioMm: 35, fimMm: 115,
  },
  {
    id: 'tig-tubo',
    titulo: 'Tubo com tubo — inox 2 mm',
    aplicacao: 'Emenda de tubos finos de inox: linhas de água, de alimentos e corrimãos.',
    objetivo: 'Dar a volta inteira na emenda: funda as duas bordas com toques de vareta, apague o arco e gire o tubo (⟲ ⟳) para soldar sempre perto do alto.',
    material: 'inox-austenitico', junta: 'topo', espessuraMm: 2, varetaMm: 1.6, correnteA: { min: 55, max: 80 },
    inicioMm: 2, fimMm: 148, tubo: { diametroMm: 150 / Math.PI },
  },
]

export function pecaTig(id: string): PecaTig {
  return PECAS_TIG.find((p) => p.id === id) ?? PECAS_TIG[0]
}

/**
 * H104: a mesma peça em outra chapa (treino). A geometria fica; a física
 * térmica é a do novo material, e a corrente sugerida acompanha quanto ele
 * pede a mais ou a menos que a chapa original (arredondada de 5 em 5 A).
 */
export function pecaTigEm(p: PecaTig, material: MaterialId): PecaTig {
  if (material === p.material) return p
  const novo = MATERIAIS[material].tig, antigo = MATERIAIS[p.material].tig
  if (!novo || !antigo) throw new Error(`${MATERIAIS[material].nome} não vai ao TIG no jogo.`)
  const k = novo.fatorCorrente / antigo.fatorCorrente
  const a5 = (v: number) => Math.round((v * k) / 5) * 5
  // O título diz a chapa ("— inox 2 mm"): troca pela nova.
  const titulo = p.titulo.replace(/ — .*$/, ` — ${MATERIAIS[material].nomeCurto.toLowerCase()} ${p.espessuraMm.toLocaleString('pt-BR')} mm`)
  return { ...p, material, titulo, correnteA: { min: a5(p.correnteA.min), max: a5(p.correnteA.max) } }
}

/** A mesma peça no formato que o depósito de metal e a bancada 3D já usam (sem abertura). */
export function comoPecaBase(p: PecaTig): PecaEletrodo {
  return {
    id: p.id, titulo: p.titulo, aplicacao: p.aplicacao, porque: '', objetivo: p.objetivo,
    junta: p.junta, espessuraMm: p.espessuraMm, aberturaMm: 0, diametroMm: 2.5,
    correnteA: p.correnteA, inicioMm: p.inicioMm, fimMm: p.fimMm, sobreChapa: p.sobreChapa,
    ...(p.tubo ? { tubo: p.tubo } : {}),
  }
}
