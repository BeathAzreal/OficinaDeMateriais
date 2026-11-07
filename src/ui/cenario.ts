import { criarMenu3D, PERTO, type LugarMenu, type VistaMenu } from '../render/menu3d'
import '../menu3d.css'

/*
 * O que faz: o cenário 3D que fica atrás das telas de menu (v2.2). É criado
 * uma vez e nunca é desmontado entre telas: só a câmera muda de lugar. O
 * menu principal liga os cliques nos lugares; as outras telas usam o 3D só
 * como fundo. Telas de jogo com o próprio 3D (bancada, célula do robô,
 * fábrica) escondem e pausam o cenário.
 * Onde mexer: qual lugar cada tela mostra está em `lugarDaTela`.
 */

const cliques: { aoEscolher?: (l: LugarMenu) => void; aoPassar?: (l: LugarMenu) => void } = {}
let vista: VistaMenu | null | undefined
let caixa: HTMLElement | null = null

function obter(): VistaMenu | null {
  if (vista !== undefined) return vista
  vista = criarMenu3D(cliques)
  if (vista) {
    caixa = document.createElement('div')
    caixa.id = 'cenario-3d'
    caixa.setAttribute('aria-hidden', 'true')
    caixa.append(vista.canvas)
    document.body.prepend(caixa)
  }
  return vista
}

/**
 * Mostra o cenário com a câmera no lugar. `avanco` 0 = centro do galpão
 * (menu); PERTO = diante do lugar (telas daquele lugar). Devolve null sem WebGL.
 */
export function mostrarCenario(lugar: LugarMenu | null, avanco = PERTO): VistaMenu | null {
  const v = obter()
  if (!v) return null
  document.body.classList.add('com-cenario')
  v.retomar()
  if (lugar) v.focar(lugar, avanco)
  return v
}

export function esconderCenario(): void {
  document.body.classList.remove('com-cenario')
  vista?.pausar()
  ligarCliques({})
}

/** O menu principal liga os cliques nos lugares; as outras telas desligam. */
export function ligarCliques(c: { aoEscolher?: (l: LugarMenu) => void; aoPassar?: (l: LugarMenu) => void }): void {
  cliques.aoEscolher = c.aoEscolher
  cliques.aoPassar = c.aoPassar
}

/** Lugar do cenário para uma tela de menu, pelo contexto e pela rota (null = fica onde está). */
export function lugarDaTela(contexto: string, rota: string): LugarMenu | null {
  if (/manufatura/.test(contexto)) return 'manufatura'
  if (/fábrica|fabrica/.test(contexto)) return 'fabrica'
  const porRota: Record<string, LugarMenu> = { arcade: 'arcade', treino: 'treino', recordes: 'recordes', config: 'config' }
  return porRota[rota] ?? null
}
