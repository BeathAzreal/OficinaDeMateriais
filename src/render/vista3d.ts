import * as THREE from 'three'
import type { GeometriaJunta } from '../modelo/junta'
import { PECA } from '../modelo/parametros'
import { paraMundo } from './malha3d'
import { Vista } from './vista'
import { acertarTubo, curvarPonto, desdobrarPonto, type CurvaTubo } from './curvaTubo'

/*
 * Câmera fixa da EXECUÇÃO em 3D e o equivalente 3D de Vista (paraPeca,
 * ponto, rumoNaTela). Olha de cima para o centro da chapa, como a vista 2D,
 * com leve perspectiva (campo de visão estreito). A distância é escolhida
 * para que, no plano do topo da chapa, 1 mm ocupe os mesmos pixels da Vista
 * 2D: sem inclinação, a mira 3D é a mesma do 2D.
 *
 * Zoom, pivô e giro vêm de uma Vista 2D (a mesma da tela, se for passada):
 * tela → raio da câmera → plano do topo da chapa (y = 0) → desfaz o giro em
 * torno do pivô → chapa (X, Y) → junta (s, n) pela geometria, como no 2D.
 */

/** Campo de visão vertical (graus): estreito para a perspectiva ser leve. */
export const FOV_EXECUCAO_GRAUS = 30
/**
 * Câmera livre em volta da peça (v1.3): dá a volta inteira em torno da
 * normal da face (azimute) e desce até 80° dela (elevação), por cima da
 * face: um domo de 160° de lado a lado. Mais que isso, a mira fica rasante.
 */
export const ELEVACAO_MAX_GRAUS = 80
/** Compatibilidade: o limite antigo da inclinação é o da elevação. */
export const INCLINACAO_MAX_GRAUS = ELEVACAO_MAX_GRAUS
/** Aproximar e afastar (fator da distância de enquadramento). */
export const ZOOM_MIN = 0.4
export const ZOOM_MAX = 2.5
/** Radianos de câmera por pixel arrastado. */
const RAD_POR_PIXEL = 0.006

export class Vista3D {
  readonly camera = new THREE.PerspectiveCamera(FOV_EXECUCAO_GRAUS, 1, 1, 5000)
  /** Afastamento da normal da face (radianos; 0 = de frente, como a vista de cima 2D). */
  elevacao = 0
  /** Volta em torno da normal (radianos; 0 = inclinando para baixo da tela). */
  azimute = 0
  /**
   * Centro do arco de 180° do azimute. 0 normalmente; π quando a vista de
   * frente para a face fica do outro lado (peça tombada para trás).
   */
  azimuteBase = 0
  /** Fator da distância (1 = mesmo enquadramento do 2D). */
  zoom = 1
  /** Inclinação física da peça, independente da câmera. */
  rolagem = 0
  private matrizPeca: THREE.Matrix4 | null = null
  definirMatrizPeca(m: THREE.Matrix4): void { this.matrizPeca = m.clone() }
  /** H103: curvatura do tubo (a mesma do palco); null nas chapas. */
  private curva: CurvaTubo | null = null
  definirTubo(c: CurvaTubo | null): void { this.curva = c }

  definirRolagem(graus: number): void { this.rolagem = THREE.MathUtils.degToRad(graus) }
  // Reaproveitados a cada leitura: nada é alocado por evento de ponteiro.
  private readonly raio = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()
  private readonly topo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private readonly alvo = new THREE.Vector3()

  /** `plano`: a Vista 2D cujo zoom, pivô e giro esta vista segue. */
  constructor(readonly plano: Vista = new Vista()) {}

  get escala(): number {
    return this.plano.escala
  }

  get larguraCss(): number {
    return this.plano.larguraCss
  }

  get alturaCss(): number {
    return this.plano.alturaCss
  }

  get angulo(): number {
    return this.plano.angulo
  }

  get geometria(): GeometriaJunta {
    return this.plano.geometria
  }

  set geometria(g: GeometriaJunta) {
    this.plano.geometria = g
    this.atualizarCamera()
  }

  ajustar(larguraCss: number, alturaCss: number): void {
    this.plano.ajustar(larguraCss, alturaCss)
    this.atualizarCamera()
  }

  definirAngulo(angulo: number): void {
    this.plano.definirAngulo(angulo)
  }

  /** Inclinação de antes (só a elevação, para o lado de baixo da tela). */
  get inclinacao(): number {
    return this.elevacao
  }

  definirInclinacao(radianos: number): void {
    this.definirCamera(0, Math.min(THREE.MathUtils.degToRad(INCLINACAO_MAX_GRAUS), Math.max(0, radianos)))
  }

  /** Posição da câmera em volta da peça (radianos). Azimute limitado a ±90° em volta de `azimuteBase` e elevação de 0° a 180°. */
  definirCamera(azimute: number, elevacao: number, zoom = this.zoom, base = this.azimuteBase): void {
    this.azimuteBase = base
    this.azimute = Math.max(base - Math.PI / 2, Math.min(base + Math.PI / 2, azimute))
    this.elevacao = Math.max(0, Math.min(Math.PI, elevacao))
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom))
    this.atualizarCamera()
  }

  /** Arrastar a câmera: para os lados dá a volta na peça; para cima e para baixo muda a elevação. */
  orbitar(dxPx: number, dyPx: number): void {
    this.definirCamera(this.azimute - dxPx * RAD_POR_PIXEL, this.elevacao + dyPx * RAD_POR_PIXEL)
  }

  /** Roda do mouse: para a frente aproxima. */
  aproximar(deltaY: number): void {
    this.definirCamera(this.azimute, this.elevacao, this.zoom * Math.exp(deltaY * 0.0015))
  }

  /** De volta para a vista de frente, sem zoom. */
  centralizar(): void {
    this.definirCamera(0, 0, 1)
  }

  /** Distância da câmera ao centro da chapa (mm), com o zoom. */
  get distancia(): number {
    const meiaFov = THREE.MathUtils.degToRad(FOV_EXECUCAO_GRAUS / 2)
    return (this.plano.alturaCss / this.plano.escala / (2 * Math.tan(meiaFov))) * this.zoom
  }

  private atualizarCamera(): void {
    const { larguraCss: w, alturaCss: h } = this.plano
    if (w <= 0 || h <= 0) return
    const d = this.distancia
    const c = this.camera
    c.aspect = w / h
    c.near = d * 0.2
    // A sala da oficina (palco3d.ts) fica a até ~3 m: o fundo tem de caber.
    c.far = d * 4 + 4500
    // Com azimute 0 inclina para o lado de baixo da tela (+z): o jogador vê a peça "de frente".
    const p = this.elevacao
    const a = this.azimute
    c.position.set(d * Math.sin(p) * Math.sin(a), d * Math.cos(p), d * Math.sin(p) * Math.cos(a))
    // Para cima na tela = −z do mundo (o y da vista de cima cresce para baixo), girando com o azimute.
    c.up.set(-Math.sin(a) * Math.cos(p), Math.sin(p), -Math.cos(a) * Math.cos(p))
    c.lookAt(0, 0, 0)
    c.updateProjectionMatrix()
    c.updateMatrixWorld()
  }

  /** Pivô do giro no mundo (x, z), o mesmo de Vista e de Palco3D. */
  private pivoMundo(): { x: number; z: number } {
    const p = this.geometria.centro ?? { x: PECA.comprimentoMm / 2, y: 0 }
    const [x, , z] = paraMundo(p.x, p.y, 0)
    return { x, z }
  }

  /** Tela → chapa (X, Y), pelo raio da câmera no plano do topo da chapa. */
  paraChapa(px: number, py: number): { x: number; y: number } {
    const { larguraCss: w, alturaCss: h } = this.plano
    this.ndc.set((px / w) * 2 - 1, 1 - (py / h) * 2)
    this.raio.setFromCamera(this.ndc, this.camera)
    const pv = this.pivoMundo()
    const normal = new THREE.Vector3(0, Math.cos(this.rolagem), Math.sin(this.rolagem))
    this.topo.setFromNormalAndCoplanarPoint(normal, new THREE.Vector3(pv.x, 0, pv.z))
    if (this.matrizPeca && this.curva) {
      // H103: raio no espaço da peça → superfície do tubo → junta desenrolada.
      const inv = this.matrizPeca.clone().invert()
      const o = this.raio.ray.origin.clone().applyMatrix4(inv)
      const d = this.raio.ray.direction.clone().transformDirection(inv)
      const c = this.curva
      let q = acertarTubo(c, o, d)
      if (!q) {
        // Fora do tubo (rasante): o ponto do contorno mais perto, pelo plano do eixo.
        const t = Math.abs(d.y) > 1e-9 ? (-c.raio - o.y) / d.y : 0
        const X = Math.max(-c.raio, Math.min(c.raio, o.x + d.x * t))
        q = new THREE.Vector3(X, Math.sqrt(Math.max(0, c.raio * c.raio - X * X)) - c.raio, o.z + d.z * t)
      }
      const p = desdobrarPonto(c, q.x, q.y, q.z)
      return { x: p.x + PECA.comprimentoMm / 2, y: p.z }
    }
    if (this.matrizPeca) {
      this.topo.set(new THREE.Vector3(0, 1, 0), 0).applyMatrix4(this.matrizPeca)
      if (!this.raio.ray.intersectPlane(this.topo, this.alvo)) return this.plano.paraChapa(px, py)
      this.alvo.applyMatrix4(this.matrizPeca.clone().invert())
      return { x: this.alvo.x + PECA.comprimentoMm / 2, y: this.alvo.z }
    }
    // Raio que não desce até o plano da chapa (câmera rasante, olhando acima do horizonte): cai no 2D.
    if (!this.raio.ray.intersectPlane(this.topo, this.alvo)) return this.plano.paraChapa(px, py)
    this.alvo.sub(new THREE.Vector3(pv.x, 0, pv.z)).applyAxisAngle(new THREE.Vector3(1, 0, 0), -this.rolagem).add(new THREE.Vector3(pv.x, 0, pv.z))
    const dx = this.alvo.x - pv.x
    const dz = this.alvo.z - pv.z
    // Desfaz o giro da peça (horário na tela, como Vista.angulo).
    const c = Math.cos(this.angulo)
    const s = Math.sin(this.angulo)
    return { x: pv.x + dx * c + dz * s + PECA.comprimentoMm / 2, y: pv.z - dx * s + dz * c }
  }

  /** Chapa (X, Y) a uma altura Z (mm, já com exagero) → tela. */
  daChapa(X: number, Y: number, Z = 0): { x: number; y: number } {
    if (this.matrizPeca) {
      if (this.curva) curvarPonto(this.curva, X - PECA.comprimentoMm / 2, Z, Y, this.alvo)
      else this.alvo.set(X - PECA.comprimentoMm / 2, Z, Y)
      this.alvo.applyMatrix4(this.matrizPeca).project(this.camera)
      return { x: (this.alvo.x + 1) / 2 * this.plano.larguraCss, y: (1 - this.alvo.y) / 2 * this.plano.alturaCss }
    }
    const pv = this.pivoMundo()
    const dx = X - PECA.comprimentoMm / 2 - pv.x
    const dz = Y - pv.z
    const c = Math.cos(this.angulo)
    const s = Math.sin(this.angulo)
    this.alvo.set(dx * c - dz * s, Z, dx * s + dz * c)
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), this.rolagem)
      .add(new THREE.Vector3(pv.x, 0, pv.z)).project(this.camera)
    return { x: ((this.alvo.x + 1) / 2) * this.plano.larguraCss, y: ((1 - this.alvo.y) / 2) * this.plano.alturaCss }
  }

  /** Junta (s, n) → tela. */
  ponto(s: number, n = 0): { x: number; y: number } {
    const p = this.geometria.pontoEm(s, n)
    return this.daChapa(p.x, p.y)
  }

  /** Direção da junta em s, já na tela (radianos). Com inclinação, a perspectiva entra aqui. */
  rumoNaTela(s: number): number {
    // Mesma tangente da Vista 2D (rumoEm), projetada: sem inclinação dá rumoEm + giro.
    const p = this.geometria.pontoEm(s)
    const r = this.geometria.rumoEm(s)
    const a = this.daChapa(p.x, p.y)
    const b = this.daChapa(p.x + Math.cos(r), p.y + Math.sin(r))
    return Math.atan2(b.y - a.y, b.x - a.x)
  }

  /** Tela → junta (s, n): o que as fontes de entrada mandam para o modelo (Mapeamento). */
  paraPeca(px: number, py: number): { x: number; y: number } {
    const p = this.paraChapa(px, py)
    return this.geometria.projetar(p.x, p.y)
  }
}
