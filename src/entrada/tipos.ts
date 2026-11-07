/** Dispositivos de entrada reconhecidos pelo jogo (docs/DISPOSITIVOS.md). */
export type Dispositivo = 'mouse' | 'caneta' | 'controle'

export const DISPOSITIVOS: Dispositivo[] = ['mouse', 'caneta', 'controle']

export const NOME_DISPOSITIVO: Record<Dispositivo, string> = {
  mouse: 'Mouse',
  caneta: 'Mesa digitalizadora (caneta)',
  controle: 'Controle (gamepad)',
}
