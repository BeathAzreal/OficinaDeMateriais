import type { PecaEletrodo } from './pecasEletrodo'
import { fatorCorrente } from '../modelo/subaquatica'

/**
 * H110: peças da solda subaquática molhada (eletrodo revestido impermeabilizado,
 * Ø 3,2 mm). A faixa de corrente da peça é a que chega ao arco (a mesma do
 * eletrodo na oficina); a fonte precisa de mais, pelo fator da profundidade.
 */
export const PECAS_SUBAQUATICA: readonly PecaEletrodo[] = [
  {
    id: 'sub-cais',
    titulo: 'Cordões no cais — primeiro mergulho',
    aplicacao: 'Estaca-prancha de aço de um cais, a 4 m, em água quase limpa.',
    porque: 'Treino de arco na água: arco curto, quase arrastando, e a corrente ligada só quando você pede.',
    sobreChapa: true,
    junta: 'topo', espessuraMm: 8, aberturaMm: 0, diametroMm: 3.2, correnteA: { min: 100, max: 125 },
    inicioMm: 20, fimMm: 130,
    objetivo: 'Um cordão reto do INÍCIO ao FIM com o arco bem curto. Peça a corrente (C), solde e peça para desligar antes de trocar a vareta.',
    subaquatica: { profundidadeM: 4, turbidez: 0.25, carbono: 0.16, ce: 0.34, local: 'Cais do porto', estrutura: 'cais' },
  },
  {
    id: 'sub-casco',
    titulo: 'Remendo no casco — balsa no fundeadouro',
    aplicacao: 'Chapa de reforço sobre um furo de corrosão no casco, a 8 m, com a balsa na água.',
    porque: 'Reparo sem docagem: o filete na borda da chapa de cima fecha o remendo.',
    junta: 'sobreposta', espessuraMm: 10, aberturaMm: 0, diametroMm: 3.2, correnteA: { min: 105, max: 130 },
    inicioMm: 10, fimMm: 140,
    objetivo: 'Filete contínuo na borda da chapa de cima, sem poro. Ande sem pressa: a água esfria a peça e endurece a ZTA.',
    subaquatica: { profundidadeM: 8, turbidez: 0.5, carbono: 0.18, ce: 0.38, local: 'Casco de balsa', estrutura: 'casco' },
  },
  {
    id: 'sub-plataforma',
    titulo: 'Reforço na perna da plataforma — 18 m',
    aplicacao: 'Nervura de reforço numa perna de jaqueta de plataforma, em água turva.',
    porque: 'Aço estrutural com mais carbono: na água a ZTA endurece; um segundo passe por cima revene.',
    junta: 't', espessuraMm: 10, aberturaMm: 0, diametroMm: 3.2, correnteA: { min: 100, max: 130 },
    inicioMm: 10, fimMm: 140,
    objetivo: 'Filete no canto com arco curto. A ZTA tende a passar de 350 HV: ande devagar e faça um segundo passe por cima (revenimento).',
    subaquatica: { profundidadeM: 18, turbidez: 0.75, carbono: 0.2, ce: 0.44, local: 'Plataforma fixa', estrutura: 'plataforma' },
  },
]

/** Corrente sugerida na fonte (A): a faixa do arco vezes o fator da água. */
export function correnteFonteSugerida(p: PecaEletrodo): { min: number; max: number } {
  const f = p.subaquatica ? fatorCorrente(p.subaquatica.profundidadeM) : 1
  return { min: Math.round(p.correnteA.min * f / 5) * 5, max: Math.round(p.correnteA.max * f / 5) * 5 }
}
