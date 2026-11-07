import type { Preferencias } from '../dados/preferencias'
import { FonteControle } from './controle'
import type { FonteEntrada, Mapeamento } from './fonte'
import { FontePonteiro } from './ponteiro'
import type { Dispositivo } from './tipos'

/** Cria a fonte de entrada do dispositivo escolhido, já com a calibração salva. */
export function criarFonte(
  dispositivo: Dispositivo,
  alvo: HTMLElement,
  mapa: Mapeamento,
  prefs: Preferencias,
  inicio: { x: number; y: number },
  limites: { xMin: number; xMax: number; yMin: number; yMax: number },
): FonteEntrada {
  if (dispositivo === 'controle') {
    const c = new FonteControle(prefs.indiceControle, prefs.controle, inicio)
    c.definirLimites(limites)
    return c
  }
  return new FontePonteiro(dispositivo, alvo, mapa, prefs.caneta)
}
