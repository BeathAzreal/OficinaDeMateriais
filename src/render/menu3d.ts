import * as THREE from 'three'
import { cabineSolda, caixa, cilindro, metal, pintado, placa, robo, torno } from './fabrica3d'
import { webglDisponivel } from './palco3d'

/*
 * O que faz: o MENU em 3D (v2.2). O jogador está no meio da fábrica, à noite;
 * cada opção do menu é um lugar do galpão, em arco à volta dele. Escolher uma
 * opção vira a câmera para o lugar e acende a luz dele; confirmar aproxima a
 * câmera antes de abrir a tela. A interface (título, lista e descrição) fica
 * por cima, em HTML.
 * Onde mexer: os lugares estão em LUGARES (ordem = ordem do menu) e cada um
 * tem a sua função de desenho. Unidade do mundo: 1 = 1 m.
 */

export type LugarMenu = 'fabrica' | 'arcade' | 'treino' | 'manufatura' | 'recordes' | 'config'

export interface VistaMenu {
  canvas: HTMLCanvasElement
  /**
   * Vira a câmera para o lugar e acende a luz dele. `avanco` (m) anda a
   * câmera na direção do lugar: 0 no menu, PERTO nas telas daquele lugar.
   */
  focar(lugar: LugarMenu, avanco?: number): void
  /** Aproxima a câmera do lugar; resolve quando chega (na hora, com movimento reduzido). */
  entrar(lugar: LugarMenu): Promise<void>
  /** Para de desenhar (tela de jogo com o próprio 3D por cima). */
  pausar(): void
  retomar(): void
  destruir(): void
}

interface Desenho { grupo: THREE.Group; animar: (t: number) => void }

const RAIO = 7.5
const ALTURA_OLHO = 1.75
/** Onde a câmera para nas telas de um lugar (Arcade, Recordes...): perto, com o lugar à direita. */
export const PERTO = 2.6

/** Portão do galpão com o quadro de ordens de serviço ao lado. */
function portaoFabrica(): Desenho {
  const g = new THREE.Group()
  const amarelo = pintado('#e0b100'), preto = pintado('#1b1f23')
  g.add(caixa(4.2, 3.6, 0.15, pintado('#5d6670'), 0, 0, -0.6))
  for (let i = 0; i < 9; i++) g.add(caixa(4.0, 0.06, 0.05, pintado('#4a525b'), 0, 0.25 + i * 0.38, -0.5))
  for (const x of [-2.2, 2.2]) {
    g.add(caixa(0.25, 3.9, 0.25, amarelo, x, 0, -0.55))
    for (let i = 0; i < 6; i++) g.add(caixa(0.26, 0.25, 0.26, preto, x, 0.2 + i * 0.65, -0.55))
  }
  const quadro = caixa(1.6, 1.1, 0.06, pintado('#f4f1ea'), 0, 1.2, 0.2)
  g.add(quadro)
  const cores = ['#fff59d', '#ffcc80', '#b3e5fc']
  for (let i = 0; i < 3; i++) g.add(caixa(0.36, 0.48, 0.02, pintado(cores[i]), -0.5 + i * 0.5, 1.45, 0.24))
  g.add(caixa(0.1, 1.2, 0.1, preto, -0.7, 0, 0.2))
  g.add(caixa(0.1, 1.2, 0.1, preto, 0.7, 0, 0.2))
  const giroflex = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff9b2f' }))
  giroflex.position.set(2.2, 4.05, -0.55)
  g.add(giroflex)
  const luz = new THREE.PointLight('#ff9b2f', 0, 5, 2)
  luz.position.copy(giroflex.position)
  g.add(luz)
  return { grupo: g, animar: (t) => { const p = Math.max(0, Math.sin(t * 5)); luz.intensity = 3 * p; (giroflex.material as THREE.MeshBasicMaterial).color.setScalar(0.4 + 0.6 * p).multiply(new THREE.Color('#ff9b2f')) } }
}

/** Fliperama com a tela acesa. */
function fliperama(): Desenho {
  const g = new THREE.Group()
  const corpo = pintado('#1d1f2b'), lateral = pintado('#e12629')
  g.add(caixa(0.9, 1.9, 0.75, corpo))
  for (const x of [-0.47, 0.47]) g.add(caixa(0.04, 1.95, 0.8, lateral, x))
  const painel = caixa(0.9, 0.08, 0.4, pintado('#2a2d3a'), 0, 0.95, 0.45)
  painel.rotation.x = 0.25
  g.add(painel)
  for (const x of [-0.2, 0.05, 0.2]) {
    const b = cilindro(0.04, 0.05, new THREE.MeshBasicMaterial({ color: x < 0 ? '#ffd23f' : '#3ec1ff' }), 12)
    b.position.set(x, 1.02, 0.45)
    g.add(b)
  }
  const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55), new THREE.MeshBasicMaterial({ color: '#3ec1ff' }))
  tela.position.set(0, 1.42, 0.38)
  tela.rotation.x = -0.12
  g.add(tela)
  const letreiro = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.18), new THREE.MeshBasicMaterial({ color: '#ffd23f' }))
  letreiro.position.set(0, 1.8, 0.38)
  g.add(letreiro)
  const brilho = new THREE.PointLight('#3ec1ff', 2, 3, 2)
  brilho.position.set(0, 1.4, 0.9)
  g.add(brilho)
  // Segundo gabinete ao lado, mais apagado.
  const outro = new THREE.Group()
  outro.add(caixa(0.9, 1.9, 0.75, corpo))
  for (const x of [-0.47, 0.47]) outro.add(caixa(0.04, 1.95, 0.8, pintado('#2563a8'), x))
  const painel2 = caixa(0.9, 0.08, 0.4, pintado('#2a2d3a'), 0, 0.95, 0.45)
  painel2.rotation.x = 0.25
  outro.add(painel2)
  for (const x of [-0.2, 0.05, 0.2]) {
    const b = cilindro(0.04, 0.05, new THREE.MeshBasicMaterial({ color: x < 0 ? '#e12629' : '#57c48a' }), 12)
    b.position.set(x, 1.02, 0.45)
    outro.add(b)
  }
  const tela2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55), new THREE.MeshBasicMaterial({ color: '#e12629' }))
  tela2.position.set(0, 1.42, 0.38)
  tela2.rotation.x = -0.12
  outro.add(tela2)
  const letreiro2 = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.18), new THREE.MeshBasicMaterial({ color: '#3ec1ff' }))
  letreiro2.position.set(0, 1.8, 0.38)
  outro.add(letreiro2)
  outro.position.set(1.15, 0, -0.2)
  outro.rotation.y = -0.25
  g.add(outro)
  const cor = new THREE.Color()
  return {
    grupo: g,
    animar: (t) => {
      cor.setHSL((t * 0.08) % 1, 0.75, 0.55)
      ;(tela.material as THREE.MeshBasicMaterial).color.copy(cor)
      brilho.color.copy(cor)
      ;(tela2.material as THREE.MeshBasicMaterial).color.setHSL((t * 0.08 + 0.5) % 1, 0.7, 0.45)
    },
  }
}

/** Bancada de treino: a cabine de solda da fábrica, com faíscas. */
function bancadaTreino(): Desenho {
  const cabine = cabineSolda()
  const faiscas = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color: '#ffd38a' })
  const lista: { m: THREE.Mesh; v: THREE.Vector3; vida: number }[] = []
  for (let i = 0; i < 26; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 3), mat)
    faiscas.add(m)
    lista.push({ m, v: new THREE.Vector3(), vida: 0 })
  }
  cabine.grupo.add(faiscas)
  let anterior = 0
  return {
    grupo: cabine.grupo,
    animar: (t) => {
      cabine.animar(t)
      const dt = Math.min(0.05, t - anterior)
      anterior = t
      const ligado = Math.sin(t * 0.7) > -0.2
      const origem = new THREE.Vector3(-0.4 + ((t * 0.08) % 0.8), 0.86, -0.2)
      for (const f of lista) {
        f.vida -= dt
        if (f.vida <= 0) {
          if (!ligado) { f.m.visible = false; continue }
          f.vida = 0.3 + Math.random() * 0.5
          f.m.position.copy(origem)
          f.v.set((Math.random() - 0.5) * 2.4, Math.random() * 2.2, (Math.random() - 0.2) * 2)
          f.m.visible = true
        }
        f.v.y -= 9.8 * dt
        f.m.position.addScaledVector(f.v, dt)
        if (f.m.position.y < 0.82 && f.v.y < 0) f.v.y *= -0.3
      }
    },
  }
}

/** Robô da manufatura aditiva, com o torno ao fundo. */
function celulaManufatura(): Desenho {
  const r = robo()
  const t = torno()
  // Torno ao fundo, atrás da mesa do robô, sem encostar nela.
  t.grupo.position.set(0.9, 0, -2.4)
  t.grupo.scale.setScalar(0.75)
  r.grupo.add(t.grupo)
  return { grupo: r.grupo, animar: (s) => { r.animar(s); t.animar(s) } }
}

/** Estante de troféus e mural de recordes. */
function estanteRecordes(): Desenho {
  const g = new THREE.Group()
  const madeira = pintado('#5b3b25')
  // Fundo e laterais finos: os troféus ficam à vista nas prateleiras.
  g.add(caixa(2.2, 2.45, 0.05, pintado('#2a2421'), 0, 0, -0.5))
  for (const x of [-1.08, 1.08]) g.add(caixa(0.05, 2.45, 0.5, madeira, x, 0, -0.27))
  for (const y of [0, 0.55, 1.15, 1.75, 2.42]) g.add(caixa(2.1, 0.05, 0.5, madeira, 0, y, -0.27))
  // Metal sem mapa de ambiente fica preto: brilho moderado para as luzes da cena acenderem.
  const ouro = metal('#f0c040', 0.35, 0.45), prata = metal('#d8dde2', 0.35, 0.45), bronze = metal('#c27a40', 0.4, 0.45)
  const trofeus: THREE.Group[] = []
  ;[[-0.6, 1.2, ouro], [0, 1.2, prata], [0.6, 1.2, bronze], [-0.4, 0.6, prata], [0.4, 0.6, ouro], [0, 1.8, ouro]].forEach(([x, y, m]) => {
    const tr = new THREE.Group()
    const base = caixa(0.18, 0.08, 0.18, pintado('#1b1f23'))
    tr.add(base)
    const haste = cilindro(0.025, 0.14, m as THREE.Material, 10)
    haste.position.y = 0.15
    tr.add(haste)
    const taca = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.04, 0.18, 16), m as THREE.Material)
    taca.position.y = 0.31
    tr.add(taca)
    tr.position.set(x as number, (y as number), -0.22)
    tr.scale.setScalar(1.1)
    g.add(tr)
    trofeus.push(tr)
  })
  const luz = new THREE.SpotLight('#fff1cf', 6, 6, 0.6, 0.5)
  luz.position.set(0, 3.2, 1.2)
  luz.target.position.set(0, 1, -0.2)
  g.add(luz, luz.target)
  return { grupo: g, animar: (t) => { trofeus[5].rotation.y = t * 0.8 } }
}

/** Armário de ferramentas e quadro elétrico (configurações). */
function armarioConfig(): Desenho {
  const g = new THREE.Group()
  // Parede da oficina: o painel de ferramentas e o quadro elétrico ficam presos nela.
  g.add(caixa(3.0, 2.6, 0.08, pintado('#2b3238'), 0.3, 0, -0.45))
  g.add(caixa(1.4, 1.1, 0.6, pintado('#b3261e'), 0, 0, -0.1))
  for (let i = 0; i < 4; i++) {
    g.add(caixa(1.3, 0.02, 0.02, pintado('#7a1a14'), 0, 0.22 + i * 0.24, 0.21))
    g.add(caixa(0.3, 0.04, 0.04, metal('#c9cdd1'), 0, 0.14 + i * 0.24, 0.23))
  }
  g.add(caixa(1.6, 1.2, 0.05, pintado('#3c454e'), 0, 1.3, -0.385))
  const ferramentas = metal('#9aa3aa', 0.4, 0.9)
  for (let i = 0; i < 6; i++) g.add(caixa(0.05, 0.45 + (i % 3) * 0.1, 0.03, ferramentas, -0.6 + i * 0.24, 1.55, -0.345))
  const quadro = caixa(0.6, 0.8, 0.2, pintado('#d4d8dc'), 1.25, 1.0, -0.31)
  g.add(quadro)
  const leds: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshBasicMaterial({ color: ['#57c48a', '#ffd23f', '#e12629'][i] }))
    led.position.set(1.1 + i * 0.15, 1.65, -0.2)
    g.add(led)
    leds.push(led)
  }
  const engrenagem = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12), metal('#c9cdd1', 0.3, 0.9))
  engrenagem.position.set(1.25, 1.35, -0.19)
  g.add(engrenagem)
  return { grupo: g, animar: (t) => { engrenagem.rotation.z = t * 1.2; leds.forEach((l, i) => (l.visible = Math.sin(t * 3 + i * 2) > -0.6)) } }
}

const LUGARES: { id: LugarMenu; nome: string; cor: string; desenhar: () => Desenho }[] = [
  { id: 'fabrica', nome: 'FÁBRICA', cor: '#e0b100', desenhar: portaoFabrica },
  { id: 'arcade', nome: 'ARCADE', cor: '#3ec1ff', desenhar: fliperama },
  { id: 'treino', nome: 'TREINO', cor: '#ff8a3d', desenhar: bancadaTreino },
  { id: 'manufatura', nome: 'MANUFATURA', cor: '#c792ea', desenhar: celulaManufatura },
  { id: 'recordes', nome: 'RECORDES', cor: '#e5b53b', desenhar: estanteRecordes },
  { id: 'config', nome: 'CONFIGURAÇÕES', cor: '#e12629', desenhar: armarioConfig },
]

/** Ângulo de cada lugar no arco (radianos; 0 = em frente, positivo = à direita). */
function anguloDe(i: number, n: number): number {
  const abertura = 0.85
  return (i - (n - 1) / 2) * abertura
}

/**
 * `op` é lido a cada clique: quem usa o cenário pode trocar `aoEscolher` e
 * `aoPassar` (o menu liga; as outras telas desligam e o 3D vira só cenário).
 */
export function criarMenu3D(op: { aoEscolher?: (lugar: LugarMenu) => void; aoPassar?: (lugar: LugarMenu) => void }): VistaMenu | null {
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
  renderizador.toneMapping = THREE.ACESFilmicToneMapping
  const canvas = renderizador.domElement
  canvas.className = 'menu3d-canvas'
  canvas.setAttribute('aria-hidden', 'true')

  const cena = new THREE.Scene()
  cena.background = new THREE.Color('#07090b')
  cena.fog = new THREE.Fog('#07090b', 9, 24)
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80)
  camera.position.set(0, ALTURA_OLHO, 0)

  cena.add(new THREE.HemisphereLight('#9fb4c8', '#1a1512', 0.6))
  const lua = new THREE.DirectionalLight('#8fb0ff', 0.35)
  lua.position.set(-4, 10, 3)
  cena.add(lua)

  // Piso de concreto liso que reflete um pouco as luzes.
  const piso = new THREE.Mesh(new THREE.CircleGeometry(16, 64), new THREE.MeshStandardMaterial({ color: '#30353a', roughness: 0.55, metalness: 0.2 }))
  piso.rotation.x = -Math.PI / 2
  cena.add(piso)
  // Faixa amarela em arco e pilares do galpão ao fundo.
  const faixa = new THREE.Mesh(new THREE.RingGeometry(RAIO - 2.2, RAIO - 2.08, 96, 1, Math.PI * 0.12, Math.PI * 0.76), new THREE.MeshBasicMaterial({ color: '#e0b100' }))
  faixa.rotation.x = -Math.PI / 2
  faixa.rotation.z = Math.PI
  faixa.position.y = 0.01
  cena.add(faixa)
  const pilar = pintado('#7d6a1e')
  for (let i = -4; i <= 4; i++) {
    const a = i * 0.42
    cena.add(caixa(0.4, 7, 0.4, pilar, Math.sin(a) * (RAIO + 3.5), 0, -Math.cos(a) * (RAIO + 3.5)))
  }
  const vigas = pintado('#262c32')
  for (let i = -3; i <= 3; i++) {
    const v = caixa(0.25, 0.35, 24, vigas, i * 3, 6.6, 0)
    cena.add(v)
  }
  // Poeira no ar, iluminada pelas lâmpadas.
  const poeiraGeo = new THREE.BufferGeometry()
  const pos = new Float32Array(400 * 3)
  for (let i = 0; i < 400; i++) { pos[i * 3] = (Math.random() - 0.5) * 18; pos[i * 3 + 1] = Math.random() * 5; pos[i * 3 + 2] = -Math.random() * 12 }
  poeiraGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const poeira = new THREE.Points(poeiraGeo, new THREE.PointsMaterial({ color: '#d9c9a8', size: 0.025, transparent: true, opacity: 0.45 }))
  cena.add(poeira)

  // Lugares em arco, cada um com luminária, placa e luz própria.
  const lugares = new Map<LugarMenu, { grupo: THREE.Group; luz: THREE.SpotLight; lampada: THREE.Mesh; placa: THREE.Mesh; alvo: THREE.Vector3; angulo: number; animar: (t: number) => void }>()
  LUGARES.forEach((l, i) => {
    const angulo = anguloDe(i, LUGARES.length)
    const grupo = new THREE.Group()
    grupo.position.set(Math.sin(angulo) * RAIO, 0, -Math.cos(angulo) * RAIO)
    grupo.rotation.y = -angulo
    const d = l.desenhar()
    d.grupo.scale.setScalar(1.15)
    grupo.add(d.grupo)
    const nome = placa(l.nome, l.cor, l.nome.length > 10 ? 720 : 520)
    nome.position.set(0, 3.2, -0.9)
    nome.scale.setScalar(0.8)
    grupo.add(nome)
    const luz = new THREE.SpotLight('#ffe7c2', 2, 9, 0.62, 0.55, 1.4)
    luz.position.set(0, 4.6, 1.2)
    luz.target.position.set(0, 0.8, -0.3)
    grupo.add(luz, luz.target)
    const lampada = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.35, 0.25, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#7a6a50', side: THREE.DoubleSide }))
    lampada.position.copy(luz.position)
    grupo.add(lampada)
    const fio = cilindro(0.01, 2, pintado('#111'), 4)
    fio.position.set(0, 5.7, 1.2)
    grupo.add(fio)
    cena.add(grupo)
    lugares.set(l.id, { grupo, luz, lampada, placa: nome, alvo: new THREE.Vector3(grupo.position.x, 1.1, grupo.position.z), angulo, animar: d.animar })
  })

  // Seleção pelo mouse diretamente no 3D.
  const raio = new THREE.Raycaster()
  const ponteiro = new THREE.Vector2()
  const lugarEm = (e: PointerEvent): LugarMenu | null => {
    const r = canvas.getBoundingClientRect()
    ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raio.setFromCamera(ponteiro, camera)
    for (const hit of raio.intersectObjects([...lugares.values()].map((x) => x.grupo), true)) {
      let o: THREE.Object3D | null = hit.object
      while (o) {
        for (const [id, x] of lugares) if (x.grupo === o) return id
        o = o.parent
      }
    }
    return null
  }
  let sobre: LugarMenu | null = null
  const mover = (e: PointerEvent) => {
    const l = op.aoEscolher ? lugarEm(e) : null
    canvas.style.cursor = l ? 'pointer' : 'default'
    if (l && l !== sobre) op.aoPassar?.(l)
    sobre = l
  }
  const clicar = (e: PointerEvent) => { if (!op.aoEscolher) return; const l = lugarEm(e); if (l) op.aoEscolher(l) }
  canvas.addEventListener('pointermove', mover)
  canvas.addEventListener('click', clicar)

  // Câmera: gira no centro (como virar a cabeça) e, ao entrar, anda até o lugar.
  let focado: LugarMenu = 'fabrica'
  let anguloAtual = 0
  let avanco = 0, avancoAlvo = 0
  let aoChegar: (() => void) | null = null
  const olhar = new THREE.Vector3()

  const ajustar = () => {
    const pai = canvas.parentElement
    const l = pai?.clientWidth || window.innerWidth, a = pai?.clientHeight || window.innerHeight
    renderizador.setSize(l, a, false)
    camera.aspect = l / a
    // A lista de opções fica à esquerda: o centro da imagem vai para a direita.
    if (l > 700) camera.setViewOffset(l, a, -l * 0.17, 0, l, a)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }
  const observador = new ResizeObserver(ajustar)
  let quadro = 0
  const t0 = performance.now()
  let anterior = t0
  const passo = (agora: number) => {
    quadro = requestAnimationFrame(passo)
    const dt = Math.min(0.05, (agora - anterior) / 1000)
    anterior = agora
    const t = (agora - t0) / 1000
    const f = lugares.get(focado)!
    const k = reduzido ? 1 : 1 - Math.exp(-dt * 5)
    anguloAtual += (f.angulo - anguloAtual) * k
    avanco += (avancoAlvo - avanco) * (reduzido ? 1 : 1 - Math.exp(-dt * 4))
    if (aoChegar && Math.abs(avancoAlvo - avanco) < 0.05) { const fim = aoChegar; aoChegar = null; fim() }
    // Leve balanço, como quem olha em volta.
    const balanco = reduzido ? 0 : Math.sin(t * 0.4) * 0.025
    const dir = new THREE.Vector3(Math.sin(anguloAtual + balanco), 0, -Math.cos(anguloAtual + balanco))
    camera.position.set(dir.x * avanco, ALTURA_OLHO - avanco * 0.08, dir.z * avanco)
    olhar.set(dir.x * RAIO, 1.15, dir.z * RAIO)
    camera.lookAt(olhar)
    for (const [id, x] of lugares) {
      const alvo = id === focado ? 30 : 2.2
      x.luz.intensity += (alvo - x.luz.intensity) * (reduzido ? 1 : 1 - Math.exp(-dt * 6))
      ;(x.lampada.material as THREE.MeshBasicMaterial).color.set(id === focado ? '#fff0c8' : '#7a6a50')
      // Só a placa do lugar escolhido aparece: as outras não brigam com o título.
      x.placa.visible = id === focado && avancoAlvo < 1
      x.placa.scale.setScalar(0.95)
      if (!reduzido) x.animar(t)
    }
    if (!reduzido) poeira.rotation.y = t * 0.01
    renderizador.render(cena, camera)
  }
  requestAnimationFrame(() => {
    if (canvas.parentElement) observador.observe(canvas.parentElement)
    ajustar()
  })
  quadro = requestAnimationFrame(passo)

  return {
    canvas,
    focar(lugar, distancia = 0) {
      focado = lugar
      avancoAlvo = distancia
      aoChegar = null
    },
    entrar(lugar) {
      focado = lugar
      avancoAlvo = RAIO - 3.2
      if (reduzido) return Promise.resolve()
      return new Promise((resolver) => {
        aoChegar = resolver
        // Garantia: se a aba ficar em segundo plano, não prende a navegação.
        setTimeout(() => { if (aoChegar === resolver) { aoChegar = null; resolver() } }, 900)
      })
    },
    pausar() {
      cancelAnimationFrame(quadro)
      quadro = 0
    },
    retomar() {
      if (quadro) return
      anterior = performance.now()
      ajustar()
      quadro = requestAnimationFrame(passo)
    },
    destruir() {
      cancelAnimationFrame(quadro)
      observador.disconnect()
      canvas.removeEventListener('pointermove', mover)
      canvas.removeEventListener('click', clicar)
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
