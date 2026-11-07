/*
 * Calor acumulado na parede (H106-d). Um nó só, que representa o topo da
 * parede perto do arco: esquenta com a potência do arco e esfria para o
 * substrato pela própria parede. Quanto mais alta a parede, mais longo é o
 * caminho do calor até o substrato e mais devagar ela esfria; por isso as
 * camadas de cima pedem mais espera (TIMER) entre passes.
 *
 * É um modelo concentrado e didático: os números são do jogo, calibrados
 * para a tendência (sem espera, a parede alta superaquece), não para
 * prever a temperatura medida por um termopar.
 */

export const TERMICO = {
  ambienteC: 25,
  /** Aquecimento por kW de arco (K/s). */
  aquecimentoKPorKWs: 5,
  /** Constante de tempo de resfriamento sobre o substrato (s). */
  tauBaseS: 25,
  /** Quanto cada milímetro de parede alonga o resfriamento (s/mm). */
  tauPorMmS: 3,
}

export class Termico {
  temperaturaC = TERMICO.ambienteC

  /** Avança dt segundos com a potência do arco (W; 0 com o arco fechado) e a altura atual da parede. */
  avancar(dt: number, potenciaW: number, alturaParedeMm: number): void {
    const tau = TERMICO.tauBaseS + TERMICO.tauPorMmS * Math.max(0, alturaParedeMm)
    const ganho = TERMICO.aquecimentoKPorKWs * (potenciaW / 1000)
    // Passo exato do sistema linear dT/dt = ganho − (T − Ta)/τ: não depende do tamanho do passo.
    const equilibrio = TERMICO.ambienteC + ganho * tau
    this.temperaturaC = equilibrio + (this.temperaturaC - equilibrio) * Math.exp(-dt / tau)
  }
}
