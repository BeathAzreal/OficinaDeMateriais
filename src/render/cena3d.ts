import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Cordao } from '../modelo/cordao'
import type { AnaliseDefeitos } from '../modelo/defeitos'
import type { GeometriaJunta } from '../modelo/junta'
import type { PosicaoPeca } from '../modelo/juntas'
import { PECA } from '../modelo/parametros'
import type { ContextoProcesso } from '../modelo/processo'
import { paraMundo } from './malha3d'
import { EXAGERO_MAX, EXAGERO_MIN, EXAGERO_PADRAO, Palco3D, webglDisponivel } from './palco3d'

export { EXAGERO_MAX, EXAGERO_MIN, EXAGERO_PADRAO, webglDisponivel }

/*
 * Vista 3D da peça soldada na INSPEÇÃO e no replay: o palco comum
 * (palco3d.ts) com câmera orbital livre e uma tocha simples. Só LÊ o modelo.
 */

export interface Cena3D {
  readonly elemento: HTMLCanvasElement
  atualizarCordao(cordao: Cordao): void
  /** Defeitos visíveis (H50–H57); `empeno` dobra as chapas (só na peça fria, fora do replay). */
  atualizarDefeitos(a: AnaliseDefeitos | null, empeno: boolean): void
  /** Posição da tocha em (s, n) da junta; null esconde. */
  definirTocha(posicao: { x: number; y: number } | null, arcoAberto: boolean): void
  definirExagero(fator: number): void
  /**
   * Posição da peça na soldagem (H47): a inspeção mantém a peça como ela
   * estava em relação à gravidade (gotas penduradas para baixo); quem se
   * move é a câmera.
   */
  definirPosicao(p: PosicaoPeca): void
  vistaDeCima(): void
  vistaInicial(): void
  /** H94: olha o avesso da junta (raiz, metal pendurado, furos). */
  vistaAvesso(): void
  ajustarTamanho(largura: number, altura: number): void
  /** Fora da tela nada é desenhado (nem agendado). */
  definirVisivel(visivel: boolean): void
  destruir(): void
}

export interface OpcoesCena3D {
  contexto: ContextoProcesso
  geometria: GeometriaJunta
  /** Início e fim do trecho exigido (marcas amarelas, como na vista de cima). */
  missao?: { inicioMm: number; fimMm: number }
}

export function criarCena3D(op: OpcoesCena3D): Cena3D | null {
  const palco = Palco3D.criar({ contexto: op.contexto, geometria: op.geometria, missao: op.missao })
  if (!palco) return null
  const elemento = palco.elemento
  elemento.className = 'inspecao-tela inspecao-tela-3d'
  elemento.setAttribute('aria-label', 'Vista 3D da peça soldada: arraste para girar, role para aproximar')

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 6000)
  const controles = new OrbitControls(camera, elemento)
  controles.enableDamping = true
  controles.dampingFactor = 0.12
  controles.screenSpacePanning = true
  controles.minDistance = 25
  controles.maxDistance = 900
  // Não deixa a câmera passar para baixo do piso da sala (palco3d.ts).
  // H94 (v2.0): a câmera pode descer até o avesso da peça (raiz, metal pendurado e furos).
  controles.maxPolarAngle = Math.PI * 0.97

  // Tocha simplificada (bocal) e o clarão do arco: só durante o replay.
  const tocha = new THREE.Mesh(new THREE.CylinderGeometry(7, 5, 28, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#b08a4a', metalness: 0.9, roughness: 0.3 }))
  tocha.castShadow = true
  tocha.visible = false
  palco.peca.add(tocha)
  const clarao = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshBasicMaterial({ color: '#dff4ff' }))
  clarao.visible = false
  palco.peca.add(clarao)
  const luzArco = new THREE.PointLight('#bfe4ff', 0, 120, 2)
  palco.peca.add(luzArco)
  let tochaAtual: { x: number; y: number } | null = null
  let arcoAtual = false

  let visivel = false
  let pedido = 0
  const quadro = () => {
    pedido = 0
    if (!visivel || palco.largura === 0) return
    const mexendo = controles.update()
    palco.desenhar(camera)
    if (mexendo) pedir()
  }
  const pedir = () => {
    if (!pedido && visivel) pedido = requestAnimationFrame(quadro)
  }
  controles.addEventListener('change', pedir)

  const posicionarTocha = () => {
    const p = tochaAtual
    tocha.visible = clarao.visible = !!p
    luzArco.intensity = 0
    if (!p) return
    const q = op.geometria.pontoEm(p.x, p.y)
    const [x, , z] = paraMundo(q.x, q.y, 0)
    const base = palco.alturaEm(p.x)
    tocha.position.set(x, base + 10 + 14, z)
    clarao.position.set(x, base + 1.2, z)
    clarao.visible = arcoAtual
    luzArco.position.set(x, base + 4, z)
    luzArco.intensity = arcoAtual ? 600 : 0
  }

  /** Distância para a chapa inteira caber na tela com o campo de visão atual. */
  const distanciaEnquadrada = () => {
    const meiaFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const aspecto = camera.aspect || 1
    const meiaL = PECA.comprimentoMm / 2 + 8
    const meiaW = PECA.larguraChapaMm + 8
    return Math.max(meiaW / Math.tan(meiaFov), meiaL / (Math.tan(meiaFov) * aspecto))
  }
  let posicao: PosicaoPeca = { rolagemGraus: 0, giroGraus: 0 }
  /** Centro da peça e normal da face no mundo, com a peça na posição da soldagem. */
  const centro = new THREE.Vector3()
  const normal = new THREE.Vector3()
  const medirPeca = () => {
    palco.cena.updateMatrixWorld(true)
    palco.peca.localToWorld(centro.set(0, 0, 0))
    normal.set(0, 1, 0).transformDirection(palco.peca.matrixWorld)
  }
  /** Ângulos da câmera (polar a partir de +y, azimute) que olham a face de frente. */
  const deFrente = () => ({ polar: Math.acos(Math.max(-1, Math.min(1, normal.y))), azimute: Math.atan2(normal.x, normal.z) })
  const posicionarCamera = (polar: number, azimute: number, fator: number) => {
    const d = distanciaEnquadrada() * fator
    medirPeca()
    controles.target.copy(centro)
    camera.position.setFromSphericalCoords(d, Math.max(1e-4, Math.min(Math.PI - 1e-4, polar)), azimute).add(centro)
    camera.lookAt(controles.target)
    controles.update()
    pedir()
  }
  let jaEnquadrou = false

  const api: Cena3D = {
    elemento,
    atualizarCordao(cordao) {
      palco.atualizarCordao(cordao)
      posicionarTocha()
      pedir()
    },
    atualizarDefeitos(a, empeno) {
      palco.atualizarDefeitos(a)
      palco.definirEmpeno(a && empeno ? a.empenoGraus : 0)
      pedir()
    },
    definirTocha(posicao, arcoAberto) {
      if (posicao?.x === tochaAtual?.x && posicao?.y === tochaAtual?.y && arcoAberto === arcoAtual) return
      tochaAtual = posicao ? { x: posicao.x, y: posicao.y } : null
      arcoAtual = arcoAberto
      posicionarTocha()
      pedir()
    },
    definirExagero(fator) {
      palco.definirExagero(fator)
      posicionarTocha()
      pedir()
    },
    vistaDeCima() {
      // De frente para a face da junta (de cima na plana, de baixo na sobrecabeça).
      medirPeca()
      const f = deFrente()
      posicionarCamera(f.polar, f.polar < 0.01 ? 0 : f.azimute, 1.02)
    },
    vistaInicial() {
      medirPeca()
      const f = deFrente()
      // Inclinada em relação à face: na plana desce 0,95 rad; de cabeça para baixo sobe por baixo; de pé, só um pouco acima.
      const polar = f.polar < 1.2 ? f.polar + 0.95 : f.polar > 1.95 ? f.polar - 0.95 : f.polar - 0.35
      posicionarCamera(polar, (f.polar < 0.01 ? 0 : f.azimute) - 0.45, 0.95)
    },
    vistaAvesso() {
      medirPeca()
      const f = deFrente()
      // Do lado oposto à face, um pouco inclinado para ver o relevo da raiz.
      posicionarCamera(Math.PI - f.polar - 0.35, (f.polar < 0.01 ? 0 : f.azimute) - 0.45, 0.95)
    },
    definirPosicao(p) {
      if (p.rolagemGraus === posicao.rolagemGraus && p.giroGraus === posicao.giroGraus) return
      posicao = { ...p }
      palco.definirGiro((p.giroGraus * Math.PI) / 180)
      palco.definirRolagem(p.rolagemGraus)
      medirPeca()
      // Peça virada para baixo ou de lado: a câmera precisa poder olhar por baixo.
      if (jaEnquadrou) api.vistaInicial()
      pedir()
    },
    ajustarTamanho(l, a) {
      if (!palco.ajustarTamanho(l, a)) return
      camera.aspect = l / a
      camera.updateProjectionMatrix()
      if (!jaEnquadrou) {
        jaEnquadrou = true
        api.vistaInicial()
      }
      pedir()
    },
    definirVisivel(v) {
      visivel = v
      if (v) pedir()
      else if (pedido) {
        cancelAnimationFrame(pedido)
        pedido = 0
      }
    },
    destruir() {
      api.definirVisivel(false)
      controles.removeEventListener('change', pedir)
      controles.dispose()
      palco.destruir()
    },
  }
  return api
}
