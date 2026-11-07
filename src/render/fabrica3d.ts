import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { SetorId } from '../fabrica/ordens'
import { webglDisponivel } from './palco3d'

/*
 * O que faz: o galpão 3D da fábrica (v2.2), com os quatro setores. Clicar
 * num setor avisa a tela; passar o mouse acende o setor. As máquinas são
 * ilustrativas (proporções aproximadas, sem medida de catálogo).
 * Onde mexer: posição de cada setor em POSICOES; o desenho de cada máquina
 * nas funções torno(), cabineSolda(), laboratorio() e robo().
 * Unidade do mundo: 1 = 1 m.
 */

export interface VistaFabrica {
  canvas: HTMLCanvasElement
  /** Acende um setor (ou nenhum) e leva a câmera até ele. */
  focar(setor: SetorId | null): void
  /** Marca os setores com etapa pendente na OS ativa. */
  marcarPendentes(setores: SetorId[]): void
  destruir(): void
}

const POSICOES: Record<SetorId, THREE.Vector3> = {
  usinagem: new THREE.Vector3(-6.2, 0, 3.2),
  laboratorio: new THREE.Vector3(-6.2, 0, -4.2),
  soldagem: new THREE.Vector3(6.2, 0, 3.2),
  manufatura: new THREE.Vector3(6.2, 0, -4.2),
}

const CORES: Record<SetorId, string> = {
  usinagem: '#6cb4ff',
  laboratorio: '#57c48a',
  soldagem: '#ff8a3d',
  manufatura: '#c792ea',
}

const NOMES: Record<SetorId, string> = {
  usinagem: 'USINAGEM',
  laboratorio: 'LABORATÓRIO',
  soldagem: 'SOLDAGEM',
  manufatura: 'MANUFATURA ADITIVA',
}

export const metal = (cor: string, rugosidade = 0.55, metalico = 0.5) => new THREE.MeshStandardMaterial({ color: cor, roughness: rugosidade, metalness: metalico })
export const pintado = (cor: string) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.7, metalness: 0.15 })

export function caixa(l: number, a: number, p: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), mat)
  m.position.set(x, y + a / 2, z)
  return m
}

export function cilindro(r: number, h: number, mat: THREE.Material, seg = 24): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat)
}

export function placa(texto: string, cor: string, largura = 512): THREE.Mesh {
  const c = document.createElement('canvas')
  c.width = largura; c.height = 96
  const g = c.getContext('2d')!
  g.fillStyle = '#121a22'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = cor
  g.fillRect(0, 0, 14, c.height)
  g.fillStyle = '#f2ede2'
  g.font = '700 52px "Barlow Condensed", "Arial Narrow", Arial, sans-serif'
  g.textBaseline = 'middle'
  g.fillText(texto, 34, 52)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(new THREE.PlaneGeometry(largura / 160, 0.6), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }))
  return m
}

/** Torno CNC: barramento, cabeçote com placa, contraponto e carenagem. */
export function torno(): { grupo: THREE.Group; animar: (t: number) => void } {
  const g = new THREE.Group()
  const corpo = pintado('#d9dde1')
  g.add(caixa(3.2, 0.9, 1.1, pintado('#59636d')))
  g.add(caixa(3.2, 0.25, 0.9, metal('#8f99a3', 0.35, 0.8), 0, 0.9))
  g.add(caixa(0.8, 0.9, 1.0, corpo, -1.1, 1.15))
  const placaTorno = cilindro(0.28, 0.18, metal('#7d868f', 0.4, 0.9))
  placaTorno.rotation.z = Math.PI / 2
  placaTorno.position.set(-0.6, 1.55, 0)
  g.add(placaTorno)
  const peca = cilindro(0.07, 1.2, metal('#b9c2ca', 0.25, 0.95), 18)
  peca.rotation.z = Math.PI / 2
  peca.position.set(0.05, 1.55, 0)
  g.add(peca)
  g.add(caixa(0.45, 0.55, 0.5, corpo, 1.15, 1.15))
  const torre = caixa(0.35, 0.35, 0.35, metal('#3d454d', 0.5, 0.7), 0.2, 1.2, 0.35)
  g.add(torre)
  // Carenagem de trás e painel de comando.
  g.add(caixa(3.4, 1.4, 0.08, pintado('#e7eaee'), 0, 0.9, -0.6))
  const painel = caixa(0.5, 0.75, 0.1, pintado('#2b333b'), 1.95, 1.15, 0.25)
  painel.rotation.y = -0.5
  g.add(painel)
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.26), new THREE.MeshBasicMaterial({ color: '#4fb3ff' }))
  tela.position.set(1.97, 1.72, 0.32)
  tela.rotation.y = -0.5
  g.add(tela)
  return {
    grupo: g,
    animar: (t) => {
      placaTorno.rotation.x = t * 8
      peca.rotation.x = t * 8
      torre.position.x = 0.2 + Math.sin(t * 0.6) * 0.45
    },
  }
}

/** Cabine de solda: biombos vermelhos, mesa, máquina no carrinho e o brilho do arco. */
export function cabineSolda(): { grupo: THREE.Group; animar: (t: number) => void } {
  const g = new THREE.Group()
  const cortina = new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.6, transparent: true, opacity: 0.72, side: THREE.DoubleSide })
  const tubo = metal('#c9cdd1', 0.4, 0.7)
  for (const [x, z, ry, l] of [[0, -1.3, 0, 3], [-1.5, 0, Math.PI / 2, 2.6], [1.5, 0, Math.PI / 2, 2.6]] as const) {
    const pano = new THREE.Mesh(new THREE.PlaneGeometry(l, 1.6), cortina)
    pano.position.set(x, 1.05, z)
    pano.rotation.y = ry
    g.add(pano)
    const barra = cilindro(0.02, l, tubo, 8)
    barra.rotation.z = Math.PI / 2
    barra.rotation.y = ry
    barra.position.set(x, 1.9, z)
    g.add(barra)
  }
  g.add(caixa(1.4, 0.8, 0.8, metal('#4a5259', 0.7, 0.6), 0, 0, -0.2))
  g.add(caixa(1.0, 0.03, 0.3, metal('#9aa3aa', 0.4, 0.8), 0, 0.8, -0.2))
  g.add(caixa(0.5, 0.75, 0.7, pintado('#1f6fb5'), 0.95, 0, 0.6))
  g.add(caixa(0.2, 0.9, 0.2, pintado('#2e7d32'), 1.25, 0, 0.95))
  const arco = new THREE.PointLight('#ffb36b', 0, 4, 2)
  arco.position.set(0, 0.95, -0.2)
  g.add(arco)
  const brasa = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff2c0' }))
  brasa.position.copy(arco.position)
  g.add(brasa)
  return {
    grupo: g,
    animar: (t) => {
      const ligado = Math.sin(t * 0.7) > -0.2
      const tremor = 0.6 + 0.4 * Math.abs(Math.sin(t * 37) * Math.cos(t * 23))
      arco.intensity = ligado ? 6 * tremor : 0
      brasa.visible = ligado
      brasa.position.x = -0.4 + ((t * 0.08) % 0.8)
      arco.position.x = brasa.position.x
    },
  }
}

/** Laboratório: bancada com microscópio, microdurômetro, lixadeira e parede de vidro. */
export function laboratorio(): { grupo: THREE.Group; animar: (t: number) => void } {
  const g = new THREE.Group()
  g.add(caixa(3.2, 0.9, 0.9, pintado('#e9ecef'), 0, 0, -0.3))
  g.add(caixa(3.2, 0.04, 0.95, pintado('#2f3a44'), 0, 0.9, -0.3))
  // Microscópio.
  const preto = pintado('#20262c')
  g.add(caixa(0.35, 0.06, 0.3, preto, -0.9, 0.94, -0.3))
  const coluna = caixa(0.08, 0.5, 0.08, preto, -0.9, 0.94, -0.42)
  g.add(coluna)
  const ocular = cilindro(0.05, 0.3, preto, 14)
  ocular.position.set(-0.9, 1.45, -0.3)
  ocular.rotation.x = -0.6
  g.add(ocular)
  // Microdurômetro.
  g.add(caixa(0.4, 0.55, 0.4, pintado('#cfd6dc'), 0.1, 0.94, -0.35))
  const ponta = cilindro(0.03, 0.15, metal('#b9c2ca', 0.3, 0.9), 10)
  ponta.position.set(0.1, 1.38, -0.2)
  g.add(ponta)
  // Lixadeira/politriz.
  const disco = cilindro(0.2, 0.05, metal('#8a6d3b', 0.8, 0.2))
  disco.position.set(1.0, 1.05, -0.3)
  g.add(caixa(0.55, 0.12, 0.55, pintado('#3d4852'), 1.0, 0.92, -0.3))
  g.add(disco)
  // Parede de vidro.
  const vidro = new THREE.MeshStandardMaterial({ color: '#9fd3ff', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  const parede = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.2), vidro)
  parede.position.set(0, 1.1, 1.1)
  g.add(parede)
  g.add(caixa(3.6, 0.06, 0.06, metal('#c9cdd1'), 0, 2.2, 1.1))
  return {
    grupo: g,
    animar: (t) => {
      disco.rotation.y = t * 6
      ponta.position.y = 1.36 + Math.max(0, Math.sin(t * 1.2)) * 0.05
    },
  }
}

/** Robô de 6 eixos ilustrativo (como o da Manufatura Aditiva), com a parede de camadas na mesa. */
/**
 * Robô de 6 eixos ilustrativo (como o da Manufatura Aditiva) depositando uma parede na mesa.
 * Cadeia encaixada: pedestal → base giratória → ombro → braço → cotovelo → antebraço → punho → tocha.
 * Os ângulos saem de uma cinemática inversa de 2 elos: a ponta da tocha segue o topo da parede,
 * então o braço nunca atravessa a mesa nem a peça.
 */
export function robo(): { grupo: THREE.Group; animar: (t: number) => void } {
  const g = new THREE.Group()
  const azul = pintado('#2563a8'), junta = metal('#2b2f33', 0.5, 0.6), cinzaMesa = metal('#4c5660', 0.8, 0.5)
  // Mesa (x 0,1 a 1,7) e a parede depositada em cima dela.
  const MESA = { x0: 0.1, x1: 1.7, alto: 0.8 }
  g.add(caixa(MESA.x1 - MESA.x0, MESA.alto, 1.0, cinzaMesa, (MESA.x0 + MESA.x1) / 2, 0, 0))
  const PAREDE = { x0: 0.45, x1: 1.35, alto: 0.18 }
  g.add(caixa(PAREDE.x1 - PAREDE.x0, PAREDE.alto, 0.06, metal('#8d969e', 0.5, 0.7), (PAREDE.x0 + PAREDE.x1) / 2, MESA.alto, 0))
  // Pedestal e base giratória (encostados um no outro, sem vão).
  const BASE_X = -0.5, PEDESTAL = 0.35, GIRATORIA = 0.12
  const pedestal = cilindro(0.24, PEDESTAL, azul)
  pedestal.position.set(BASE_X, PEDESTAL / 2, 0)
  g.add(pedestal)
  const giro = new THREE.Group()
  giro.position.set(BASE_X, PEDESTAL, 0)
  g.add(giro)
  const giratoria = cilindro(0.21, GIRATORIA, junta)
  giratoria.position.y = GIRATORIA / 2
  giro.add(giratoria)
  // Ombro: junta no topo da base giratória.
  const L1 = 1.0, L2 = 1.05, TOCHA = 0.3
  const ombro = new THREE.Group()
  ombro.position.y = GIRATORIA + 0.1
  giro.add(ombro)
  const juntaEixo = (r: number) => { const j = cilindro(r, 0.24, junta, 20); j.rotation.x = Math.PI / 2; return j }
  ombro.add(juntaEixo(0.12))
  ombro.add(caixa(0.16, L1, 0.16, azul)) // braço: da junta para cima (+y local)
  const cotovelo = new THREE.Group()
  cotovelo.position.y = L1
  ombro.add(cotovelo)
  cotovelo.add(juntaEixo(0.1))
  const antebraco = new THREE.Mesh(new THREE.BoxGeometry(L2, 0.13, 0.13), azul) // antebraço: para +x local
  antebraco.position.x = L2 / 2
  cotovelo.add(antebraco)
  const punho = new THREE.Group()
  punho.position.x = L2
  cotovelo.add(punho)
  punho.add(juntaEixo(0.07))
  const tocha = cilindro(0.035, TOCHA, metal('#c9cdd1', 0.3, 0.9), 12)
  tocha.position.y = -TOCHA / 2 // a tocha aponta para baixo a partir do punho
  punho.add(tocha)
  const brilho = new THREE.PointLight('#ffb36b', 0, 3, 2)
  brilho.position.y = -TOCHA - 0.02
  punho.add(brilho)
  const arco = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff2c0' }))
  arco.position.y = -TOCHA - 0.01
  punho.add(arco)
  // Ombro no espaço da célula (plano XY do grupo).
  const ombroY = PEDESTAL + GIRATORIA + 0.1
  return {
    grupo: g,
    animar: (t) => {
      // A ponta da tocha anda sobre o topo da parede, de um lado ao outro (2 mm acima).
      const xt = (PAREDE.x0 + PAREDE.x1) / 2 + ((PAREDE.x1 - PAREDE.x0) / 2 - 0.05) * Math.sin(t * 0.5)
      const wx = xt - BASE_X, wy = MESA.alto + PAREDE.alto + 0.02 + TOCHA - ombroY // punho relativo ao ombro
      const d = Math.min(L1 + L2 - 1e-3, Math.hypot(wx, wy))
      const phi = Math.atan2(wy, wx)
      const beta = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))))
      const a1 = phi + beta // cotovelo para cima
      const ex = L1 * Math.cos(a1), ey = L1 * Math.sin(a1)
      const a2 = Math.atan2(wy - ey, wx - ex)
      ombro.rotation.z = a1 - Math.PI / 2 // o braço é modelado em +y
      cotovelo.rotation.z = a2 - ombro.rotation.z // o antebraço é modelado em +x
      punho.rotation.z = -a2 // tocha sempre na vertical
      giro.rotation.y = 0
      brilho.intensity = 2.5 + Math.random() * 1.5
    },
  }
}

const MAQUINAS: Record<SetorId, () => { grupo: THREE.Group; animar: (t: number) => void }> = { usinagem: torno, laboratorio, soldagem: cabineSolda, manufatura: robo }

export function criarFabrica3D(op: { aoEscolher: (s: SetorId) => void; aoPassar?: (s: SetorId | null) => void }): VistaFabrica | null {
  if (!webglDisponivel()) return null
  let renderizador: THREE.WebGLRenderer
  try {
    renderizador = new THREE.WebGLRenderer({ antialias: true })
  } catch {
    return null
  }
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  renderizador.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderizador.outputColorSpace = THREE.SRGBColorSpace
  const canvas = renderizador.domElement
  canvas.className = 'fabrica-canvas'
  canvas.setAttribute('aria-label', 'Galpão 3D da fábrica com os setores. Arraste para girar, role para aproximar e clique num setor para entrar. Os mesmos setores estão nos botões ao lado.')
  canvas.tabIndex = -1

  const cena = new THREE.Scene()
  cena.background = new THREE.Color('#151b21')
  cena.fog = new THREE.Fog('#151b21', 28, 60)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
  camera.position.set(0, 12, 19)
  const controles = new OrbitControls(camera, canvas)
  controles.enableDamping = true
  controles.dampingFactor = 0.1
  controles.maxPolarAngle = Math.PI * 0.46
  controles.minDistance = 4
  controles.maxDistance = 30
  controles.target.set(0, 0.8, 0)

  cena.add(new THREE.HemisphereLight('#e6eef5', '#2a2723', 1.3))
  const sol = new THREE.DirectionalLight('#ffffff', 1.4)
  sol.position.set(6, 14, 8)
  cena.add(sol)

  // Piso, faixas de segurança e corredor central.
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(28, 20), new THREE.MeshStandardMaterial({ color: '#4a5056', roughness: 0.9 }))
  piso.rotation.x = -Math.PI / 2
  cena.add(piso)
  const faixa = new THREE.MeshBasicMaterial({ color: '#e0b100' })
  for (const x of [-2.6, 2.6]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 18), faixa)
    f.rotation.x = -Math.PI / 2
    f.position.set(x, 0.01, 0)
    cena.add(f)
  }
  // Paredes e pilares do galpão.
  const parede = pintado('#2b3238')
  cena.add(caixa(28, 6, 0.2, parede, 0, 0, -10))
  for (const x of [-14, 14]) cena.add(caixa(0.2, 6, 20, parede, x, 0, 0))
  const pilar = pintado('#c9a227')
  for (const x of [-13.6, -4.5, 4.5, 13.6]) for (const z of [-9.6, 9.6]) cena.add(caixa(0.35, 6, 0.35, pilar, x, 0, z))
  for (const x of [-9, 9]) {
    const viga = caixa(0.3, 0.4, 20, pintado('#3c454e'), x, 5.6, 0)
    cena.add(viga)
    const luz = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.3), new THREE.MeshBasicMaterial({ color: '#fff8e6' }))
    luz.position.set(x, 5.3, 0)
    cena.add(luz)
  }
  // Quadro de ordens de serviço no fundo do corredor.
  const quadro = new THREE.Group()
  quadro.add(caixa(3.2, 1.8, 0.08, pintado('#f4f1ea'), 0, 1.2, 0))
  quadro.add(caixa(3.4, 0.12, 0.12, pintado('#3c454e'), 0, 3.0, 0))
  const titulo = placa('QUADRO DE OS', '#e0b100', 560)
  titulo.position.set(0, 3.4, 0.05)
  quadro.add(titulo)
  for (let i = 0; i < 3; i++) quadro.add(caixa(0.7, 0.9, 0.02, pintado(['#fff59d', '#ffcc80', '#b3e5fc'][i]), -1 + i, 1.6, 0.06))
  quadro.position.set(0, 0, -8.5)
  cena.add(quadro)

  // Setores.
  const alvos: { setor: SetorId; objeto: THREE.Object3D }[] = []
  const animacoes: ((t: number) => void)[] = []
  const realces = new Map<SetorId, { area: THREE.Mesh; marca: THREE.Mesh }>()
  for (const setor of Object.keys(POSICOES) as SetorId[]) {
    const grupo = new THREE.Group()
    grupo.position.copy(POSICOES[setor])
    const area = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 5.8), new THREE.MeshBasicMaterial({ color: CORES[setor], transparent: true, opacity: 0.08 }))
    area.rotation.x = -Math.PI / 2
    area.position.y = 0.015
    grupo.add(area)
    const borda = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(6.6, 5.8)), new THREE.LineBasicMaterial({ color: CORES[setor] }))
    borda.rotation.x = -Math.PI / 2
    borda.position.y = 0.02
    grupo.add(borda)
    const maquina = MAQUINAS[setor]()
    grupo.add(maquina.grupo)
    animacoes.push(maquina.animar)
    const nome = placa(NOMES[setor], CORES[setor], setor === 'manufatura' ? 760 : 520)
    nome.position.set(0, 2.5, -2.6)
    grupo.add(nome)
    // Marca de etapa pendente: um losango que flutua sobre o setor.
    const marca = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshBasicMaterial({ color: '#e0b100' }))
    marca.position.set(0, 3.3, -2.6)
    marca.visible = false
    grupo.add(marca)
    realces.set(setor, { area, marca })
    cena.add(grupo)
    alvos.push({ setor, objeto: grupo })
  }

  // Seleção pelo mouse.
  const raio = new THREE.Raycaster()
  const ponteiro = new THREE.Vector2()
  let sobre: SetorId | null = null
  let focado: SetorId | null = null
  const setorEm = (e: PointerEvent): SetorId | null => {
    const r = canvas.getBoundingClientRect()
    ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raio.setFromCamera(ponteiro, camera)
    const hit = raio.intersectObjects(alvos.map((a) => a.objeto), true)[0]
    if (!hit) return null
    let o: THREE.Object3D | null = hit.object
    while (o) {
      const a = alvos.find((x) => x.objeto === o)
      if (a) return a.setor
      o = o.parent
    }
    return null
  }
  const pintar = () => {
    for (const [s, r] of realces) (r.area.material as THREE.MeshBasicMaterial).opacity = s === sobre || s === focado ? 0.28 : 0.08
    canvas.style.cursor = sobre ? 'pointer' : 'grab'
  }
  let inicio: { x: number; y: number } | null = null
  const mover = (e: PointerEvent) => {
    const s = setorEm(e)
    if (s !== sobre) { sobre = s; pintar(); op.aoPassar?.(s) }
  }
  const descer = (e: PointerEvent) => { inicio = { x: e.clientX, y: e.clientY } }
  const subir = (e: PointerEvent) => {
    // Clique (sem arrastar a câmera) entra no setor.
    if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < 6) {
      const s = setorEm(e)
      if (s) op.aoEscolher(s)
    }
    inicio = null
  }
  canvas.addEventListener('pointermove', mover)
  canvas.addEventListener('pointerdown', descer)
  canvas.addEventListener('pointerup', subir)

  // Câmera: vai suavemente até o setor focado.
  const alvoCamera = new THREE.Vector3(0, 0.8, 0)
  const posCamera = new THREE.Vector3(0, 12, 19)
  let animandoCamera = false

  const ajustar = () => {
    const pai = canvas.parentElement
    const l = pai?.clientWidth || 800, a = pai?.clientHeight || 500
    renderizador.setSize(l, a, false)
    camera.aspect = l / a
    camera.updateProjectionMatrix()
  }
  const observador = new ResizeObserver(ajustar)
  let quadroAnim = 0
  const t0 = performance.now()
  const passo = () => {
    quadroAnim = requestAnimationFrame(passo)
    if (!canvas.isConnected) return
    const t = (performance.now() - t0) / 1000
    if (!reduzido) for (const a of animacoes) a(t)
    for (const r of realces.values()) if (r.marca.visible) { r.marca.rotation.y = t * 1.5; r.marca.position.y = 3.3 + Math.sin(t * 2) * 0.12 }
    if (animandoCamera) {
      controles.target.lerp(alvoCamera, 0.08)
      camera.position.lerp(posCamera, 0.08)
      if (camera.position.distanceTo(posCamera) < 0.05) animandoCamera = false
    }
    controles.update()
    renderizador.render(cena, camera)
  }
  requestAnimationFrame(() => {
    if (canvas.parentElement) observador.observe(canvas.parentElement)
    ajustar()
  })
  quadroAnim = requestAnimationFrame(passo)

  return {
    canvas,
    focar(setor) {
      focado = setor
      pintar()
      if (setor) {
        const p = POSICOES[setor]
        alvoCamera.set(p.x, 1, p.z)
        posCamera.set(p.x * 0.55, 6.5, p.z + 8.5)
      } else {
        alvoCamera.set(0, 0.8, 0)
        posCamera.set(0, 12, 19)
      }
      animandoCamera = !reduzido
      if (reduzido) { controles.target.copy(alvoCamera); camera.position.copy(posCamera) }
    },
    marcarPendentes(setores) {
      for (const [s, r] of realces) r.marca.visible = setores.includes(s)
    },
    destruir() {
      cancelAnimationFrame(quadroAnim)
      observador.disconnect()
      canvas.removeEventListener('pointermove', mover)
      canvas.removeEventListener('pointerdown', descer)
      canvas.removeEventListener('pointerup', subir)
      controles.dispose()
      cena.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as (THREE.Material & { map?: THREE.Texture }) | (THREE.Material & { map?: THREE.Texture })[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => { x.map?.dispose(); x.dispose() })
        else if (mat) { mat.map?.dispose(); mat.dispose() }
      })
      renderizador.dispose()
    },
  }
}
