import type { Mapeamento } from '../../entrada/fonte'
import type { GeometriaJunta } from '../../modelo/junta'
import type { ContextoProcesso } from '../../modelo/processo'
import { criarCenaExecucao3D, type CenaExecucao3D, type DadosQuadro3D } from '../../render/execucao3d'
import { webglDisponivel } from '../../render/palco3d'
import { MonitorQuadros, NOME_QUALIDADE, qualidadeAbaixo, type Qualidade3D } from '../../render/qualidade3d'
import type { Vista } from '../../render/vista'
import { NOME_BOTAO, nomeTecla } from '../../entrada/gestos'
import type { App } from '../app'
import { h } from '../dom'

/*
 * Visual 3D de uma peça soldada AO VIVO (execução e peça de teste da
 * bancada). O canvas 2D da tela continua por cima, transparente, recebendo
 * o ponteiro: a entrada pergunta a posição por `mapa`, que usa o raycast da
 * Vista3D com o 3D ligado e a Vista 2D no resto (o mesmo resultado sem
 * inclinação). O jogo é só 3D: o desenho 2D é só o plano B sem WebGL.
 * Se ficar lento, a qualidade baixa sozinha. A câmera é livre em volta da
 * peça (vista3d.ts), mexida pelos gestos (gestos.ts) ou pelo analógico
 * direito do controle, sempre com o arco fechado.
 */

export interface OpcoesVisual3D {
  serralheria?: boolean
  oficinaTreino?: boolean
  app: App
  /** Onde fica o canvas 3D (atrás do 2D). */
  area: HTMLElement
  /** Canvas 2D da tela: recebe o ponteiro e o foco. */
  canvas: HTMLCanvasElement
  vista: Vista
  /** O que a cena 3D precisa saber da peça; relido a cada `recriar()`. */
  peca: () => { contexto: ContextoProcesso; geometria: GeometriaJunta; oficinaTreino?: boolean; serralheria?: boolean; missao?: { inicioMm: number; fimMm: number; alinhamentoMm: number } }
  /** A mesma posição na tela pode ser outro ponto da junta (troca de vista ou inclinação). */
  aoMudarMapa: () => void
  /** Texto do aviso de queda de qualidade (ex.: "nesta tentativa"). */
  quando?: string
}

export interface Visual3D {
  /** Câmera (centralizar e lembrete dos controles) e aviso (vai por cima da área da peça). */
  readonly elemento: HTMLElement
  readonly mapa: Mapeamento
  /** O 3D está ligado e desenhando. */
  readonly ativo: boolean
  /** Começa no visual salvo nas preferências. Chamar depois que a tela estiver montada. */
  iniciar(): void
  ajustarTamanho(largura: number, altura: number): void
  /** Chamado a cada quadro com o 3D ativo (inclui o monitor de desempenho). */
  desenhar(d: DadosQuadro3D): void
  /** Arrastar a câmera (pixels). */
  orbitar(dx: number, dy: number): void
  /** Roda do mouse no modo aproximar. */
  aproximar(deltaY: number): void
  /** Volta a câmera para a vista de frente. */
  centralizar(): void
  /** A peça pode ter mudado (material, espessura, formato, gás, movimento): refaz a cena 3D se mudou. */
  recriar(): void
  permitePosicao(giro: number, rolagem: number): boolean
  destruir(): void
}

export function montarVisual3D(op: OpcoesVisual3D): Visual3D {
  const { app, area, canvas, vista } = op
  let modo: '2d' | '3d' = '2d'
  let cena: CenaExecucao3D | null = null
  let qualidade: Qualidade3D = app.preferencias.qualidade3d
  let largura = 0
  let altura = 0
  /** O que define a cena 3D; recriar() só refaz se isto mudou. */
  const chave = () => {
    const { contexto: c, geometria } = op.peca()
    return [c.material, c.espessuraMm, c.aberturaMm, c.junta ?? 'topo', geometria.formato, c.gas, c.tecnica ?? 'neutra', c.dbcpMm ?? 15].join('|')
  }
  let chaveAtual = ''
  const monitor = new MonitorQuadros()
  let avisouLento = false
  const temWebgl = webglDisponivel()

  const aviso = h('span', { class: 'aviso-visual', role: 'status', hidden: true })
  const avisar = (texto: string) => {
    aviso.textContent = texto
    aviso.hidden = false
  }

  /**
   * Vista de frente para a face da junta: a peça tomba em torno do eixo X
   * (palco3d.ts), e a normal da face fica a `rolagem` graus da vertical; a
   * câmera sobe a mesma elevação. Peça de pé (corrimão, vertical) → câmera
   * de lado, olhando a junta, e não as bordas de cima.
   */
  const deFrente = (rolagemGraus: number): { azimute: number; elevacao: number } => {
    // Ângulo entre −180° e 180°: o ▲ tomba para o lado negativo (182° na tela = −178°).
    const f = ((((rolagemGraus + 180) % 360) + 360) % 360) - 180
    const r = (Math.abs(f) * Math.PI) / 180
    // Normal da face (0, cos f, sin f): de lado positivo, azimute 0; negativo, do outro lado (π).
    // Perto da sobrecabeça (|f| > 150°) os dois lados quase coincidem: azimute 0 deixa as marcas legíveis.
    return f >= 0 || f <= -150 ? { azimute: 0, elevacao: r } : { azimute: Math.PI, elevacao: r }
  }
  let rolagemAtual = 0
  // Câmera livre: guardada aqui para sobreviver quando a cena é refeita (troca de peça ou de qualidade).
  // A elevação inicial sai da peça na primeira cena (a peça ainda não existe aqui).
  const camera = { azimute: 0, elevacao: 0, zoom: 1, base: 0 }
  let cameraIniciada = false
  const aplicarCamera = () => {
    cena?.vista.definirCamera(camera.azimute, camera.elevacao, camera.zoom, camera.base)
    op.aoMudarMapa()
  }
  const guardarCamera = () => {
    if (!cena) return
    camera.azimute = cena.vista.azimute
    camera.elevacao = cena.vista.elevacao
    camera.zoom = cena.vista.zoom
    camera.base = cena.vista.azimuteBase
  }
  const botaoCentralizar = h('button', { type: 'button', class: 'botao-fantasma botao-centralizar', title: 'Câmera de volta à vista de frente' }, '⌖ Centralizar')
  const lembrete = h('span', { class: 'lembrete-controles' })
  const escreverLembrete = () => {
    const c = app.preferencias.controles
    const teclas = c.teclasPeca.map(nomeTecla).join('/')
    const texto = `Câmera: ${NOME_BOTAO[c.botaoCamera]}${c.teclaCamera ? ` ou ${nomeTecla(c.teclaCamera)}` : ''} · Peça: ${NOME_BOTAO[c.botaoPeca]} ou ${teclas}`
    if (lembrete.textContent !== texto) lembrete.textContent = texto
  }
  const botaoOficina = op.oficinaTreino || op.serralheria ? h('button', { type: 'button', class: 'botao-fantasma botao-ver-cenario', title: 'Afastar a câmera para conhecer a estação' }, op.serralheria ? 'Ver serralheria' : 'Ver oficina') : null
  const zoomBotao=(rotulo:string,delta:number)=>h('button',{type:'button',class:'botao-fantasma','aria-label':rotulo,on:{click:()=>{if(cena){cena.vista.aproximar(delta);guardarCamera();op.aoMudarMapa()}}}},rotulo.startsWith('Aproximar')?'+':'−')
  const rotuloCamera = h('span', { class: 'camera-livre', hidden: true }, botaoCentralizar, zoomBotao('Afastar câmera',150), zoomBotao('Aproximar câmera',-150), botaoOficina, lembrete)
  botaoOficina?.addEventListener('click', () => {
    camera.azimute = camera.base = -0.25
    camera.elevacao = 0.8
    camera.zoom = 2.5
    aplicarCamera()
    canvas.focus()
  })
  botaoCentralizar.addEventListener('click', () => {
    const f = deFrente(rolagemAtual)
    camera.azimute = camera.base = f.azimute
    camera.elevacao = f.elevacao
    camera.zoom = 1
    aplicarCamera()
    canvas.focus()
  })
  let tAnterior: number | null = null

  const criar = (): boolean => {
    const peca = op.peca()
    cena = criarCenaExecucao3D({ ...peca, vista2d: vista, qualidade })
    if (!cena) return false
    if (!cameraIniciada) {
      cameraIniciada = true
      rolagemAtual = peca.contexto.posicaoInicial?.rolagemGraus ?? 0
      const f = deFrente(rolagemAtual)
      camera.azimute = camera.base = f.azimute
      camera.elevacao = f.elevacao
    }
    chaveAtual = chave()
    area.prepend(cena.elemento)
    cena.vista.definirCamera(camera.azimute, camera.elevacao, camera.zoom, camera.base)
    const r = area.getBoundingClientRect()
    largura = r.width
    altura = r.height
    cena.ajustarTamanho(largura, altura)
    monitor.reiniciar()
    return true
  }
  const descartar = () => {
    cena?.destruir()
    cena = null
  }

  /** O jogo é só 3D; o desenho 2D fica como plano B (sem WebGL ou 3D lento demais). */
  const definirModo = (m: '2d' | '3d') => {
    if (m === '3d' && !cena && !criar()) {
      avisar('Sem WebGL: usando o desenho 2D de reserva.')
      m = '2d'
    }
    if (m === '3d' && modo !== '3d') monitor.reiniciar()
    modo = m
    if (cena) cena.elemento.hidden = m !== '3d'
    rotuloCamera.hidden = m !== '3d'
    escreverLembrete()
    op.aoMudarMapa()
    canvas.focus()
  }

  const quando = op.quando ?? 'nesta tela'
  let arcoAberto = false
  const zoomTecla = (e: KeyboardEvent) => {
    if (!area.isConnected || !cena || arcoAberto || document.querySelector('[role="dialog"]') || (e.target as HTMLElement)?.matches('input,select,textarea')) return
    if (!['+','-','='].includes(e.key) && !['NumpadAdd','NumpadSubtract'].includes(e.code)) return
    e.preventDefault()
    api.aproximar(e.key === '-' || e.code === 'NumpadSubtract' ? 150 : -150)
  }
  window.addEventListener('keydown', zoomTecla)
  const api: Visual3D = {
    permitePosicao: (giro, rolagem) => cena?.permitePosicao(giro, rolagem) ?? true,
    elemento: h('div', { class: 'visual-sobre', role: 'group', 'aria-label': 'Câmera' }, rotuloCamera, aviso),
    mapa: { paraPeca: (px, py) => (modo === '3d' && cena ? cena.vista : vista).paraPeca(px, py) },
    get ativo() {
      return modo === '3d' && cena !== null
    },
    iniciar() {
      if (temWebgl) definirModo('3d')
      else avisar('Sem WebGL neste navegador: usando o desenho 2D de reserva.')
    },
    ajustarTamanho(l, a) {
      largura = l
      altura = a
      cena?.ajustarTamanho(l, a)
    },
    orbitar(dx, dy) {
      if (!cena) return
      cena.vista.orbitar(dx, dy)
      guardarCamera()
      op.aoMudarMapa()
    },
    aproximar(deltaY) {
      if (!cena) return
      cena.vista.aproximar(deltaY)
      guardarCamera()
      op.aoMudarMapa()
    },
    centralizar() {
      botaoCentralizar.click()
    },
    desenhar(d) {
      arcoAberto = d.arcoAberto
      rolagemAtual = d.rolagemGraus
      if (!cena) return
      // Analógico direito do controle move a câmera (arco fechado), se não estiver guiando a tocha.
      const dt = tAnterior === null ? 0 : Math.min(0.1, (d.agoraMs - tAnterior) / 1000)
      tAnterior = d.agoraMs
      const eixos = app.preferencias.controle
      if (!d.arcoAberto && dt > 0 && ![eixos.eixoX, eixos.eixoY].some((e) => e === 2 || e === 3)) {
        for (const g of navigator.getGamepads?.() ?? []) {
          if (!g) continue
          const zona = (v = 0) => (Math.abs(v) < 0.2 ? 0 : v)
          const x = zona(g.axes[2])
          const y = zona(g.axes[3])
          if (x || y) api.orbitar(x * 450 * dt, y * 450 * dt)
          break
        }
      }
      escreverLembrete()
      cena.desenhar(d)
      // Lento: baixa a qualidade. O jogo é só 3D: na mais baixa, continua em 3D e só avisa.
      if (monitor.registrar(d.agoraMs) !== 'lento') return
      const menor = qualidadeAbaixo(qualidade)
      if (!menor) {
        if (!avisouLento) avisar('O 3D está lento neste computador, mesmo na qualidade baixa.')
        avisouLento = true
        monitor.reiniciar()
        return
      }
      descartar()
      qualidade = menor
      if (criar()) avisar(`3D lento: qualidade ${NOME_QUALIDADE[menor].toLowerCase()} ${quando}.`)
      else definirModo('2d')
    },
    recriar() {
      if (!cena || chave() === chaveAtual) return
      const visivel = modo === '3d'
      descartar()
      if (criar() && cena) (cena as CenaExecucao3D).elemento.hidden = !visivel
      else if (visivel) definirModo('2d')
      if (largura > 0) cena?.ajustarTamanho(largura, altura)
    },
    destruir() {
      window.removeEventListener('keydown', zoomTecla)
      descartar()
    },
  }
  return api
}
