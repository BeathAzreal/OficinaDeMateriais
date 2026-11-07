import { CONFIG_CONTROLE_PADRAO, type ConfigControle } from '../entrada/controle'
import { CONTROLES_PADRAO, validarControles, type ControlesPeca } from '../entrada/gestos'
import { OPCOES_CANETA_PADRAO, type OpcoesCaneta } from '../entrada/ponteiro'
import { DISPOSITIVOS, type Dispositivo } from '../entrada/tipos'
import { QUALIDADES, type Qualidade3D } from '../render/qualidade3d'

/** Preferências deste navegador (dispositivo, calibração, último nome usado). */
export interface Preferencias {
  dispositivo: Dispositivo
  indiceControle: number
  controle: ConfigControle
  caneta: OpcoesCaneta
  ultimoNome: string
  /** Som do arco (H45). */
  som: boolean
  /** Qualidade do visual 3D (o jogo é só 3D; o 2D fica de reserva sem WebGL). */
  qualidade3d: Qualidade3D
  /** Câmera e giro da peça: botões do mouse, roda e teclas da caneta (gestos.ts). */
  controles: ControlesPeca
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  dispositivo: 'mouse',
  indiceControle: 0,
  controle: { ...CONFIG_CONTROLE_PADRAO },
  caneta: { ...OPCOES_CANETA_PADRAO },
  ultimoNome: '',
  som: true,
  qualidade3d: 'media',
  controles: { ...CONTROLES_PADRAO, teclasPeca: [...CONTROLES_PADRAO.teclasPeca] },
}

const numeroEntre = (v: unknown, min: number, max: number, padrao: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : padrao

/** Aceita preferências parciais ou antigas, completando com o padrão. */
export function validarPreferencias(dados: unknown): Preferencias {
  const o = (dados && typeof dados === 'object' ? dados : {}) as Record<string, unknown>
  const c = (o.controle && typeof o.controle === 'object' ? o.controle : {}) as Record<string, unknown>
  const k = (o.caneta && typeof o.caneta === 'object' ? o.caneta : {}) as Record<string, unknown>
  const P = PREFERENCIAS_PADRAO
  return {
    dispositivo: DISPOSITIVOS.includes(o.dispositivo as Dispositivo) ? (o.dispositivo as Dispositivo) : P.dispositivo,
    indiceControle: numeroEntre(o.indiceControle, 0, 7, P.indiceControle),
    controle: {
      sensibilidade: numeroEntre(c.sensibilidade, 0.25, 2, P.controle.sensibilidade),
      zonaMorta: numeroEntre(c.zonaMorta, 0, 0.5, P.controle.zonaMorta),
      botaoArco: numeroEntre(c.botaoArco, 0, 31, P.controle.botaoArco),
      botaoArcoAlternativo: numeroEntre(c.botaoArcoAlternativo, -1, 31, P.controle.botaoArcoAlternativo),
      botaoPrecisao: numeroEntre(c.botaoPrecisao, 0, 31, P.controle.botaoPrecisao),
      eixoX: numeroEntre(c.eixoX, 0, 7, P.controle.eixoX),
      eixoY: numeroEntre(c.eixoY, 0, 7, P.controle.eixoY),
      inverterY: typeof c.inverterY === 'boolean' ? c.inverterY : P.controle.inverterY,
    },
    caneta: {
      usarPressao: typeof k.usarPressao === 'boolean' ? k.usarPressao : P.caneta.usarPressao,
      limiarPressao: numeroEntre(k.limiarPressao, 0.05, 0.95, P.caneta.limiarPressao),
    },
    ultimoNome: typeof o.ultimoNome === 'string' ? o.ultimoNome.slice(0, 24) : '',
    som: typeof o.som === 'boolean' ? o.som : P.som,
    qualidade3d: QUALIDADES.includes(o.qualidade3d as Qualidade3D) ? (o.qualidade3d as Qualidade3D) : P.qualidade3d,
    controles: validarControles(o.controles),
  }
}
