import type { MaterialTornoId } from './materiais'

/*
 * Peças do torno convencional (v2.2, H108). Requisitos FICTÍCIOS do jogo,
 * escritos como objetivos didáticos (não são classes de ajuste nem norma).
 * O comprimento é medido da face livre até o ressalto, como no desenho.
 */

export interface Tolerancia { nominal: number; sup: number; inf: number }

export interface PecaTorno {
  id: string
  titulo: string
  aplicacao: string
  objetivo: string
  material: MaterialTornoId
  diametroBrutoMm: number
  balancoMm: number
  /** Sem requisitos: treino livre (só as medidas). */
  alvo: {
    diametro: Tolerancia
    comprimento: { nominal: number; tol: number }
    raMax: number
    /** A face livre precisa ser faceada (remover pelo menos isto, mm). */
    facearMinMm: number
  } | null
  /** Tempo de referência para a nota de eficiência (s). */
  tempoRefS: number
  /** Dica de processo: rotação, avanço e profundidades sugeridas. */
  dica: string
}

export const PECAS_TORNO: readonly PecaTorno[] = [
  {
    id: 'om01-eixo',
    titulo: 'OM-01 · Eixo sob medida — aço 1045',
    aplicacao: 'A ponta do eixo recebe um rolamento: o diâmetro e o acabamento importam; o resto do tarugo continua bruto.',
    objetivo: 'Faceie a ponta, desbaste e dê o passe de acabamento até Ø 36 (0/−0,05) em 50 ± 0,5 mm, com Ra ≤ 1,6 µm. Meça antes do acabamento.',
    material: 'aco-1045', diametroBrutoMm: 40, balancoMm: 75,
    alvo: { diametro: { nominal: 36, sup: 0, inf: -0.05 }, comprimento: { nominal: 50, tol: 0.5 }, raMax: 1.6, facearMinMm: 0.5 },
    tempoRefS: 240,
    dica: 'Aço: 1120–1800 rpm (vc 150–250 m/min). Desbaste com avanço 0,2–0,25 e até 2 mm de profundidade; acabamento com 0,08 e 0,2–0,3 mm. Abaixo de ~120 m/min a aresta postiça estraga o acabamento.',
  },
  {
    id: 'pino-aluminio',
    titulo: 'Pino esbelto — alumínio 6061',
    aplicacao: 'Pino de articulação de uma tampa: peça comprida e fina em balanço, que vibra se o corte for pesado.',
    objetivo: 'Ø 20 ± 0,05 em 45 ± 0,3 mm, Ra ≤ 1,6 µm. Peça esbelta: passes leves perto da ponta para ela não vibrar.',
    material: 'aluminio-6061', diametroBrutoMm: 25, balancoMm: 70,
    alvo: { diametro: { nominal: 20, sup: 0.05, inf: -0.05 }, comprimento: { nominal: 45, tol: 0.3 }, raMax: 1.6, facearMinMm: 0.3 },
    tempoRefS: 200,
    dica: 'Alumínio: rotação alta (1800 rpm dá ~140 m/min no Ø 25; ainda abaixo do ideal). Profundidade pequena (≤ 1 mm) e avanço moderado: a peça é 2,8 vezes mais comprida que grossa.',
  },
  {
    id: 'bucha-latao',
    titulo: 'Bucha de acabamento fino — latão',
    aplicacao: 'Assento de uma vedação: o acabamento é mais exigente que a medida.',
    objetivo: 'Ø 26 ± 0,05 em 30 ± 0,3 mm, Ra ≤ 0,8 µm. O latão corta fácil: o desafio é o passe final liso.',
    material: 'latao-360', diametroBrutoMm: 30, balancoMm: 50,
    alvo: { diametro: { nominal: 26, sup: 0.05, inf: -0.05 }, comprimento: { nominal: 30, tol: 0.3 }, raMax: 0.8, facearMinMm: 0.3 },
    tempoRefS: 180,
    dica: 'Latão: 1800 rpm. Para Ra ≤ 0,8 µm com ponta de 0,8 mm, o avanço do acabamento precisa ficar perto de 0,05 mm/volta (Ra ≈ f²/8rε).',
  },
  {
    id: 'livre',
    titulo: 'Tarugo livre — escolha o material',
    aplicacao: 'Sem desenho: experimente rotação, avanço e profundidade e veja o cavaco, o acabamento e o desgaste.',
    objetivo: 'Teste à vontade. O resultado mostra só as medidas da peça.',
    material: 'aco-1045', diametroBrutoMm: 40, balancoMm: 75,
    alvo: null, tempoRefS: 300,
    dica: 'Mude uma coisa por vez e compare a rugosidade e o cavaco.',
  },
]
