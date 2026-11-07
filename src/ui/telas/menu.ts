import { vezAtual } from '../../dados/torneio'
import type { App } from '../app'
import { anexar, h } from '../dom'
import { telaCentralArcade } from './centralArcade'
import { telaConfiguracoes } from './configuracoes'
import { telaEscolhaManufatura } from './manufatura'
import { telaFabrica } from './fabrica'
import { telaRecordes } from './recordes'
import { painelTorneio } from './torneio'
import { telaTreino } from './treino'
import type { LugarMenu } from '../../render/menu3d'
import { ligarCliques, mostrarCenario } from '../cenario'
import '../../menu-grafico.css'

/** `lugar`: onde a opção fica no menu 3D (render/menu3d.ts). */
const MODOS: { titulo: string; descricao: string; lugar: LugarMenu; abrir: (app: App) => void }[] = [
  { titulo: 'FÁBRICA', lugar: 'fabrica', descricao: 'Novo: ordens de serviço que passam pela usinagem, soldagem e laboratório, como na indústria.', abrir: (app: App) => telaFabrica(app) },
  { titulo: 'ARCADE', lugar: 'arcade', descricao: 'História, desafios e versus local.', abrir: telaCentralArcade },
  { titulo: 'TREINO', lugar: 'treino', descricao: 'Sua bancada. Seu ritmo. Experimente e compare.', abrir: telaTreino },
  { titulo: 'MANUFATURA ADITIVA', lugar: 'manufatura', descricao: 'Experimental: programe o robô em INFORM e fabrique uma parede camada por camada.', abrir: telaEscolhaManufatura },
  { titulo: 'RECORDES', lugar: 'recordes', descricao: 'Reveja as marcas que você deixou na oficina.', abrir: (app: App) => telaRecordes(app) },
  { titulo: 'CONFIGURAÇÕES', lugar: 'config', descricao: 'Som, dispositivo, controles e qualidade visual.', abrir: telaConfiguracoes },
]

/** Opção escolhida por último: ao voltar ao menu, a câmera recua olhando para ela. */
let ultimoModo = 0

export function telaMenu(app: App): void {
  app.ir(() => {
    app.raiz.classList.add('tela-inicio')
    document.body.classList.add('menu-grafico')
    let selecionado = 0
    let saindo = false
    let timer = 0
    let frame = 0
    let proximo = 0
    let audio: AudioContext | null = null
    const descricao = h('p', { class: 'grafico-descricao', 'aria-live': 'polite' })
    const som = () => {
      if (!app.preferencias.som) return
      try {
        audio ??= new AudioContext()
        void audio.resume()
        const o = audio.createOscillator(), g = audio.createGain()
        o.type = 'triangle'; o.frequency.setValueAtTime(640, audio.currentTime)
        o.frequency.exponentialRampToValueAtTime(240, audio.currentTime + .055)
        g.gain.setValueAtTime(.035, audio.currentTime); g.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .07)
        o.connect(g); g.connect(audio.destination); o.start(); o.stop(audio.currentTime + .08)
      } catch { /* Som opcional: navegação continua disponível. */ }
    }
    let ativo = true
    // Menu 3D: cada opção é um lugar da fábrica; sem WebGL, fica o menu ilustrado.
    // O cenário 3D é o mesmo das outras telas: aqui a câmera volta ao centro do galpão.
    const vista = mostrarCenario(MODOS[ultimoModo].lugar, 0)
    ligarCliques({
      aoEscolher: (lugar) => abrir(MODOS.findIndex((m) => m.lugar === lugar)),
      aoPassar: (lugar) => { const i = MODOS.findIndex((m) => m.lugar === lugar); if (i >= 0) selecionar(i) },
    })
    if (vista) app.raiz.classList.add('menu-3d')
    const abrir = (i: number) => {
      if (saindo || i < 0) return
      ultimoModo = i
      saindo = true; som()
      app.raiz.classList.add('menu-saindo')
      botoes[i].classList.add('confirmado')
      if (vista) { void vista.entrar(MODOS[i].lugar).then(() => { if (ativo) MODOS[i].abrir(app) }); return }
      timer = window.setTimeout(() => MODOS[i].abrir(app), window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240)
    }
    const botoes = MODOS.map((m, i) => h('button', {
      type: 'button', class: 'grafico-opcao', style: `--ordem:${i}`, 'aria-keyshortcuts': String(i + 1),
      on: { pointerenter: () => selecionar(i), focus: () => selecionar(i), click: () => abrir(i) },
    }, h('span', {}, m.titulo), h('span', { class: 'grafico-seta', 'aria-hidden': 'true' }, '↗')))
    function selecionar(i: number, foco = false) {
      if (saindo) return
      if (i !== selecionado) som()
      selecionado = (i + MODOS.length) % MODOS.length
      botoes.forEach((b, n) => { b.classList.toggle('selecionado', n === selecionado); b.tabIndex = n === selecionado ? 0 : -1 })
      descricao.textContent = MODOS[selecionado].descricao
      vista?.focar(MODOS[selecionado].lugar, 0)
      if (foco) botoes[selecionado].focus({ preventScroll: true })
    }
    const teclas = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || document.querySelector('[role="dialog"]')) return
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); selecionar(e.key === 'Home' ? 0 : e.key === 'End' ? MODOS.length - 1 : selecionado + (e.key === 'ArrowDown' ? 1 : -1), true)
      } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= MODOS.length) { e.preventDefault(); abrir(Number(e.key) - 1) }
      else if (e.key === 'Enter' && e.target === app.raiz.querySelector('.tela-titulo')) { e.preventDefault(); abrir(selecionado) }
    }
    window.addEventListener('keydown', teclas)
    let confirmarAntes = false
    const controle = (agora: number) => {
      const g = navigator.getGamepads?.()[app.preferencias.indiceControle]
      if (g && !document.querySelector('[role="dialog"]') && document.visibilityState === 'visible') {
        const direcao = g.buttons[13]?.pressed || g.axes[1] > .55 ? 1 : g.buttons[12]?.pressed || g.axes[1] < -.55 ? -1 : 0
        if (direcao && agora > proximo) { selecionar(selecionado + direcao, true); proximo = agora + 210 }
        if (g.buttons[0]?.pressed && !confirmarAntes) abrir(selecionado)
        confirmarAntes = !!g.buttons[0]?.pressed
      }
      frame = requestAnimationFrame(controle)
    }
    const torneio = app.torneios.filter(t => t.status === 'em-andamento').sort((a,b) => b.criadoEm.localeCompare(a.criadoEm))[0]
    const vez = torneio ? vezAtual(app.baseDoTorneio(torneio.id)) : null
    anexar(app.raiz,
      h('header', { class: 'grafico-titulo' }, h('h2', { class: 'tela-titulo', tabindex: '-1' }, 'OFICINA DE', h('br'), h('strong', {}, 'SOLDAGEM'))),
      h('span', { class: 'grafico-versao' }, 'ALPHA / 2.2'),
      h('nav', { class: 'grafico-lista', 'aria-label': 'Escolher modo de jogo' }, ...botoes),
      h('div', { class: 'grafico-legenda' }, descricao,
        torneio ? h('button', { class: 'grafico-retomar', type: 'button', on: { click: () => painelTorneio(app, torneio.id) } }, `↗ Retomar ${torneio.config.nome}${vez ? ' · rodada em andamento' : ''}`) : null),
      h('footer', { class: 'grafico-rodape' }, h('span', {}, 'JOGO DIDÁTICO'), h('span', {}, vista ? '↑ ↓ ESCOLHER    ENTER CONFIRMAR    /    MOUSE: CLIQUE NO LUGAR    /    CONTROLE: A' : '↑ ↓ ESCOLHER    ENTER CONFIRMAR    /    CONTROLE: A')),
    )
    selecionar(ultimoModo)
    frame = requestAnimationFrame(controle)
    return () => {
      ativo = false; ligarCliques({}); app.raiz.classList.remove('menu-3d')
      window.removeEventListener('keydown', teclas); clearTimeout(timer); cancelAnimationFrame(frame)
      document.body.classList.remove('menu-grafico'); app.raiz.classList.remove('menu-saindo')
      void audio?.close()
    }
  }, '')
}
