import type { Amostra } from '../modelo/trajetoria'
import type { Dispositivo } from './tipos'

/*
 * Camada comum de entrada (docs/DISPOSITIVOS.md).
 *
 * Toda fonte entrega a mesma coisa à simulação: leituras { t, x, y } em
 * milímetros da peça e em milissegundos do relógio de alto desempenho, mais
 * abrir e fechar o arco. A simulação não sabe qual dispositivo está em uso.
 */

/** Quem recebe as leituras (a Simulacao satisfaz esta interface). */
export interface Receptor {
  iniciarArco(a: Amostra): void
  moverTocha(a: Amostra): void
  encerrarArco(a: Amostra): void
  readonly arcoAberto: boolean
}

/**
 * Converte pixels da tela em coordenadas da junta (s, n) em mm, já
 * considerando o giro da peça e o formato da junta (a Vista satisfaz esta
 * interface; H41, H42).
 */
export interface Mapeamento {
  paraPeca(px: number, py: number): { x: number; y: number }
}

export interface Extras {
  /** 0–1, quando a caneta informa. */
  pressao?: number
  /** Graus, quando a caneta informa. */
  inclinacaoX?: number
  inclinacaoY?: number
}

export interface FonteEntrada {
  readonly dispositivo: Dispositivo
  /** Começa a enviar leituras ao receptor. */
  ligar(receptor: Receptor): void
  desligar(): void
  /** Chamado a cada quadro (o controle precisa ser consultado; ponteiros ignoram). */
  atualizar(agoraMs: number): void
  /** Falso se o dispositivo sumiu (controle desconectado). */
  readonly conectado: boolean
  /** Última posição conhecida (mm), para desenhar a tocha. */
  readonly posicao: { x: number; y: number } | null
  readonly gatilho: boolean
  readonly extras: Extras
  /** Avisado quando o dispositivo ativo se desconecta. */
  aoDesconectar: (() => void) | null
}
