import * as THREE from 'three'
import { acabamentoCamadas } from './camadasManufatura'
import { malhaCamadas } from './malhaCamadasManufatura'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { MISSAO_PAREDE, SUBSTRATO, type Pose, type PontoEnsinado } from '../modelo/manufatura/celula'
import { type Deposito } from '../modelo/manufatura/deposicao'
import { MESA } from '../modelo/manufatura/executor'
import { nomePonto } from '../modelo/manufatura/inform'
import { webglDisponivel } from './palco3d'

/*
 * Célula 3D da Manufatura Aditiva (H106). Só LÊ o modelo: robô ilustrativo
 * (proporções de um robô de 6 eixos, sem a cinemática do MA1440), mesa,
 * substrato, parede pelo mapa de alturas, pontos ensinados e o caminho que
 * o TCP fez. Base do robô em mm → mundo em unidades de 100 mm:
 * x = X/100, y = Z/100, z = −Y/100.
 */

const E = 1 / 100
const paraMundo = (x: number, y: number, z: number) => new THREE.Vector3(x * E, z * E, -y * E)

export interface EstadoCelula {
  pose: Pose
  arco: boolean
  ctwdMm: number
  pontos: PontoEnsinado[]
  selecionado: number
  /** x, y, z, arco (1/0) a cada amostra. */
  rastro: number[]
  deposito: Deposito
  temperaturaC: number
}

export interface VistaCelula {
  readonly canvas: HTMLCanvasElement
  atualizar(e: EstadoCelula): void
  desenhar(): void
  vista(qual: 'peca' | 'celula' | 'lado'): void
  ajustarTamanho(largura: number, altura: number): void
  destruir(): void
}

/** Eixo da tocha (do flange para o TCP) pela convenção Rz·Ry·Rx dos ângulos fixos. */
export function eixoTocha(p: Pose): { x: number; y: number; z: number } {
  const r = Math.PI / 180
  const cx = Math.cos(p.rx * r), sx = Math.sin(p.rx * r), cy = Math.cos(p.ry * r), sy = Math.sin(p.ry * r), cz = Math.cos(p.rz * r), sz = Math.sin(p.rz * r)
  // R·(0, 0, 1) com R = Rz·Ry·Rx.
  return { x: cz * sy * cx + sz * sx, y: sz * sy * cx - cz * sx, z: cy * cx }
}

function rotulo(texto: string, cor: string): THREE.Sprite {
  const c = document.createElement('canvas')
  c.width = 128; c.height = 40
  const g = c.getContext('2d')!
  g.fillStyle = '#101820cc'
  g.fillRect(0, 0, 128, 40)
  g.strokeStyle = cor
  g.lineWidth = 3
  g.strokeRect(1.5, 1.5, 125, 37)
  g.fillStyle = '#f2ede2'
  g.font = '600 22px Consolas, monospace'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(texto, 64, 21)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  // Tamanho fixo na tela, de perto ou de longe.
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }))
  s.scale.set(0.085, 0.027, 1)
  s.renderOrder = 10
  return s
}

/** `missao`: desenha as marcas de início e fim da parede (o modo livre não tem). */
export function criarVistaCelula(op: { missao?: boolean } = {}): VistaCelula | null {
  if (!webglDisponivel()) return null
  let renderizador: THREE.WebGLRenderer
  try {
    renderizador = new THREE.WebGLRenderer({ antialias: true })
  } catch {
    return null
  }
  renderizador.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderizador.outputColorSpace = THREE.SRGBColorSpace
  const canvas = renderizador.domElement
  canvas.setAttribute('aria-label', 'Célula 3D: robô ilustrativo, mesa, substrato e parede. Arraste para girar, role para aproximar.')
  canvas.tabIndex = 0
  const cena = new THREE.Scene()
  cena.background = new THREE.Color('#1c2329')
  cena.fog = new THREE.Fog('#1c2329', 30, 70)
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200)
  const controles = new OrbitControls(camera, canvas)
  controles.enableDamping = true
  controles.dampingFactor = 0.12
  controles.maxPolarAngle = Math.PI * 0.49

  cena.add(new THREE.HemisphereLight('#dfe9f2', '#2a2a2a', 1.4))
  const sol = new THREE.DirectionalLight('#ffffff', 1.6)
  sol.position.set(4, 12, 6)
  cena.add(sol)
  const brilho = new THREE.PointLight('#ff9a3c', 0, 3, 2)
  cena.add(brilho)

  // Chão e mesa.
  const grade = new THREE.GridHelper(30, 30, '#3d4a55', '#2b343c')
  grade.position.y = -8
  cena.add(grade)
  const metal = (cor: string, rugosidade = 0.55) => new THREE.MeshStandardMaterial({ color: cor, metalness: 0.6, roughness: rugosidade })
  const mesa = new THREE.Mesh(new THREE.BoxGeometry((MESA.xMax - MESA.xMin) * E, 0.3, (MESA.yMax - MESA.yMin) * E), metal('#4c5660', 0.8))
  mesa.position.copy(paraMundo((MESA.xMin + MESA.xMax) / 2, (MESA.yMin + MESA.yMax) / 2, MESA.topoZ - 15))
  cena.add(mesa)
  for (const [x, y] of [[MESA.xMin + 30, MESA.yMin + 30], [MESA.xMax - 30, MESA.yMin + 30], [MESA.xMin + 30, MESA.yMax - 30], [MESA.xMax - 30, MESA.yMax - 30]]) {
    const perna = new THREE.Mesh(new THREE.BoxGeometry(0.3, 7.7, 0.3), metal('#3b434b', 0.8))
    perna.position.copy(paraMundo(x, y, MESA.topoZ - 30 - 385))
    cena.add(perna)
  }
  const substrato = new THREE.Mesh(new THREE.BoxGeometry((SUBSTRATO.xMax - SUBSTRATO.xMin) * E, (SUBSTRATO.espessuraMm - 0.1) * E, (SUBSTRATO.yMax - SUBSTRATO.yMin) * E), metal('#9aa3aa', 0.45))
  substrato.position.copy(paraMundo((SUBSTRATO.xMin + SUBSTRATO.xMax) / 2, (SUBSTRATO.yMin + SUBSTRATO.yMax) / 2, -SUBSTRATO.espessuraMm / 2 - 0.05))
  cena.add(substrato)

  // Marcas da missão: onde a parede deve começar e terminar.
  const marca = new THREE.LineBasicMaterial({ color: '#ffc440' })
  for (const x of op.missao === false ? [] : [MISSAO_PAREDE.xInicio, MISSAO_PAREDE.xFim]) {
    const g = new THREE.BufferGeometry().setFromPoints([paraMundo(x, SUBSTRATO.yMin + 4, 0.2), paraMundo(x, SUBSTRATO.yMin + 14, 0.2)])
    cena.add(new THREE.Line(g, marca))
  }

  // Parede: um campo de alturas sobre o substrato (uma célula do modelo por vértice).
  let depositoAtual: Deposito | null = null
  let paredeVersao = -1
  let parede: THREE.Mesh | null = null
  let geoParede: THREE.BufferGeometry | null = null
  const materialParede = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.5 })
  acabamentoCamadas(materialParede)
  let ultimaParedeMs = 0
  const atualizarParede = (d: Deposito, temperaturaC: number) => {
    if (depositoAtual !== d) { depositoAtual = d; paredeVersao = -1; ultimaParedeMs = -Infinity }
    if (d.versao === paredeVersao) return
    const agora = performance.now()
    if (agora - ultimaParedeMs < 120) return
    ultimaParedeMs = agora; paredeVersao = d.versao
    const malha = malhaCamadas(d), cor = new Float32Array(malha.alturas.length * 3)
    const quente = Math.max(0, Math.min(1, (temperaturaC - 300) / 500))
    for (let k = 0; k < malha.alturas.length; k++) {
      const h = malha.alturas[k]
      cor.set(h < 0.05 ? [0.6, 0.64, 0.67] : [0.72 + 0.2 * quente, 0.7 - 0.1 * quente, 0.66 - 0.2 * quente], k * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(malha.posicoes, 3))
    g.setAttribute('color', new THREE.BufferAttribute(cor, 3))
    g.setAttribute('camadaVisual', new THREE.BufferAttribute(malha.camadas, 1))
    g.setIndex(new THREE.BufferAttribute(malha.indices, 1))
    g.computeVertexNormals()
    geoParede?.dispose(); geoParede = g
    if (parede) parede.geometry = g
    else { parede = new THREE.Mesh(g, materialParede); cena.add(parede) }
  }

  // Robô ilustrativo: base, coluna, braço, antebraço, punho e tocha.
  const corRobo = new THREE.MeshStandardMaterial({ color: '#2f6fb3', metalness: 0.25, roughness: 0.5 })
  const corEscura = new THREE.MeshStandardMaterial({ color: '#2a2f35', metalness: 0.4, roughness: 0.6 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 1.2, 32), corEscura)
  base.position.set(0, -8 + 0.6, 0)
  cena.add(base)
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 6.6, 24), corEscura)
  pedestal.position.set(0, -8 + 1.2 + 3.3, 0)
  cena.add(pedestal)
  const OMBRO_Z = 0
  const giro = new THREE.Group()
  cena.add(giro)
  const coluna = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 1.4), corRobo)
  coluna.position.y = -1
  giro.add(coluna)
  const elo = (comp: number, larg: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(larg, comp, larg), corRobo)
    m.geometry.translate(0, comp / 2, 0)
    cena.add(m)
    return m
  }
  const BRACO = 6.1, ANTEBRACO = 6.4
  const braco = elo(BRACO, 0.8), antebraco = elo(ANTEBRACO, 0.6)
  const punho = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1, 16), corEscura)
  punho.geometry.translate(0, 0.5, 0)
  cena.add(punho)
  const juntas = [0, 1, 2].map(() => { const j = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), corEscura); cena.add(j); return j })
  const tocha = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 1, 16), new THREE.MeshStandardMaterial({ color: '#c9a34a', metalness: 0.8, roughness: 0.3 }))
  tocha.geometry.translate(0, 0.5, 0)
  cena.add(tocha)
  const arame = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), new THREE.MeshBasicMaterial({ color: '#e5e2da' }))
  arame.geometry.translate(0, 0.5, 0)
  cena.add(arame)
  const arcoLuz = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff3c4' }))
  cena.add(arcoLuz)
  const alvoTcp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#7cc4ff', depthTest: false }))
  alvoTcp.renderOrder = 9
  cena.add(alvoTcp)

  const cima = new THREE.Vector3(0, 1, 0)
  const apontar = (obj: THREE.Object3D, de: THREE.Vector3, para: THREE.Vector3) => {
    const d = new THREE.Vector3().subVectors(para, de)
    const comp = Math.max(1e-4, d.length())
    obj.position.copy(de)
    obj.quaternion.setFromUnitVectors(cima, d.normalize())
    return comp
  }
  const posicionarRobo = (pose: Pose, ctwdMm: number, arco: boolean) => {
    const a = eixoTocha(pose)
    const tcp = paraMundo(pose.x, pose.y, pose.z)
    const eixo = new THREE.Vector3(a.x, a.z, -a.y).normalize()
    const bico = tcp.clone().addScaledVector(eixo, -ctwdMm * E)
    const flange = bico.clone().addScaledVector(eixo, -3.6)
    const centroPunho = flange.clone().addScaledVector(eixo, -1)
    // Dois elos no plano vertical que passa pelo eixo 1 (IK ilustrativa, cotovelo para cima).
    const ang = Math.atan2(-centroPunho.z, centroPunho.x)
    giro.rotation.y = ang
    const ombro = new THREE.Vector3(1.5 * Math.cos(ang), OMBRO_Z, -1.5 * Math.sin(ang))
    const alvo = centroPunho.clone().sub(ombro)
    const r = Math.hypot(alvo.x, alvo.z), h = alvo.y
    const dist = Math.min(BRACO + ANTEBRACO - 1e-3, Math.max(Math.abs(BRACO - ANTEBRACO) + 1e-3, Math.hypot(r, h)))
    const cosC = (BRACO * BRACO + dist * dist - ANTEBRACO * ANTEBRACO) / (2 * BRACO * dist)
    const elev = Math.atan2(h, r) + Math.acos(Math.max(-1, Math.min(1, cosC)))
    const cotovelo = ombro.clone().add(new THREE.Vector3(Math.cos(ang) * Math.cos(elev) * BRACO, Math.sin(elev) * BRACO, -Math.sin(ang) * Math.cos(elev) * BRACO))
    braco.scale.y = apontar(braco, ombro, cotovelo) / BRACO
    antebraco.scale.y = apontar(antebraco, cotovelo, centroPunho) / ANTEBRACO
    punho.scale.y = apontar(punho, centroPunho, flange)
    juntas[0].position.copy(ombro); juntas[1].position.copy(cotovelo); juntas[2].position.copy(centroPunho)
    tocha.scale.y = apontar(tocha, flange, bico)
    arame.scale.y = apontar(arame, bico, tcp)
    arame.visible = true
    arcoLuz.visible = arco
    arcoLuz.position.copy(tcp)
    brilho.intensity = arco ? 3.5 : 0
    brilho.position.copy(tcp).add(new THREE.Vector3(0, 0.3, 0))
    alvoTcp.position.copy(tcp)
  }

  // Pontos ensinados.
  const grupoPontos = new THREE.Group()
  cena.add(grupoPontos)
  let chavePontos = ''
  const atualizarPontos = (pontos: PontoEnsinado[], selecionado: number) => {
    const chave = JSON.stringify(pontos.map((p) => p.pose)) + selecionado
    if (chave === chavePontos) return
    chavePontos = chave
    for (const c of [...grupoPontos.children]) {
      grupoPontos.remove(c)
      const m = c as THREE.Mesh | THREE.Sprite
      m.geometry?.dispose()
      const mat = m.material as THREE.Material & { map?: THREE.Texture }
      mat.map?.dispose()
      mat.dispose()
    }
    pontos.forEach((p, i) => {
      const sel = i === selecionado
      const esfera = new THREE.Mesh(new THREE.SphereGeometry(sel ? 0.03 : 0.02, 12, 8), new THREE.MeshBasicMaterial({ color: sel ? '#ffc440' : '#9fd3ff', depthTest: false }))
      esfera.renderOrder = 8
      esfera.position.copy(paraMundo(p.pose.x, p.pose.y, p.pose.z))
      grupoPontos.add(esfera)
      const r = rotulo(nomePonto(i), sel ? '#ffc440' : '#5b8db3')
      r.position.copy(esfera.position).add(new THREE.Vector3(0, 0.06 + (i % 2) * 0.06, 0))
      grupoPontos.add(r)
    })
  }

  // Caminho do TCP: com arco (laranja) e sem arco (azul).
  const geoRastro = new THREE.BufferGeometry()
  const rastro = new THREE.LineSegments(geoRastro, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 }))
  rastro.renderOrder = 7
  cena.add(rastro)
  let tamanhoRastro = -1
  const atualizarRastro = (r: number[]) => {
    if (r.length === tamanhoRastro) return
    tamanhoRastro = r.length
    const n = r.length / 4
    const pos = new Float32Array(Math.max(0, n - 1) * 6), cor = new Float32Array(Math.max(0, n - 1) * 6)
    for (let i = 0; i < n - 1; i++) {
      const a = paraMundo(r[i * 4], r[i * 4 + 1], r[i * 4 + 2]), b = paraMundo(r[i * 4 + 4], r[i * 4 + 5], r[i * 4 + 6])
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6)
      const arco = r[i * 4 + 7] === 1
      const c = arco ? [1, 0.55, 0.2] : [0.45, 0.75, 1]
      cor.set([...c, ...c], i * 6)
    }
    geoRastro.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geoRastro.setAttribute('color', new THREE.BufferAttribute(cor, 3))
    geoRastro.computeBoundingSphere()
  }

  const vista = (qual: 'peca' | 'celula' | 'lado') => {
    const centro = paraMundo((MISSAO_PAREDE.xInicio + MISSAO_PAREDE.xFim) / 2, MISSAO_PAREDE.y, 10)
    if (qual === 'peca') camera.position.copy(centro).add(new THREE.Vector3(0.5, 0.7, 1.5))
    else if (qual === 'lado') camera.position.copy(centro).add(new THREE.Vector3(0, 0.15, 2.6))
    else camera.position.set(15, 8.5, 15)
    controles.target.copy(qual === 'celula' ? new THREE.Vector3(4.5, 1.8, 0) : centro)
    controles.update()
  }
  vista('celula')

  return {
    canvas,
    atualizar(e) {
      atualizarParede(e.deposito, e.temperaturaC)
      atualizarPontos(e.pontos, e.selecionado)
      atualizarRastro(e.rastro)
      posicionarRobo(e.pose, e.ctwdMm, e.arco)
    },
    desenhar() {
      controles.update()
      renderizador.render(cena, camera)
    },
    vista,
    ajustarTamanho(largura, altura) {
      if (largura < 2 || altura < 2) return
      renderizador.setSize(largura, altura, false)
      camera.aspect = largura / altura
      camera.updateProjectionMatrix()
    },
    destruir() {
      controles.dispose()
      cena.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
        else if (mat) { (mat as THREE.Material & { map?: THREE.Texture }).map?.dispose(); mat.dispose() }
      })
      renderizador.dispose()
    },
  }
}
