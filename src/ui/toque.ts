import { h } from './dom'
import '../toque.css'

/*
 * O que faz: o jogo no celular e no tablet (v2.2). Sem mudar cada tela:
 * - detecta tela de toque (ou ?toque=1 na URL, para testar no PC) e liga a
 *   classe `modo-toque` no corpo da página (o layout compacto está em toque.css);
 * - o dedo já funciona como o botão esquerdo do mouse (soldar, levar a
 *   ferramenta, mover a lanterna);
 * - uma barra de botões manda as teclas que cada tela usa (vareta, descer o
 *   eletrodo, manivelas do torno...), escolhidas pelo contexto da tela;
 * - os modos CÂMERA e PEÇA fazem o dedo virar o botão do meio ou o direito
 *   do mouse, que giram a câmera e a peça;
 * - o botão ☰ abre o painel lateral como gaveta.
 * Onde mexer: as teclas de cada tela estão em `teclasDaTela`.
 */

interface TeclaVirtual {
  rotulo: string
  code: string
  key: string
  /** Segurar = tecla segurada (vareta, manivela); senão, um toque. */
  segurar?: boolean
  titulo?: string
  /** Alternar = um toque segura a tecla, outro toque solta (mira da lanterna). */
  alternar?: boolean
}

const T = (rotulo: string, code: string, key: string, segurar = false, titulo?: string): TeclaVirtual => ({ rotulo, code, key, segurar, titulo })
const ENTER = T('↵ Encerrar', 'Enter', 'Enter', false, 'Encerrar a tentativa')

/** Teclas na tela para o contexto atual (texto do topo da tela, em minúsculas). */
export function teclasDaTela(contexto: string, conteudo: Element | null): TeclaVirtual[] {
  if (/torno/.test(contexto)) return [
    T('◀', 'KeyA', 'a', true, 'Carro para a placa (A)'), T('▶', 'KeyD', 'd', true, 'Carro para fora (D)'),
    T('▲ aprofunda', 'KeyW', 'w', true, 'Transversal: aprofundar (W)'), T('▼ afasta', 'KeyS', 's', true, 'Transversal: afastar (S)'),
    T('E eixo', 'KeyE', 'e', false, 'Liga/desliga o eixo'), T('⟵ auto', 'Space', ' ', false, 'Avanço automático longitudinal'),
    T('↓ facear', 'KeyF', 'f', false, 'Avanço transversal'), T('M medir', 'KeyM', 'm', false, 'Escolher instrumento'), T('0 Z', 'Digit0', '0', false, 'Zerar o Z'), ENTER,
  ]
  if (/plasma|tig/.test(contexto)) return [T('Vareta', 'Space', ' ', true, 'Mergulhar a vareta (Espaço)'), T('▲ tocha', 'KeyW', 'w', true), T('▼ tocha', 'KeyS', 's', true), T('I', 'KeyI', 'i', true, 'Inclinar'), T('K', 'KeyK', 'k', true, 'Inclinar'), ENTER]
  if (/brasagem/.test(contexto)) return [T('Vareta', 'Space', ' ', true, 'Encostar a vareta (Espaço)'), T('▲', 'KeyW', 'w', true), T('▼', 'KeyS', 's', true), T('◀', 'KeyA', 'a', true), T('▶', 'KeyD', 'd', true), ENTER]
  if (/subaqu/.test(contexto)) return [{ ...T('🔦 Mirar luz', 'KeyF', 'f', false, 'Toque para apontar a lanterna com o dedo; toque de novo para voltar ao eletrodo'), alternar: true }, T('C chave', 'KeyC', 'c', false, 'Pedir para ligar ou desligar a corrente'), T('▼ descer', 'KeyS', 's', true, 'Descer a vareta (S)'), T('▲ subir', 'KeyW', 'w', true, 'Subir (W)'), T('I', 'KeyI', 'i', true), T('K', 'KeyK', 'k', true), ENTER]
  if (/eletrodo/.test(contexto)) return [T('▼ descer', 'KeyS', 's', true, 'Descer a vareta (S)'), T('▲ subir', 'KeyW', 'w', true, 'Subir (W)'), T('I', 'KeyI', 'i', true), T('K', 'KeyK', 'k', true), ENTER]
  if (/laborat/.test(contexto)) return [T('R girar 90°', 'KeyR', 'r', false, 'Girar a amostra na lixa')]
  // MIG/MAG: só durante a solda (na preparação, Enter e P não servem).
  if (conteudo?.querySelector('canvas') && /execução|tentativa oficial|treino$/.test(contexto) && !/livre$/.test(contexto)) return [T('P pausa', 'KeyP', 'p'), ENTER]
  return []
}

function enviar(tipo: 'keydown' | 'keyup', t: TeclaVirtual, shift: boolean): void {
  // Disparado no corpo da página (sobe até a janela): as telas checam `e.target.matches(...)`.
  document.body.dispatchEvent(new KeyboardEvent(tipo, { key: t.key, code: t.code, bubbles: true, cancelable: true, shiftKey: shift }))
}

export function telaDeToque(): boolean {
  if (new URLSearchParams(location.search).get('toque') === '1') return true
  return window.matchMedia?.('(pointer: coarse)').matches === true || (navigator.maxTouchPoints > 0 && window.matchMedia?.('(hover: none)').matches === true)
}

export function instalarToque(): void {
  if (!telaDeToque()) return
  document.body.classList.add('modo-toque')
  let modo: 'normal' | 'camera' | 'peca' = 'normal'
  let rapido = false
  const segurando = new Map<number, TeclaVirtual>()

  const teclas = h('div', { class: 'toque-teclas' })
  const botaoPainel = h('button', { type: 'button', class: 'toque-painel', title: 'Abrir ou fechar o painel', 'aria-label': 'Painel' }, '☰')
  const botaoCamera = h('button', { type: 'button', class: 'toque-modo', 'aria-pressed': 'false', title: 'Dedo gira a câmera' }, '🎥 Câmera')
  const botaoPeca = h('button', { type: 'button', class: 'toque-modo', 'aria-pressed': 'false', title: 'Dedo gira a peça' }, '⟳ Peça')
  const botaoRapido = h('button', { type: 'button', class: 'toque-modo', 'aria-pressed': 'false', title: 'Manivelas rápidas (Shift)' }, '⚡ Rápido')
  const zoomMenos = h('button', { type: 'button', title: 'Afastar a câmera' }, '−')
  const zoomMais = h('button', { type: 'button', title: 'Aproximar a câmera' }, '+')
  const barra = h('div', { class: 'toque-barra', role: 'toolbar', 'aria-label': 'Controles de toque' },
    h('div', { class: 'toque-linha' }, botaoPainel, botaoCamera, botaoPeca, botaoRapido, zoomMenos, zoomMais), teclas)
  document.body.append(barra)
  const aviso = h('div', { class: 'toque-girar', role: 'status' }, 'Gire o celular: o jogo funciona melhor na horizontal.')
  document.body.append(aviso)

  const definirModo = (m: typeof modo) => {
    modo = modo === m ? 'normal' : m
    botaoCamera.setAttribute('aria-pressed', String(modo === 'camera'))
    botaoPeca.setAttribute('aria-pressed', String(modo === 'peca'))
    document.body.classList.toggle('toque-modo-camera', modo !== 'normal')
  }
  botaoCamera.addEventListener('click', () => definirModo('camera'))
  botaoPeca.addEventListener('click', () => definirModo('peca'))
  botaoRapido.addEventListener('click', () => { rapido = !rapido; botaoRapido.setAttribute('aria-pressed', String(rapido)) })
  botaoPainel.addEventListener('click', () => document.body.classList.toggle('toque-painel-aberto'))
  const zoom = (k: string, code: string) => { const t = T(k, code, k); enviar('keydown', t, false); enviar('keyup', t, false) }
  zoomMenos.addEventListener('click', () => zoom('-', 'Minus'))
  zoomMais.addEventListener('click', () => zoom('+', 'Equal'))

  // Botões de tecla: segurar = tecla segurada.
  const montarTeclas = (lista: TeclaVirtual[]) => {
    teclas.replaceChildren(...lista.map((t) => {
      const b = h('button', { type: 'button', class: 'toque-tecla', title: t.titulo ?? t.rotulo }, t.rotulo)
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault()
        if (t.alternar) {
          const ativa = b.classList.toggle('apertada')
          enviar(ativa ? 'keydown' : 'keyup', t, false)
          return
        }
        try { b.setPointerCapture(e.pointerId) } catch { /* já solto */ }
        enviar('keydown', t, rapido && /Key[WASD]/.test(t.code))
        if (t.segurar) segurando.set(e.pointerId, t)
        else enviar('keyup', t, false)
        b.classList.add('apertada')
      })
      const soltar = (e: PointerEvent) => {
        if (t.alternar) return
        const s = segurando.get(e.pointerId)
        if (s) { enviar('keyup', s, false); segurando.delete(e.pointerId) }
        b.classList.remove('apertada')
      }
      b.addEventListener('pointerup', soltar)
      b.addEventListener('pointercancel', soltar)
      b.addEventListener('contextmenu', (e) => e.preventDefault())
      return b
    }))
    botaoRapido.hidden = !lista.some((t) => t.code === 'KeyA')
  }

  // A barra acompanha a tela: atualiza quando o contexto ou o conteúdo muda.
  const contexto = document.getElementById('topo-contexto')
  const app = document.getElementById('app')
  let ultimo = ''
  const atualizar = () => {
    const texto = (contexto?.textContent ?? '').toLocaleLowerCase('pt-BR')
    const temCanvas = !!app?.querySelector('canvas') && !document.body.classList.contains('menu-grafico')
    const bancada = !!app?.querySelector('.p15, .execucao')
    const chave = `${texto}|${temCanvas}|${bancada}`
    if (chave === ultimo) return
    ultimo = chave
    const lista = temCanvas ? teclasDaTela(texto, app) : []
    // A barra só aparece nas bancadas (painel em gaveta, câmera) ou onde há teclas a apertar.
    barra.hidden = !(bancada || lista.length > 0)
    botaoPainel.hidden = !app?.querySelector('.p15-painel, .execucao .painel')
    aviso.hidden = !temCanvas
    montarTeclas(lista)
    document.body.classList.remove('toque-painel-aberto')
    if (modo !== 'normal') definirModo(modo)
  }
  const obs = new MutationObserver(() => atualizar())
  if (contexto) obs.observe(contexto, { childList: true, characterData: true, subtree: true })
  if (app) obs.observe(app, { childList: true })
  atualizar()

  // Modos câmera e peça: o dedo vira o botão do meio (câmera) ou o direito (peça).
  const MARCA = Symbol('toque')
  const remapear = (e: PointerEvent) => {
    if ((e as unknown as Record<symbol, boolean>)[MARCA] || e.pointerType !== 'touch' || modo === 'normal') return
    if (!(e.target instanceof HTMLCanvasElement)) return
    e.stopImmediatePropagation()
    e.preventDefault()
    const botao = modo === 'camera' ? 1 : 2, botoes = modo === 'camera' ? 4 : 2
    const novo = new PointerEvent(e.type, {
      bubbles: true, cancelable: true, composed: true, clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
      pointerId: e.pointerId, pointerType: 'mouse', isPrimary: e.isPrimary,
      button: e.type === 'pointermove' ? -1 : botao,
      buttons: e.type === 'pointerup' || e.type === 'pointercancel' ? 0 : botoes,
    })
    ;(novo as unknown as Record<symbol, boolean>)[MARCA] = true
    e.target.dispatchEvent(novo)
  }
  for (const tipo of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(tipo, remapear as EventListener, true)
}
