import type { PecaEletrodo } from './pecasEletrodo'
import { MATERIAIS, type MaterialId } from '../modelo/material'
import { autoFluxante, BASE_BRASAGEM, LIGAS, type PecaBrasagemBase, type PreparoBrasagem } from '../modelo/brasagem'

/**
 * Peças do treino de brasagem (H105): juntas sobrepostas, onde a liga entra
 * na folga por capilaridade. Cada peça traz o preparo que um brasador usaria
 * (liga, fluxo, bico e chama); no treino dá para mudar tudo e ver o efeito.
 * Folgas e sobreposições na faixa usual de brasagem (folga de 0,05 a 0,1 mm,
 * sobreposição de 3 a 4 vezes a espessura).
 */
export interface PecaBrasagem extends PecaBrasagemBase {
  id: string
  titulo: string
  aplicacao: string
  objetivo: string
  /** Por que esta liga e este preparo. */
  porque: string
  recomendado: PreparoBrasagem
}

export const PECAS_BRASAGEM: readonly PecaBrasagem[] = [
  {
    id: 'bras-aco-prata',
    titulo: 'Suporte de aço — prata 45 %',
    aplicacao: 'Chapas finas de aço sobrepostas: suportes, ferragens e peças que não podem empenar.',
    objetivo: 'Aqueça a sobreposição até o vermelho-cereja, encoste a vareta na borda e deixe a liga correr para dentro da folga, do INÍCIO ao FIM, com um filete fino na borda.',
    porque: 'A prata corre a 745–845 °C, longe de fundir o aço, e o fluxo branco limpa o óxido. Chapa fina pede bico pequeno.',
    material: 'aco-carbono', espessuraMm: 1.5, sobreposicaoMm: 6, folgaMm: 0.06, inicioMm: 50, fimMm: 100,
    recomendado: { liga: 'prata-45', fluxo: true, bico: 2, chama: 'neutra' },
  },
  {
    id: 'bras-cobre',
    titulo: 'Barramento de cobre — cobre-fósforo',
    aplicacao: 'Barras e chapas de cobre de painéis elétricos e aterramento.',
    objetivo: 'O cobre puxa o calor para longe: aqueça bastante a sobreposição antes de encostar a vareta e mantenha a chama andando junto com a liga.',
    porque: 'O fósforo da liga limpa o óxido do cobre sozinho: no cobre, dispensa fluxo. O cobre conduz muito calor e pede o bico grande.',
    material: 'cobre', espessuraMm: 1.5, sobreposicaoMm: 6, folgaMm: 0.08, inicioMm: 50, fimMm: 100,
    recomendado: { liga: 'cu-p', fluxo: false, bico: 5, chama: 'neutra' },
  },
  {
    id: 'bras-galv-prata',
    titulo: 'Grade galvanizada — prata sem queimar o zinco',
    aplicacao: 'Reparo de grade e calha galvanizadas sem perder a proteção do zinco em volta.',
    objetivo: 'Una as chapas com a liga de prata sem passar de 907 °C: acima disso o zinco ferve e a chapa perde a proteção em volta da junta.',
    porque: 'A prata trabalha abaixo da fervura do zinco (907 °C); o latão, a 910–955 °C, queimaria o zinco.',
    material: 'aco-galvanizado', espessuraMm: 1.5, sobreposicaoMm: 6, folgaMm: 0.06, inicioMm: 50, fimMm: 100,
    recomendado: { liga: 'prata-45', fluxo: true, bico: 2, chama: 'neutra' },
  },
  {
    id: 'bras-aco-latao',
    titulo: 'Luva de quadro — latão',
    aplicacao: 'Quadros de bicicleta com luvas e estruturas tubulares leves de aço.',
    objetivo: 'O latão só corre acima de 900 °C e trava logo abaixo: esquente por igual o lado de dentro da sobreposição, não só a borda, e alimente a vareta aos poucos.',
    porque: 'Liga barata e resistente, para aço. Faixa de trabalho estreita (910–955 °C): pede bico maior e calor bem espalhado; acima de 980 °C o zinco do latão ferve.',
    material: 'aco-carbono', espessuraMm: 1.5, sobreposicaoMm: 6, folgaMm: 0.08, inicioMm: 50, fimMm: 100,
    recomendado: { liga: 'latao', fluxo: true, bico: 4, chama: 'neutra' },
  },
]

export function pecaBrasagem(id: string): PecaBrasagem {
  return PECAS_BRASAGEM.find((p) => p.id === id) ?? PECAS_BRASAGEM[0]
}

/**
 * A mesma peça em outra chapa (treino). A geometria fica; o preparo
 * recomendado segue a chapa: cobre pede o bico maior e dispensa fluxo com
 * cobre-fósforo; aço nunca leva cobre-fósforo (fosfeto frágil).
 */
export function pecaBrasagemEm(p: PecaBrasagem, material: MaterialId): PecaBrasagem {
  if (material === p.material) return p
  const base = BASE_BRASAGEM[material]
  if (!base) throw new Error(`${MATERIAIS[material].nome} não vai à brasagem no jogo.`)
  let liga = p.recomendado.liga
  if (base.ferroso && LIGAS[liga].fosforo) liga = 'prata-45'
  if (material === 'aco-galvanizado' && liga === 'latao') liga = 'prata-45'
  const bico = material === 'cobre' ? 5 : p.material === 'cobre' ? 2 : p.recomendado.bico
  const fluxo = !autoFluxante(LIGAS[liga], material)
  const nome = MATERIAIS[material].nomeCurto.toLowerCase()
  return { ...p, material, titulo: p.titulo.replace(/^(.*?) — /, `$1 em ${nome} — `), recomendado: { ...p.recomendado, liga, bico, fluxo } }
}

/** A mesma peça no formato que a bancada 3D já usa: junta sobreposta, sem abertura. */
export function comoPecaBaseBrasagem(p: PecaBrasagem): PecaEletrodo {
  return {
    id: p.id, titulo: p.titulo, aplicacao: p.aplicacao, porque: p.porque, objetivo: p.objetivo,
    junta: 'sobreposta', material: p.material, espessuraMm: p.espessuraMm, aberturaMm: 0, diametroMm: 2.5,
    correnteA: { min: 0, max: 0 }, inicioMm: p.inicioMm, fimMm: p.fimMm,
  }
}
