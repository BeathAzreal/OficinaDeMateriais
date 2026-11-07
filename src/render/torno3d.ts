import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CAUSA, type ModeloTorno } from '../torno/modelo'
import { webglDisponivel } from './palco3d'

/*
 * O que faz: o torno convencional em 3D (v2.2, H108). Só LÊ o modelo:
 * barramento, cabeçote, placa de 3 castanhas, a peça (sólido de revolução do
 * perfil r(z), com a cor do acabamento), carro e porta-ferramenta na posição
 * da ponta, cavaco com a forma do material e os instrumentos de medição.
 * Onde mexer: as peças da máquina em `montarMaquina`; o cavaco em `Cavacos`.
 * Unidade: 1 = 1 mm. Eixo da peça no eixo X do mundo (placa em x = 0, peça
 * para +x); o operador fica em +Z (a ferramenta vem da frente).
 */

export type Instrumento = 'micrometro' | 'paquimetro' | 'rugosimetro'

export interface VistaTorno {
  canvas: HTMLCanvasElement
  /** Desenha um quadro. `dt` em segundos (0 = parado). */
  desenhar(m: ModeloTorno, dt: number): void
  /** Ponto do plano de trabalho (altura do centro) sob o ponteiro, em coordenadas do torno. */
  pontoNoPlano(clientX: number, clientY: number): { z: number; r: number } | null
  /** Posição z (mm da placa) da peça sob o ponteiro, ou null. */
  pontoNaPeca(clientX: number, clientY: number): number | null
  mostrarInstrumento(tipo: Instrumento | null, z?: number, m?: ModeloTorno): void
  enquadrar(largura: number, altura: number): void
  aproximar(delta: number): void
  centralizar(): void
  destruir(): void
}

const metal = (cor: string, rug = 0.45, met = 0.6) => new THREE.MeshStandardMaterial({ color: cor, roughness: rug, metalness: met })
const pintura = (cor: string) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.65, metalness: 0.15 })
function caixa(l: number, a: number, p: number, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, p), mat)
  m.position.set(x, y, z)
  return m
}

/** Cavaco: fita contínua que enrola, espirais que quebram ou lascas curtas; tudo cai na bandeja. */
class Cavacos {
  readonly grupo = new THREE.Group()
  private fita: { linha: THREE.Mesh; pontos: THREE.Vector3[]; fase: number } | null = null
  private soltos: { obj: THREE.Object3D; v: THREE.Vector3; vida: number; parado: boolean }[] = []
  private acumulado = 0
  constructor(private readonly piso: number) {}

  private materialCavaco(cor: string) { return new THREE.MeshStandardMaterial({ color: cor, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }) }
  /** Fita de cavaco com volume (tubo achatado) pelos pontos. */
  private tubo(pontos: THREE.Vector3[]): THREE.BufferGeometry {
    if (pontos.length < 2) return new THREE.BufferGeometry()
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pontos), Math.max(2, pontos.length * 2), 0.7, 5, false)
  }

  atualizar(m: ModeloTorno, dt: number, ponta: THREE.Vector3): void {
    const cor = m.cavaco.azul ? '#5b6fa8' : m.material.cores.cavaco
    if (m.cortando && dt > 0) {
      const forma = m.cavaco.forma
      // Mais metal removido, mais cavaco (escala do jogo).
      this.acumulado += dt * Math.min(40, 4 + m.cavaco.taxaMm3S / 40)
      if (forma === 'fita') {
        if (!this.fita) {
          const pontos = [ponta.clone(), ponta.clone().add(new THREE.Vector3(0, 0.5, 0.5))]
          const linha = new THREE.Mesh(this.tubo(pontos), this.materialCavaco(cor))
          this.grupo.add(linha)
          this.fita = { linha, pontos, fase: 0 }
        }
        const f = this.fita
        while (this.acumulado >= 1) {
          this.acumulado -= 1
          f.fase += 0.55
          const ultimo = f.pontos[f.pontos.length - 1]
          // Hélice que sobe e se afasta da peça (para o operador e para cima).
          const passo = new THREE.Vector3(Math.cos(f.fase) * 2.4, 1.6 + Math.sin(f.fase) * 2.4, 1.8)
          f.pontos.push(ultimo.clone().add(passo))
        }
        f.pontos[0].copy(ponta)
        f.linha.geometry.dispose()
        f.linha.geometry = this.tubo(f.pontos)
        if (f.pontos.length > 70) this.soltarFita()
      } else {
        while (this.acumulado >= 1) {
          this.acumulado -= 1
          const obj = forma === 'espiral' ? this.espiral(cor) : this.lasca(cor)
          obj.position.copy(ponta)
          this.grupo.add(obj)
          this.soltos.push({ obj, v: new THREE.Vector3((Math.random() - 0.3) * 40, 30 + Math.random() * 40, 30 + Math.random() * 40), vida: 0, parado: false })
        }
      }
    } else if (this.fita) this.soltarFita()

    // Queda até a bandeja; depois de um tempo, somem os mais antigos.
    for (const s of this.soltos) {
      s.vida += dt
      if (s.parado) continue
      s.v.y -= 600 * dt
      s.obj.position.addScaledVector(s.v, dt)
      s.obj.rotation.x += dt * 6
      if (s.obj.position.y <= this.piso) { s.obj.position.y = this.piso; s.parado = true }
    }
    while (this.soltos.length > 90) this.remover(this.soltos.shift()!)
  }

  private soltarFita(): void {
    const f = this.fita!
    this.fita = null
    const grupo = new THREE.Group()
    const centro = f.pontos[Math.floor(f.pontos.length / 2)].clone()
    f.linha.position.sub(centro)
    grupo.position.copy(centro)
    grupo.add(f.linha)
    this.grupo.add(grupo)
    this.soltos.push({ obj: grupo, v: new THREE.Vector3(10, 0, 20), vida: 0, parado: false })
  }
  private espiral(cor: string): THREE.Object3D {
    const pontos: THREE.Vector3[] = []
    for (let i = 0; i < 14; i++) pontos.push(new THREE.Vector3(Math.cos(i * 0.8) * 3, i * 0.6, Math.sin(i * 0.8) * 3))
    return new THREE.Mesh(this.tubo(pontos), this.materialCavaco(cor))
  }
  private lasca(cor: string): THREE.Object3D {
    return new THREE.Mesh(new THREE.TetrahedronGeometry(1.6), this.materialCavaco(cor))
  }
  private remover(s: { obj: THREE.Object3D }): void {
    this.grupo.remove(s.obj)
    s.obj.traverse((o) => {
      const x = o as THREE.Mesh
      x.geometry?.dispose()
      ;(x.material as THREE.Material | undefined)?.dispose?.()
    })
  }
  limpar(): void {
    while (this.soltos.length) this.remover(this.soltos.pop()!)
    if (this.fita) { this.grupo.remove(this.fita.linha); this.fita.linha.geometry.dispose(); this.fita = null }
  }
}

export function criarTorno3D(m0: ModeloTorno): VistaTorno | null {
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
  canvas.setAttribute('aria-label', 'Torno em 3D. Segure o botão esquerdo para levar a ferramenta até o ponteiro; botão do meio gira a câmera, direito arrasta.')

  const cena = new THREE.Scene()
  cena.background = new THREE.Color('#1b2127')
  cena.fog = new THREE.Fog('#1b2127', 900, 2200)
  const camera = new THREE.PerspectiveCamera(38, 1, 2, 5000)
  const controles = new OrbitControls(camera, canvas)
  controles.enableDamping = true
  controles.dampingFactor = 0.12
  controles.enableZoom = false
  // Botão esquerdo é a mão na manivela: a câmera fica no do meio (girar) e no direito (arrastar).
  controles.mouseButtons = { LEFT: -1 as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }
  // Toque: um dedo é a mão (ferramenta, lanterna); dois dedos aproximam e arrastam a câmera.
  controles.touches = { ONE: -1 as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN }

  cena.add(new THREE.HemisphereLight('#dfe8f0', '#2b2a28', 1.1))
  const sol = new THREE.DirectionalLight('#ffffff', 1.4)
  sol.position.set(200, 500, 400)
  cena.add(sol)
  const luminaria = new THREE.SpotLight('#fff3dc', 40000, 900, 0.6, 0.5, 2)
  luminaria.position.set(60, 260, 160)
  luminaria.target.position.set(60, 0, 0)
  cena.add(luminaria, luminaria.target)

  // Máquina.
  const azul = pintura('#2f5d7c'), cinza = pintura('#59636d'), aco = metal('#9aa4ad', 0.35, 0.8)
  const piso = -260
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshStandardMaterial({ color: '#3a3f44', roughness: 0.95 }))
  chao.rotation.x = -Math.PI / 2
  chao.position.y = piso - 160
  cena.add(chao)
  cena.add(caixa(1100, 40, 160, azul, 150, -110, -40)) // barramento
  cena.add(caixa(1100, 8, 40, aco, 150, -86, -90), caixa(1100, 8, 40, aco, 150, -86, 10)) // guias
  cena.add(caixa(1100, 140, 140, cinza, 150, -200, -40)) // base
  const bandeja = caixa(1000, 6, 260, metal('#4a5258', 0.7, 0.5), 150, piso + 3, 30)
  cena.add(bandeja)
  cena.add(caixa(220, 210, 200, azul, -170, -5, -40)) // cabeçote
  cena.add(caixa(120, 50, 60, cinza, 520, -60, -40)) // contraponto recuado
  // Placa e castanhas (giram com o eixo).
  const placa = new THREE.Group()
  const corpo = new THREE.Mesh(new THREE.CylinderGeometry(80, 80, 55, 48), metal('#7e878f', 0.4, 0.8))
  corpo.rotation.z = Math.PI / 2
  corpo.position.x = -37
  placa.add(corpo)
  for (let k = 0; k < 3; k++) {
    const castanha = caixa(22, 30, 26, metal('#6d757c', 0.5, 0.8))
    const a = (k * 2 * Math.PI) / 3
    castanha.position.set(-2, Math.cos(a) * (m0.raioBruto + 15), Math.sin(a) * (m0.raioBruto + 15))
    castanha.rotation.x = a
    placa.add(castanha)
  }
  cena.add(placa)

  // Peça: sólido de revolução do perfil, com cor por ponto (bruto, usinado, rugosidade).
  const fixado = 30
  const materialPeca = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.75, roughness: 0.35 })
  const pecaMesh = new THREE.Mesh(new THREE.BufferGeometry(), materialPeca)
  const pecaGrupo = new THREE.Group()
  pecaMesh.rotation.z = -Math.PI / 2 // eixo Y do torno de revolução → eixo X do mundo
  pecaGrupo.add(pecaMesh)
  cena.add(pecaGrupo)
  const corBruta = new THREE.Color(m0.material.cores.bruta), corUsinada = new THREE.Color(m0.material.cores.usinada)
  let versaoPeca = -1
  const SEG = 48
  const atualizarPeca = (m: ModeloTorno) => {
    const pts: THREE.Vector2[] = [], cores: THREE.Color[] = []
    const face = m.zFace
    pts.push(new THREE.Vector2(0, -fixado)); cores.push(corBruta)
    pts.push(new THREE.Vector2(m.raioBruto, -fixado)); cores.push(corBruta)
    const passo = 0.25
    for (let z = 0; z <= face + 1e-6; z += passo) {
      const r = m.raioEm(z)
      pts.push(new THREE.Vector2(Math.max(0.01, r), z))
      const ra = m.raEm(z)
      if (ra === null) cores.push(corBruta)
      else {
        // Liso brilha; áspero fica fosco e escuro; trepidação marca listras.
        const i = m.celula(z)
        const fosco = Math.min(1, ra / 6)
        const c = corUsinada.clone().lerp(new THREE.Color('#6b737b'), 0.55 * fosco)
        if (m.causa[i] & CAUSA.vibracao && Math.floor(z * 2) % 2 === 0) c.multiplyScalar(0.7)
        cores.push(c)
      }
    }
    pts.push(new THREE.Vector2(0.01, face)); cores.push(corUsinada)
    const geo = new THREE.LatheGeometry(pts, SEG)
    // LatheGeometry: (SEG + 1) fatias × pts.length pontos.
    const n = pts.length, cor = new Float32Array((SEG + 1) * n * 3)
    for (let s = 0; s <= SEG; s++) {
      // Carepa irregular em volta: deixa ver a peça girando.
      const mancha = 0.85 + 0.15 * Math.sin(s * 1.7) * Math.cos(s * 0.6)
      for (let j = 0; j < n; j++) {
        const c = cores[j], k = (s * n + j) * 3, bruto = c === corBruta
        cor[k] = c.r * (bruto ? mancha : 1); cor[k + 1] = c.g * (bruto ? mancha : 1); cor[k + 2] = c.b * (bruto ? mancha : 1)
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cor, 3))
    pecaMesh.geometry.dispose()
    pecaMesh.geometry = geo
  }

  // Carro, transversal e porta-ferramenta (seguem a ponta).
  const carro = new THREE.Group()
  carro.add(caixa(140, 30, 220, cinza, 0, -75, 40)) // carro sobre as guias
  carro.add(caixa(120, 70, 30, cinza, 0, -120, 155)) // avental
  const transversal = new THREE.Group()
  // Tudo atrás da ponta (para o operador, +z): a ponta fica livre para ver o corte e o cavaco.
  transversal.add(caixa(90, 22, 120, azul, 10, -50, 90))
  transversal.add(caixa(60, 34, 60, metal('#3e464d', 0.5, 0.6), 10, -22, 70)) // torre
  const suporte = caixa(16, 12, 60, metal('#2f353a', 0.4, 0.7), 0, -8, 0) // porta-ferramenta
  transversal.add(suporte)
  // Pastilha: o canto (a ponta) fica na origem, virado para a placa (−x) e para o centro (−z).
  const pastilha = caixa(9, 4, 9, metal('#c9b037', 0.3, 0.9), 4.5, 0, 4.5)
  transversal.add(pastilha)
  carro.add(transversal)
  cena.add(carro)
  const posicionarFerramenta = (m: ModeloTorno) => {
    carro.position.set(m.zFerramenta, 0, 0)
    // A ponta da pastilha (canto do losango) fica na ponta do modelo.
    transversal.position.set(0, 0, m.rFerramenta)
    suporte.position.set(8, -8, 38)
  }

  const cavacos = new Cavacos(piso + 7)
  cena.add(cavacos.grupo)

  // Instrumentos (aparecem sobre a peça por alguns segundos).
  const instrumentos = new THREE.Group()
  cena.add(instrumentos)
  let instrumentoAte = 0
  const mostrarInstrumento = (tipo: Instrumento | null, z?: number, m?: ModeloTorno) => {
    instrumentos.clear()
    if (!tipo || z === undefined || !m) return
    const r = Math.max(1, m.raioEm(z)), cor = metal('#d6dbe0', 0.3, 0.9), escuro = pintura('#2b2f33')
    if (tipo === 'micrometro') {
      const arco = new THREE.Mesh(new THREE.TorusGeometry(r + 18, 4, 8, 24, Math.PI), pintura('#c93a2a'))
      arco.rotation.y = Math.PI / 2
      instrumentos.add(arco)
      instrumentos.add(caixa(6, 6, 30, cor, 0, r + 18, 0))
    } else if (tipo === 'paquimetro') {
      instrumentos.add(caixa(160, 14, 3, cor, -60, r + 30, 0))
      instrumentos.add(caixa(6, 40, 3, cor, 0, r + 12, 0), caixa(6, 40, 3, cor, -m.zFace + z + 0.01, r + 12, 0))
    } else {
      instrumentos.add(caixa(40, 24, 30, escuro, 0, r + 40, 0))
      instrumentos.add(caixa(2, 26, 2, cor, 0, r + 14, 0))
    }
    instrumentos.position.set(z, 0, 0)
    instrumentoAte = performance.now() + 4000
  }

  // Câmera do operador.
  const alvoPadrao = new THREE.Vector3(Math.min(50, m0.balanco * 0.65), -40, 30)
  const centralizar = () => {
    camera.position.set(alvoPadrao.x + 10, 300, 470)
    controles.target.copy(alvoPadrao)
    controles.update()
  }
  centralizar()

  const raio = new THREE.Raycaster(), ponteiro = new THREE.Vector2()
  const planoTrabalho = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  const raioNaTela = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect()
    ponteiro.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
    raio.setFromCamera(ponteiro, camera)
  }

  let anguloEixo = 0
  return {
    canvas,
    desenhar(m, dt) {
      if (m.volumeRemovidoMm3 !== versaoPeca) { versaoPeca = m.volumeRemovidoMm3; atualizarPeca(m) }
      // Giro visual mais lento que o real (evita o efeito estroboscópico).
      if (m.eixoLigado) anguloEixo += dt * Math.min(5, m.rpm / 60) * 2 * Math.PI * 0.35
      placa.rotation.x = anguloEixo
      pecaGrupo.rotation.x = anguloEixo
      // Trepidação: a ponta da peça treme.
      pecaGrupo.position.set(0, m.vibrando ? (Math.random() - 0.5) * 0.8 : 0, m.vibrando ? (Math.random() - 0.5) * 0.8 : 0)
      posicionarFerramenta(m)
      cavacos.atualizar(m, dt, new THREE.Vector3(m.zFerramenta, 1, m.rFerramenta + m.afastamentoMm))
      if (instrumentos.children.length && performance.now() > instrumentoAte) instrumentos.clear()
      controles.update()
      renderizador.render(cena, camera)
    },
    pontoNoPlano(clientX, clientY) {
      raioNaTela(clientX, clientY)
      const p = new THREE.Vector3()
      if (!raio.ray.intersectPlane(planoTrabalho, p)) return null
      return { z: p.x, r: p.z }
    },
    pontoNaPeca(clientX, clientY) {
      raioNaTela(clientX, clientY)
      const hit = raio.intersectObject(pecaMesh, false)[0]
      return hit && hit.point.x >= 0 ? hit.point.x : null
    },
    mostrarInstrumento,
    enquadrar(largura, altura) {
      renderizador.setSize(largura, altura, false)
      camera.aspect = largura / Math.max(1, altura)
      camera.updateProjectionMatrix()
    },
    aproximar(delta) {
      const dir = camera.position.clone().sub(controles.target)
      dir.multiplyScalar(Math.max(0.35, Math.min(3, 1 + delta / 600)))
      camera.position.copy(controles.target).add(dir)
    },
    centralizar,
    destruir() {
      cavacos.limpar()
      controles.dispose()
      cena.traverse((o) => {
        const x = o as THREE.Mesh
        x.geometry?.dispose()
        const mat = x.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((y) => y.dispose())
        else mat?.dispose()
      })
      renderizador.dispose()
    },
  }
}
