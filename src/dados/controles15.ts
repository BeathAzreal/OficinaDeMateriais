export const TECLAS15 = { acionar: 'Space', aproximar: 'KeyS', afastar: 'KeyW', azMenos: 'KeyJ', azMais: 'KeyL', inclMenos: 'KeyI', inclMais: 'KeyK', rolMenos: 'KeyQ', rolMais: 'KeyE' }
export type Acao15 = keyof typeof TECLAS15
export interface Controles15 { versao?: number; teclas: Record<Acao15, string>; camera: number; ferramenta: number; acionar: number; sensibilidade: number; velocidade: number; roda: 'altura' | 'zoom'; caneta: boolean; controle: boolean; gatilho: number; zona: number; analogico: 'ferramenta' | 'camera' }
export const PADRAO15: Controles15 = { versao: 2, teclas: TECLAS15, camera: 1, ferramenta: 2, acionar: 0, sensibilidade: 0.4, velocidade: 6, roda: 'altura', caneta: true, controle: true, gatilho: 7, zona: 0.2, analogico: 'ferramenta' }
export function validarControles15(valor: unknown): Controles15 | null {
  if (!valor || typeof valor !== 'object') return null
  const c = valor as Controles15
  if (!c.teclas || !Object.keys(TECLAS15).every(k => typeof c.teclas[k as Acao15] === 'string' && /^(Key[A-Z]|Digit[0-9]|Space|Arrow(Up|Down|Left|Right))$/.test(c.teclas[k as Acao15]))) return null
  if (new Set(Object.values(c.teclas)).size !== 9 || new Set([c.acionar, c.camera, c.ferramenta]).size !== 3) return null
  if (![c.acionar, c.camera, c.ferramenta].every(n => [0, 1, 2].includes(n))) return null
  if (!Number.isFinite(c.sensibilidade) || c.sensibilidade < 0.1 || c.sensibilidade > 2 || !Number.isFinite(c.velocidade) || c.velocidade < 1 || c.velocidade > 10) return null
  if (!Number.isInteger(c.gatilho) || c.gatilho < 0 || c.gatilho > 15 || !Number.isFinite(c.zona) || c.zona < 0.05 || c.zona > 0.5) return null
  if (!['altura', 'zoom'].includes(c.roda) || !['ferramenta', 'camera'].includes(c.analogico) || typeof c.caneta !== 'boolean' || typeof c.controle !== 'boolean') return null
  return { ...c, versao: 2, teclas: { ...c.teclas } }
}
/** Nome legível de um código de tecla (KeyS → S, Space → Espaço). */
export function nomeTecla15(codigo: string): string {
  if (codigo === 'Space') return 'Espaço'
  const seta: Record<string, string> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' }
  return seta[codigo] ?? codigo.replace(/^Key|^Digit/, '')
}
export const CHAVE_CONTROLES15 = 'oficina-v15-controles-smaw'
export function migrarControles15(valor: unknown): Controles15 | null {
  if (!valor || typeof valor !== 'object') return null
  const c = structuredClone(valor) as Controles15
  if (c.versao !== 2 && c.teclas?.aproximar === 'KeyW' && c.teclas?.afastar === 'KeyS') {
    c.teclas.aproximar = 'KeyS'; c.teclas.afastar = 'KeyW'
  }
  return validarControles15(c)
}
export function carregarControles15(): Controles15 {
  try { return migrarControles15(JSON.parse(localStorage.getItem(CHAVE_CONTROLES15) ?? 'null')) ?? structuredClone(PADRAO15) } catch { return structuredClone(PADRAO15) }
}
