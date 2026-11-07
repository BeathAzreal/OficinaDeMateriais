import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { webglDisponivel } from './palco3d'

/*
 * O que faz: o Laboratório de Falhas em 3D (v2.2, H109). Uma bancada com as
 * estações em fila: recepção (o braço tensor quebrado e a lanterna),
 * cortadeira, lixas, politriz, capela de ataque, microscópio e
 * microdurômetro. A tela escolhe a estação e a câmera vai até ela; as ações
 * de precisão (passar a lixa, focar) acontecem nas janelas por cima.
 * Unidade: 1 = 1 cm. A bancada corre ao longo do eixo X.
 */

export type Estacao = 'inspecao' | 'corte' | 'preparo' | 'microscopio' | 'microdureza'

export interface VistaLaboratorio {
  canvas: HTMLCanvasElement
  irPara(e: Estacao): void
  /** Lanterna da inspeção: elevação (graus sobre a superfície) e azimute. */
  lanterna(elevacaoGraus: number, azimuteGraus: number): void
  /** Lupa aproximada (vista de detalhe) ou não. */
  lupa(ativa: boolean): void
  /** Animações de cada estação (0 a 1 onde fizer sentido). */
  animar(estado: { disco?: boolean; corte?: number; lixando?: boolean; politriz?: boolean; mergulho?: number; indentando?: boolean }): void
  desenhar(dt: number): void
  enquadrar(largura: number, altura: number): void
  destruir(): void
}

const pint = (cor: string, rug = 0.7, met = 0.1) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met })
function caixa(l: number, a: number, p: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), mat)
  m.position.set(x, y + a / 2, z)
  return m
}
function cilindro(r: number, h: number, mat: THREE.Material, seg = 32): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat)
}

/** Posição de cada estação ao longo da bancada (x, cm) e onde a câmera fica. */
const ESTACOES: Record<Estacao, { x: number; camera: [number, number, number]; alvo: [number, number, number] }> = {
  inspecao: { x: -120, camera: [-95, 150, 110], alvo: [-120, 92, 0] },
  corte: { x: -55, camera: [-30, 175, 150], alvo: [-55, 105, 0] },
  preparo: { x: 15, camera: [35, 175, 140], alvo: [20, 98, 0] },
  microscopio: { x: 90, camera: [110, 170, 130], alvo: [90, 108, 0] },
  microdureza: { x: 150, camera: [170, 170, 130], alvo: [150, 108, 0] },
}

export function criarLaboratorio3D(): VistaLaboratorio | null {
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
  canvas.tabIndex = 0
  canvas.setAttribute('aria-label', 'Laboratório em 3D: bancada com as estações de ensaio. Botão do meio gira a câmera; as ações ficam no painel.')

  const cena = new THREE.Scene()
  cena.background = new THREE.Color('#dfe5ea')
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 3000)
  const controles = new OrbitControls(camera, canvas)
  controles.enableDamping = true
  controles.mouseButtons = { LEFT: -1 as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }
  // Toque: um dedo é a mão (ferramenta, lanterna); dois dedos aproximam e arrastam a câmera.
  controles.touches = { ONE: -1 as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN }

  // Sala clara de laboratório.
  cena.add(new THREE.HemisphereLight('#ffffff', '#9aa3aa', 0.9))
  const teto = new THREE.DirectionalLight('#ffffff', 0.8)
  teto.position.set(0, 400, 200)
  cena.add(teto)
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(1200, 800), pint('#b9c0c6', 0.9))
  piso.rotation.x = -Math.PI / 2
  cena.add(piso)
  cena.add(caixa(1200, 300, 4, pint('#eef1f3'), 0, 0, -60))
  // Bancada.
  cena.add(caixa(380, 4, 75, pint('#2f3a44', 0.4), 15, 88, -5))
  cena.add(caixa(380, 88, 70, pint('#d6dbe0'), 15, 0, -5))
  for (const [e, d] of Object.entries(ESTACOES)) {
    // Placa da estação na parede.
    const c = document.createElement('canvas')
    c.width = 256; c.height = 48
    const g = c.getContext('2d')!
    g.fillStyle = '#2f3a44'; g.fillRect(0, 0, 256, 48)
    g.fillStyle = '#f4f1ea'; g.font = '700 26px Arial'; g.textBaseline = 'middle'
    g.fillText({ inspecao: 'INSPEÇÃO', corte: 'CORTE', preparo: 'PREPARO', microscopio: 'MICROSCÓPIO', microdureza: 'MICRODUREZA' }[e as Estacao], 14, 25)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
    const placa = new THREE.Mesh(new THREE.PlaneGeometry(40, 7.5), new THREE.MeshBasicMaterial({ map: t }))
    placa.position.set(d.x, 175, -57)
    cena.add(placa)
  }

  // Recepção: o braço tensor quebrado (duas partes) numa bandeja, com lanterna.
  const aco = pint('#6f777f', 0.45, 0.7), ferrugem = pint('#7a5a44', 0.8, 0.2)
  const recepcao = new THREE.Group()
  recepcao.position.set(ESTACOES.inspecao.x, 92, 0)
  recepcao.add(caixa(70, 1.5, 30, pint('#c9ced3'), 0, 0, 0))
  const parteA = caixa(26, 1.2, 8, aco, -14, 1.5, 0)
  const parteB = caixa(14, 1.2, 8, aco, 10, 1.5, 0)
  parteB.rotation.y = 0.12
  const cordao = caixa(1.6, 0.4, 8, pint('#5d646b', 0.5, 0.6), -0.6, 2.7, 0)
  const fratura = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.2), pint('#8d8f8e', 0.95, 0.2))
  fratura.position.set(-0.99, 2.1, 0)
  fratura.rotation.y = Math.PI / 2
  recepcao.add(parteA, parteB, cordao, fratura, caixa(3, 0.3, 8, ferrugem, -24, 2.7, 0))
  cena.add(recepcao)
  const luzLanterna = new THREE.SpotLight('#fff4dd', 900, 120, 0.5, 0.4, 2)
  const lanternaMesh = cilindro(1.4, 9, pint('#c63b2b', 0.5))
  cena.add(luzLanterna, luzLanterna.target, lanternaMesh)
  luzLanterna.target.position.set(ESTACOES.inspecao.x - 1, 94, 0)

  // Cortadeira.
  const cortadeira = new THREE.Group()
  cortadeira.position.set(ESTACOES.corte.x, 92, 0)
  cortadeira.add(caixa(45, 30, 40, pint('#e0b100', 0.6), 0, 0, -5))
  cortadeira.add(caixa(46, 2, 41, pint('#3d454d'), 0, 30, -5))
  const braco = new THREE.Group()
  braco.position.set(0, 42, -10)
  const disco = cilindro(10, 0.6, pint('#3a3a3a', 0.8))
  disco.rotation.x = Math.PI / 2
  braco.add(disco, caixa(6, 6, 16, pint('#59636d'), 0, -3, 8))
  cortadeira.add(braco)
  const pecaCorte = caixa(14, 1.2, 8, aco, 0, 31, 2)
  cortadeira.add(pecaCorte)
  cena.add(cortadeira)

  // Preparo: três lixas, politriz e capela com béquer.
  const preparo = new THREE.Group()
  preparo.position.set(ESTACOES.preparo.x, 92, 0)
  ;[['#6b4f2a', -22], ['#8a6b3d', -14], ['#b39361', -6]].forEach(([cor, x]) => preparo.add(caixa(7, 0.6, 26, pint(cor as string, 1), x as number, 0, 2)))
  const politriz = new THREE.Group()
  politriz.position.set(12, 0, 0)
  politriz.add(cilindro(11, 9, pint('#2f6d8a', 0.5)))
  politriz.children[0].position.y = 4.5
  const pano = cilindro(10, 0.6, pint('#e9e4d4', 1))
  pano.position.y = 9.3
  politriz.add(pano)
  preparo.add(politriz)
  const amostra = cilindro(1.6, 1.4, pint('#1d1d1f', 0.6))
  amostra.position.set(-14, 1.3, 2)
  preparo.add(amostra)
  const capela = new THREE.Group()
  capela.position.set(36, 0, -8)
  capela.add(caixa(26, 40, 24, new THREE.MeshStandardMaterial({ color: '#cfe8f5', transparent: true, opacity: 0.25 }), 0, 0, 0))
  const bequer = cilindro(3.5, 7, new THREE.MeshStandardMaterial({ color: '#e7f4ff', transparent: true, opacity: 0.45 }))
  bequer.position.set(0, 3.5, 4)
  const liquido = cilindro(3.3, 5, pint('#f2d38a', 0.2))
  liquido.position.set(0, 2.5, 4)
  capela.add(bequer, liquido)
  preparo.add(capela)
  cena.add(preparo)

  // Microscópio.
  const micro = new THREE.Group()
  micro.position.set(ESTACOES.microscopio.x, 92, 0)
  micro.add(caixa(18, 3, 20, pint('#ebedef'), 0, 0, 0), caixa(4, 26, 4, pint('#ebedef'), 0, 3, -7))
  const tubo = cilindro(2.2, 14, pint('#2b2f33'))
  tubo.position.set(0, 26, -1); tubo.rotation.x = -0.5
  const mesa = caixa(12, 1.2, 10, pint('#3c4249'), 0, 10, 0)
  micro.add(tubo, mesa)
  cena.add(micro)

  // Microdurômetro.
  const durometro = new THREE.Group()
  durometro.position.set(ESTACOES.microdureza.x, 92, 0)
  durometro.add(caixa(20, 4, 22, pint('#e9ecef'), 0, 0, 0), caixa(8, 34, 8, pint('#e9ecef'), 0, 4, -8), caixa(16, 8, 16, pint('#d4d8dc'), 0, 34, -4))
  const indentador = cilindro(0.8, 6, pint('#9aa4ad', 0.3, 0.9), 12)
  indentador.position.set(0, 28, 0)
  durometro.add(indentador)
  cena.add(durometro)

  let atual: Estacao = 'inspecao'
  let lupaAtiva = false
  const alvoCam = new THREE.Vector3(...ESTACOES.inspecao.alvo), posCam = new THREE.Vector3(...ESTACOES.inspecao.camera)
  camera.position.copy(posCam)
  controles.target.copy(alvoCam)
  let animandoCam = true
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const anim = { disco: false, corte: 0, lixando: false, politriz: false, mergulho: 0, indentando: false }

  const posicionarCamera = () => {
    const d = ESTACOES[atual]
    alvoCam.set(...d.alvo)
    posCam.set(...d.camera)
    if (atual === 'inspecao' && lupaAtiva) { posCam.set(d.x + 14, 108, 22); alvoCam.set(d.x - 1, 93, 0) }
    animandoCam = true
    if (reduzido) { camera.position.copy(posCam); controles.target.copy(alvoCam); animandoCam = false }
  }

  return {
    canvas,
    irPara(e) { atual = e; posicionarCamera() },
    lanterna(elevacao, azimute) {
      // Lanterna a 30 cm da fratura, na elevação pedida (rasante = baixa).
      const el = (elevacao * Math.PI) / 180, az = (azimute * Math.PI) / 180
      const alvo = luzLanterna.target.position
      const pos = new THREE.Vector3(alvo.x + Math.cos(el) * Math.cos(az) * 30, alvo.y + Math.sin(el) * 30, alvo.z + Math.cos(el) * Math.sin(az) * 30)
      luzLanterna.position.copy(pos)
      lanternaMesh.position.copy(pos)
      lanternaMesh.lookAt(alvo)
      lanternaMesh.rotateX(Math.PI / 2)
    },
    lupa(ativa) { lupaAtiva = ativa; posicionarCamera() },
    animar(e) { Object.assign(anim, e) },
    desenhar(dt) {
      if (animandoCam) {
        const k = 1 - Math.exp(-dt * 4)
        camera.position.lerp(posCam, k); controles.target.lerp(alvoCam, k)
        if (camera.position.distanceTo(posCam) < 0.5) animandoCam = false
      }
      if (anim.disco) disco.rotation.y += dt * 40
      braco.position.y = 42 - 9 * anim.corte
      if (anim.politriz) pano.rotation.y += dt * 12
      amostra.position.x = anim.lixando ? -14 + Math.sin(performance.now() / 120) * 3 : -14
      liquido.scale.y = 1
      amostra.position.y = 1.3
      if (anim.mergulho > 0) { amostra.position.set(36, 8 - 4 * anim.mergulho, -4) } else if (!anim.lixando) amostra.position.set(-14, 1.3, 2)
      indentador.position.y = anim.indentando ? 26 + Math.abs(Math.sin(performance.now() / 300)) * 2 : 28
      controles.update()
      renderizador.render(cena, camera)
    },
    enquadrar(l, a) { renderizador.setSize(l, a, false); camera.aspect = l / Math.max(1, a); camera.updateProjectionMatrix() },
    destruir() {
      controles.dispose()
      cena.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as (THREE.Material & { map?: THREE.Texture }) | undefined
        if (mat && !Array.isArray(mat)) { mat.map?.dispose(); mat.dispose() }
      })
      renderizador.dispose()
    },
  }
}
