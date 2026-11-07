import type { ContextoProcesso } from './processo'
import { Simulacao, type EventoTentativa } from './simulacao'

/**
 * Reproduz uma tentativa a partir do registro de eventos. Como a simulação
 * não depende dos quadros, o cordão reproduzido é igual ao original — é isso
 * que permite ao professor inspecionar a solda sem depender de uma captura
 * de tela.
 */
export function reproduzir(contexto: ContextoProcesso, eventos: readonly EventoTentativa[]): Simulacao {
  const sim = new Simulacao(contexto)
  for (const e of eventos) {
    if (e.tipo === 'ajustes') sim.definirAjustes(e.ajustes)
    else if (e.tipo === 'posicao') sim.definirPosicao(e)
    else if (e.tipo === 'inicio') sim.iniciarArco(e)
    else if (e.tipo === 'mover') sim.moverTocha(e)
    else sim.encerrarArco(e)
  }
  return sim
}
