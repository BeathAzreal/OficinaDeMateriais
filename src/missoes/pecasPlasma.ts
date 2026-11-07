import type { PecaTig } from './pecasTig'

/**
 * Peças do treino de soldagem a plasma (PAW, H107). Duas técnicas:
 * - keyhole: chapa média, junta de topo reta (sem chanfro), uma passada
 *   atravessa a espessura toda; vareta opcional.
 * - melt-in (microplasma): chapa fina, pouca corrente e pouco gás, sem furo
 *   passante; cordão estreito.
 * Correntes e vazões são faixas do jogo, calibradas no modelo (testes), não
 * recomendação de fabricante.
 */
export interface PecaPlasma extends PecaTig {
  tecnica: 'keyhole' | 'melt-in'
  /** Vazão de gás de plasma sugerida (L/min). */
  gasLMin: { min: number; max: number }
  /** Velocidade de avanço sugerida (mm/s). */
  avancoMmS: { min: number; max: number }
}

export const PECAS_PLASMA: readonly PecaPlasma[] = [
  {
    id: 'plasma-keyhole-inox',
    titulo: 'Keyhole em topo reto — inox 4 mm',
    aplicacao: 'Tanques e tubos de inox soldados de uma passada, sem chanfro: a técnica que diferencia o plasma do TIG.',
    objetivo: 'Abra o keyhole (o jato fura a chapa), avance constante para o furo fechar atrás e, no fim, solte o pedal devagar (rampa de descida) para fechar o furo.',
    material: 'inox-austenitico', junta: 'topo', espessuraMm: 4, varetaMm: 1.6,
    correnteA: { min: 120, max: 170 }, gasLMin: { min: 1, max: 2.5 }, avancoMmS: { min: 2, max: 4 },
    inicioMm: 35, fimMm: 115, tecnica: 'keyhole',
  },
  {
    id: 'plasma-keyhole-aco',
    titulo: 'Keyhole em topo reto — aço carbono 5 mm',
    aplicacao: 'Vasos e estruturas de aço carbono: menos passes e sem preparar chanfro.',
    objetivo: 'Mesmo keyhole, numa chapa mais grossa: pede mais corrente e um pouco mais de paciência para o furo abrir.',
    material: 'aco-carbono', junta: 'topo', espessuraMm: 5, varetaMm: 2.4,
    correnteA: { min: 160, max: 210 }, gasLMin: { min: 1, max: 3 }, avancoMmS: { min: 2, max: 3.5 },
    inicioMm: 35, fimMm: 115, tecnica: 'keyhole',
  },
  {
    id: 'plasma-micro',
    titulo: 'Microplasma — borda de inox 1 mm',
    aplicacao: 'Chapa muito fina (foles, telas, instrumentos): arco estável com poucos ampères, onde o TIG fura com facilidade.',
    objetivo: 'Pouco gás (sem keyhole) e pouca corrente: um cordão estreito e contínuo do INÍCIO ao FIM, sem furar.',
    material: 'inox-austenitico', junta: 'topo', espessuraMm: 1, varetaMm: 1.6,
    correnteA: { min: 12, max: 20 }, gasLMin: { min: 0.3, max: 0.6 }, avancoMmS: { min: 2, max: 5 },
    inicioMm: 35, fimMm: 115, tecnica: 'melt-in',
  },
]
