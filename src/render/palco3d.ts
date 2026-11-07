import { OBB } from 'three/addons/math/OBB.js'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Cordao } from '../modelo/cordao'
import type { AnaliseDefeitos } from '../modelo/defeitos'
import type { GeometriaJunta } from '../modelo/junta'
import { MATERIAIS, type MaterialId } from '../modelo/material'
import { MODELO, PECA } from '../modelo/parametros'
import type { ContextoProcesso } from '../modelo/processo'
import { MalhaCordaoViva } from './cordaoVivo'
import { Defeitos3D } from './defeitos3d'
import { chapasNaJunta, cristaMm, juntaDe, pontoNaSuperficie } from '../modelo/juntas'
import { paraMundo } from './malha3d'
import { CONSUMO, novoMapaConsumo, preencherMapaConsumo, type MapaConsumo } from '../modelo/consumoChapa'
import { INFO_JUNTA } from '../modelo/juntas'
import { curvarArvore, poseNoTubo, uniformesCurva, type CurvaTubo } from './curvaTubo'
import { criarOficinaTreino } from './oficinaTreino'
import { corAgua, criarFundoMar, densidadeAgua } from './fundoMar'
import { criarSerralheria } from './serralheria'

/*
 * Palco 3D comum à inspeção e à execução: renderer, luz, chapas, sala,
 * cordão, marcas da missão e régua. Só LÊ o modelo (H3, H41); brilho,
 * riscos e luz são aparência (H8, H40).
 *
 * Grupos: cena → giro (no pivô de vista.ts, H42) → peça (desfaz o pivô)
 * → relevo (exagero vertical: escala só o y).
 */

/** Acabamento do metal: só aparência (H40). */
const ACABAMENTO: Record<MaterialId, { metalness: number; roughness: number }> = {
  'aco-carbono': { metalness: 0.75, roughness: 0.5 },
  'inox-austenitico': { metalness: 0.9, roughness: 0.32 },
  aluminio: { metalness: 0.6, roughness: 0.62 },
  'aco-galvanizado': { metalness: 0.7, roughness: 0.45 },
  'aco-medio-carbono': { metalness: 0.7, roughness: 0.55 },
  'inox-ferritico': { metalness: 0.88, roughness: 0.36 },
  cobre: { metalness: 0.85, roughness: 0.38 },
}

/** Faixas de cor do cordão pela distância ao centro, como as camadas da vista de cima. */
const LIMITES_CAMADAS = [1, 0.72, 0.42, 0.14]

/** Escala real por padrão: o exagero (até 6×) é só um recurso de inspeção, escolhido pelo jogador. */
export const EXAGERO_PADRAO = 1
export const EXAGERO_MIN = 1
export const EXAGERO_MAX = 6

/** Altura (mm, antes do exagero) das linhas e rótulos desenhados sobre a chapa. */
const SOBRE_CHAPA = 0.03

export interface OpcoesPalco {
  serralheria?: boolean
  larguraPecaMm?: number
  processo?: 'mig' | 'eletrodo'
  oficinaTreino?: boolean
  contexto: ContextoProcesso
  geometria: GeometriaJunta
  /** Marcas do desenho da missão; `alinhamentoMm` liga a faixa de tolerância. */
  missao?: { inicioMm: number; fimMm: number; alinhamentoMm?: number }
  /** Rótulos INÍCIO/FIM e régua de 10 em 10 mm (como a vista de cima da execução). */
  regua?: boolean
  sombras?: boolean
  /** Lado do mapa de sombra (pixels). */
  mapaSombra?: number
  pixelRatioMax?: number
  antialias?: boolean
  /** H110: solda subaquática: fundo do mar no lugar da oficina, água escura e turva. */
  subaquatico?: { turbidez: number; estrutura: 'cais' | 'casco' | 'plataforma' }
}

/** Testa se o navegador consegue criar um contexto WebGL. */
export function webglDisponivel(): boolean {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') ?? c.getContext('webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** Riscos de chapa escovada ao longo de X (sorteio fixo, como em cena.ts). */
function texturaEscovada(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#e6e6e6'
  ctx.fillRect(0, 0, c.width, c.height)
  let semente = 11
  const sorteio = () => (semente = (semente * 16807) % 2147483647) / 2147483647
  for (let k = 0; k < 2600; k++) {
    const y = sorteio() * c.height
    const x = sorteio() * c.width
    const comp = 40 + sorteio() * 420
    const claro = sorteio() < 0.5
    ctx.strokeStyle = claro ? `rgba(255,255,255,${0.15 + sorteio() * 0.35})` : `rgba(90,90,90,${0.05 + sorteio() * 0.15})`
    ctx.lineWidth = 0.6 + sorteio() * 0.9
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + comp, y)
    ctx.stroke()
    // Continua do outro lado, para a textura repetir sem emenda.
    if (x + comp > c.width) {
      ctx.beginPath()
      ctx.moveTo(x - c.width, y)
      ctx.lineTo(x + comp - c.width, y)
      ctx.stroke()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  // As faces das chapas têm UV em mm (ExtrudeGeometry): u na largura, v ao longo da junta.
  // Girada 90°, os riscos de laminação ficam ao longo da junta, como na vista de cima.
  t.repeat.set(1 / (2 * PECA.larguraChapaMm), 1 / PECA.comprimentoMm)
  t.center.set(0.5, 0.5)
  t.rotation = Math.PI / 2
  return t
}

/** Ladrilhos de concreto do piso da oficina: rejunte a cada 500 mm (uma volta da textura). */
function texturaPiso(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#5a5d61'
  ctx.fillRect(0, 0, 256, 256)
  let semente = 7
  const sorteio = () => (semente = (semente * 16807) % 2147483647) / 2147483647
  for (let k = 0; k < 900; k++) {
    ctx.fillStyle = sorteio() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)'
    ctx.fillRect(sorteio() * 256, sorteio() * 256, 1 + sorteio() * 3, 1 + sorteio() * 3)
  }
  ctx.strokeStyle = '#2b2d30'
  ctx.lineWidth = 4
  ctx.strokeRect(0, 0, 256, 256)
  // Faixa de segurança amarela na borda de um ladrilho: marca bem onde fica o chão.
  ctx.fillStyle = '#a8862c'
  ctx.fillRect(0, 40, 256, 14)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Parede de blocos; o teto (teto = true) é escuro com luminárias. */
function texturaParede(teto: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = teto ? '#2a2d31' : '#6b7178'
  ctx.fillRect(0, 0, 256, 256)
  if (teto) {
    ctx.fillStyle = '#f2f4f0'
    ctx.fillRect(40, 108, 176, 40)
  } else {
    ctx.strokeStyle = 'rgba(30,32,36,0.55)'
    ctx.lineWidth = 2
    for (let y = 0; y <= 256; y += 32) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(256, y)
      ctx.stroke()
      const desloc = (y / 32) % 2 ? 32 : 0
      for (let x = desloc; x < 256; x += 64) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + 32)
        ctx.stroke()
      }
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Sala da oficina em volta da peça (mm, eixos do mundo): piso, paredes e teto. */
const SALA = { piso: -380, altura: 2600, meia: 1700 }

/**
 * Chapas da junta (H46): o corte de chapasNaJunta, no plano (n, w),
 * extrudado ao longo da junta (reta) de s = 0 a 150 mm.
 */
function geometriaChapas(contexto: ContextoProcesso): THREE.BufferGeometry[] {
  const L = PECA.comprimentoMm
  return chapasNaJunta(juntaDe(contexto), contexto, PECA.larguraChapaMm).map((poligono) => {
    // Forma em (−n, w): girada 90° em y, a extrusão (z local) vira +x e −n vira +z (= n).
    const forma = new THREE.Shape(poligono.map(([n, w]) => new THREE.Vector2(-n, w)))
    // H103: no tubo a chapa é curvada no shader; precisa de vértices ao longo da junta (1 por mm).
    const g = new THREE.ExtrudeGeometry(forma, { depth: L, bevelEnabled: false, curveSegments: 1, steps: contexto.tubo ? L : 1 })
    g.rotateY(Math.PI / 2)
    g.translate(-L / 2, 0, 0)
    return g
  })
}

/**
 * H101: recorta o material pelo mapa de consumo da chapa (coordenadas do
 * objeto: x ao longo da junta, z para o lado, as mesmas da chapa e do
 * cordão). Onde o metal caiu o fragmento some: dá para ver através. Em volta,
 * a borda queimada escurece; por dentro do buraco (faces de trás) fica a
 * parede escura da chapa.
 */
function furarComMapa(mat: THREE.Material, textura: THREE.Texture, paredes: boolean): void {
  const anterior = mat.onBeforeCompile
  const chaveAnterior = mat.customProgramCacheKey()
  if (paredes) mat.side = THREE.DoubleSide
  mat.onBeforeCompile = (shader, renderer) => {
    anterior.call(mat, shader, renderer)
    shader.uniforms.mapaConsumo = { value: textura }
    shader.vertexShader = 'varying vec3 vConsumo;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvConsumo = position;\n#ifdef USE_INSTANCING\nvConsumo = (instanceMatrix * vec4(position, 1.0)).xyz;\n#endif')
    shader.fragmentShader =
      'uniform sampler2D mapaConsumo;\nvarying vec3 vConsumo;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 uvConsumo = vec2((vConsumo.x + ${(PECA.comprimentoMm / 2).toFixed(1)}) / ${PECA.comprimentoMm.toFixed(1)}, (vConsumo.z + ${CONSUMO.meiaLarguraMm.toFixed(1)}) / ${(2 * CONSUMO.meiaLarguraMm).toFixed(1)});
        if (uvConsumo.x > 0.0 && uvConsumo.x < 1.0 && uvConsumo.y > 0.0 && uvConsumo.y < 1.0) {
          vec4 consumo = texture2D(mapaConsumo, uvConsumo);
          if (consumo.r > 0.5) discard;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.07, 0.06), 0.85 * consumo.g);
        }
        ${paredes ? 'if (!gl_FrontFacing) diffuseColor.rgb *= 0.22;' : ''}`,
      )
  }
  mat.customProgramCacheKey = () => `${chaveAnterior}|furo-v1${paredes ? 'p' : ''}`
  mat.needsUpdate = true
}

/** Texto deitado sobre a chapa (rótulos da régua e da missão). */
function rotuloDeitado(texto: string, alturaMm: number, cor: string): THREE.Mesh {
  const c = document.createElement('canvas')
  const px = 64
  const ctx = c.getContext('2d')!
  ctx.font = `bold ${px}px system-ui, sans-serif`
  c.width = Math.ceil(ctx.measureText(texto).width) + 8
  c.height = Math.ceil(px * 1.25)
  ctx.font = `bold ${px}px system-ui, sans-serif`
  ctx.fillStyle = cor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(texto, c.width / 2, c.height / 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry((alturaMm * c.width) / c.height, alturaMm),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }),
  )
  // O plano nasce de frente para +z; deitado, o "para cima" do texto vira −z (para cima na tela).
  m.rotation.x = -Math.PI / 2
  return m
}

export class Palco3D {
  readonly renderer: THREE.WebGLRenderer
  readonly elemento: HTMLCanvasElement
  readonly cena = new THREE.Scene()
  /** Gira em torno do pivô de vista.ts (H42). */
  readonly giro = new THREE.Group()
  /** Coordenadas do mundo de malha3d.ts (sem giro). Tocha e efeitos entram aqui. */
  readonly peca = new THREE.Group()
  /** Tudo que tem relevo: o exagero escala só o y. */
  readonly relevo = new THREE.Group()
  readonly sol: THREE.DirectionalLight
  /** Sala, suporte e sol: giram com a peça tombada (H47), porque a câmera fica de frente para a junta. */
  readonly ambienteGrupo = new THREE.Group()
  /** Coluna do suporte que segura a peça pela orelha da ponta (vai do piso até ela). */
  private readonly coluna: THREE.Mesh
  private readonly garra: THREE.Mesh
  private readonly sapata: THREE.Mesh
  /** Orelha soldada na ponta da peça (coordenadas da peça): por onde o suporte a segura. */
  private readonly orelha = new THREE.Vector3()
  private readonly temp = new THREE.Vector3()
  private rolagemGraus = 0
  private suportePronto = false
  private chapasColisao: THREE.Mesh[] = []
  /** H101: mapa da chapa consumida (buraco e borda queimada), só no topo e no V (há avesso livre). */
  private readonly mapaConsumo: MapaConsumo | null
  private readonly texturaConsumo: THREE.DataTexture | null
  private anguloGiro = 0
  /** H103: emenda de dois tubos: a peça plana é curvada no desenho (curvaTubo.ts). Null nas chapas. */
  readonly curva: CurvaTubo | null
  private readonly uCurva: ReturnType<typeof uniformesCurva> | null
  private readonly curvados = new WeakSet<THREE.Material>()
  /** Objetos rígidos no tubo: suporte com a pose do ponto (x, z), fixo ou seguindo a posição plana do objeto. */
  private readonly rigidos: { suporte: THREE.Group; objeto: THREE.Object3D; x?: number; z?: number }[] = []
  private readonly cordao3d: THREE.Mesh
  private readonly cores: THREE.Color[]
  private readonly texturas: THREE.Texture[] = []
  private readonly pmrem: THREE.PMREMGenerator
  private readonly ambiente: THREE.Texture
  private cordaoAtual: Cordao | null = null
  private volumeAtual = -1
  /** Buffers fixos do cordão (cordaoVivo.ts); refeitos só quando o cordão é outro. */
  private viva: MalhaCordaoViva | null = null
  private exagero = EXAGERO_PADRAO
  /** Cordões soltos (H58): outro ponto de solda longe da junta, cada um com a sua malha. */
  private soltos3d: { viva: MalhaCordaoViva; malha: THREE.Mesh }[] = []
  /** Gotas, respingos, faixas de borda e oxidação (H50–H57). */
  private readonly defeitos3d: Defeitos3D
  /** Chapas que dobram no empeno (topo e V): pivô na borda da junta e sentido do giro. */
  /** H110: cenário do mar (as algas balançam com o tempo). */
  private fundoMar: THREE.Group | null = null
  private readonly pivosEmpeno: { pivo: THREE.Group; sinal: number }[] = []
  largura = 0
  altura = 0

  /** Null se o WebGL não puder ser iniciado. */
  static criar(op: OpcoesPalco): Palco3D | null {
    try {
      return new Palco3D(op, new THREE.WebGLRenderer({ antialias: op.antialias ?? true }))
    } catch {
      return null
    }
  }

  private constructor(
    private readonly op: OpcoesPalco,
    renderer: THREE.WebGLRenderer,
  ) {
    this.renderer = renderer
    this.elemento = renderer.domElement
    renderer.setPixelRatio(Math.min(op.pixelRatioMax ?? 2, window.devicePixelRatio || 1))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.shadowMap.enabled = op.sombras ?? true
    renderer.shadowMap.type = THREE.PCFShadowMap

    const material = MATERIAIS[op.contexto.material]
    const cena = this.cena
    const tubo = op.contexto.tubo
    this.curva = tubo ? { raio: tubo.diametroMm / 2, giro: THREE.MathUtils.degToRad(op.contexto.posicaoInicial?.giroGraus ?? 0) } : null
    this.uCurva = this.curva ? uniformesCurva(this.curva) : null
    cena.background = new THREE.Color('#17191c')
    this.pmrem = new THREE.PMREMGenerator(renderer)
    const ambienteCena = new RoomEnvironment()
    this.ambiente = this.pmrem.fromScene(ambienteCena, 0.04).texture
    ambienteCena.dispose()
    cena.environment = this.ambiente
    cena.environmentIntensity = 0.7

    const luzAmbiente = new THREE.AmbientLight(0xffffff, 0.35)
    cena.add(luzAmbiente)
    // Luz de frente (do lado de quem solda): a face da junta nunca fica no escuro, mesmo de cabeça para baixo.
    const frontal = new THREE.DirectionalLight(0xffffff, 0.7)
    frontal.position.set(30, 200, 120)
    cena.add(frontal)
    cena.add(this.ambienteGrupo)
    const sol = new THREE.DirectionalLight(0xffffff, 2.4)
    sol.position.set(-180, 340, 140)
    sol.castShadow = op.sombras ?? true
    sol.shadow.mapSize.set(op.mapaSombra ?? 2048, op.mapaSombra ?? 2048)
    Object.assign(sol.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 1200 })
    sol.shadow.bias = -0.0004
    sol.shadow.normalBias = 0.3
    sol.shadow.camera.updateProjectionMatrix()
    this.ambienteGrupo.add(sol)
    this.sol = sol
    // H110: no fundo do mar quase nada chega da superfície; quem ilumina é a lanterna (bancada15.ts).
    const mar = op.subaquatico
    if (mar) {
      const agua = corAgua(mar.turbidez)
      cena.background = agua
      cena.fog = new THREE.FogExp2(agua, densidadeAgua(mar.turbidez))
      cena.environmentIntensity = 0.03
      luzAmbiente.color.set('#4f8fa0')
      luzAmbiente.intensity = 0.02
      frontal.intensity = 0
      sol.color.set('#5fb3c4')
      sol.intensity = 0.12 * (1 - 0.6 * mar.turbidez)
      sol.position.set(-60, 500, 40)
    }

    // Pivô do giro: o mesmo de vista.ts (centro da chapa ou da junta circular).
    const pivo = op.geometria.centro ?? { x: PECA.comprimentoMm / 2, y: 0 }
    const [px, , pz] = paraMundo(pivo.x, pivo.y, 0)
    this.giro.position.set(px, 0, pz)
    this.peca.position.set(-px, 0, -pz)
    cena.add(this.giro)
    this.giro.add(this.peca)
    this.peca.add(this.relevo)

    const textura = texturaEscovada()
    textura.anisotropy = renderer.capabilities.getMaxAnisotropy()
    this.texturas.push(textura)
    const matChapa = new THREE.MeshStandardMaterial({ color: op.processo === 'eletrodo' ? '#525d63' : material.aparencia.chapaClara, map: op.processo === 'eletrodo' ? null : textura, ...ACABAMENTO[material.id], ...(op.processo === 'eletrodo' ? { roughness: 0.78, metalness: 0.45 } : {}) })
    const juntaPeca = juntaDe(op.contexto)
    const dobra = juntaPeca === 'topo' || juntaPeca === 'v'
    if (INFO_JUNTA[juntaPeca].familia !== 'filete') {
      this.mapaConsumo = novoMapaConsumo(PECA.comprimentoMm)
      const t = new THREE.DataTexture(this.mapaConsumo.dados, this.mapaConsumo.nx, this.mapaConsumo.ny, THREE.RGBAFormat)
      // Filtro linear: a borda do buraco sai redonda, não em degraus de célula.
      t.magFilter = t.minFilter = THREE.LinearFilter
      t.needsUpdate = true
      this.texturaConsumo = t
      this.texturas.push(t)
    } else {
      this.mapaConsumo = null
      this.texturaConsumo = null
    }
    geometriaChapas(op.contexto).forEach((g, k) => {
      if (op.larguraPecaMm) g.scale(op.larguraPecaMm / 150, 1, 1)
      const acabamento = op.processo === 'eletrodo' ? matChapa.clone() : matChapa
      if (op.processo === 'eletrodo') acabamento.color.set(k === 0 ? '#53636c' : '#738087')
      if (this.texturaConsumo && (op.processo === 'eletrodo' || k === 0)) furarComMapa(acabamento, this.texturaConsumo, true)
      const m = new THREE.Mesh(g, acabamento)
      this.chapasColisao.push(m)
      m.receiveShadow = true
      m.castShadow = true
      if (dobra && k < 2) {
        // H57: cada chapa gira em torno da sua borda na junta (z = ∓ abertura/2), a ponta de fora sobe.
        const z0 = (k === 0 ? -1 : 1) * (op.contexto.aberturaMm / 2)
        const pivo = new THREE.Group()
        pivo.position.z = z0
        m.position.z = -z0
        pivo.add(m)
        this.relevo.add(pivo)
        this.pivosEmpeno.push({ pivo, sinal: k === 0 ? 1 : -1 })
      } else this.relevo.add(m)
    })
    // Sala da oficina (H47): piso, paredes e teto dão a referência de "para baixo" quando a peça tomba.
    if (op.subaquatico) {
      this.fundoMar = criarFundoMar(SALA.piso, { estrutura: op.subaquatico.estrutura })
      this.ambienteGrupo.add(this.fundoMar)
    } else this.montarSala()
    if (op.subaquatico) {
      // Sem oficina: a peça fica presa à estrutura no fundo do mar.
    } else if (op.oficinaTreino) this.ambienteGrupo.add(criarOficinaTreino(SALA.piso, { processo: op.processo }))
    else if (op.serralheria) {
      const oficina = criarSerralheria(SALA.piso)
      this.ambienteGrupo.add(oficina.grupo)
      this.texturas.push(...oficina.texturas)
    }
    // Suporte: coluna do piso até uma orelha na ponta da peça, presa por uma garra.
    const matSuporte = new THREE.MeshStandardMaterial({ color: '#2f5f8f', metalness: 0.5, roughness: 0.55 })
    this.coluna = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 1, 20), matSuporte)
    this.garra = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), matSuporte)
    this.sapata = new THREE.Mesh(new THREE.CylinderGeometry(45, 52, 12, 32), matSuporte)
    for (const m of [this.coluna, this.garra, this.sapata]) {
      m.castShadow = true
      m.receiveShadow = true
      this.ambienteGrupo.add(m)
    }
    const orelha = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 12), matChapa)
    orelha.castShadow = true
    orelha.position.set((op.larguraPecaMm ?? PECA.comprimentoMm) / 2 + 10, -3, 0)
    // H103: o tubo é seguro pela ponta, no eixo.
    if (this.curva) orelha.position.set(0, -this.curva.raio, PECA.larguraChapaMm + 9)
    this.orelha.copy(orelha.position)
    this.peca.add(orelha)

    this.montarMarcas()

    this.cores = material.aparencia.cordao.map((c) => new THREE.Color(c))
    const matCordao = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.36, side: THREE.DoubleSide })
    if (op.processo === 'eletrodo') {
      matCordao.roughness = 0.65
      matCordao.metalness = 0.58
      // H75: ondulações e oxidação do SMAW são só acabamento, sem mudar o volume avaliado.
      matCordao.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vSmaw;\n' + shader.vertexShader
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSmaw = position;')
        shader.fragmentShader = 'varying vec3 vSmaw;\n' + shader.fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat ondaSmaw = 0.5 + 0.5 * cos(vSmaw.x * 4.2 + abs(vSmaw.z) * 1.6);\ndiffuseColor.rgb *= vec3(0.64, 0.69, 0.72) * (0.7 + 0.3 * smoothstep(0.1, 0.9, ondaSmaw));')
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(normal + vec3(0.12 * sin(vSmaw.x * 4.2 + abs(vSmaw.z) * 1.6), 0.0, 0.025 * cos(vSmaw.x * 4.2)));')
      }
      matCordao.customProgramCacheKey = () => 'smaw-ondulado-v1'
    }
    if (this.texturaConsumo) furarComMapa(matCordao, this.texturaConsumo, false)
    this.cordao3d = new THREE.Mesh(new THREE.BufferGeometry(), matCordao)
    this.cordao3d.castShadow = true
    this.cordao3d.receiveShadow = true
    // Os buffers mudam a cada quadro e lugares sem uso ficam zerados: sem recorte por esfera envolvente.
    this.cordao3d.frustumCulled = false
    this.relevo.add(this.cordao3d)
    this.defeitos3d = new Defeitos3D(op.geometria, Math.ceil(PECA.comprimentoMm / MODELO.passoMm), MODELO.passoMm, juntaPeca, op.contexto, material.id, this.cores[2])
    this.relevo.add(this.defeitos3d.grupo)
    if (this.texturaConsumo) furarComMapa(this.defeitos3d.materialAvesso, this.texturaConsumo, false)

    // Escala real: com 3× o cordão do topo reto parecia três vezes mais alto do que o modelo calcula.
    const inicial = op.contexto.posicaoInicial
    if (inicial) {
      this.anguloGiro = THREE.MathUtils.degToRad(inicial.giroGraus)
      this.rolagemGraus = inicial.rolagemGraus
      // H103: no tubo o giro é a rotação no próprio eixo (na curvatura), não no plano.
      if (!this.curva) this.giro.rotation.y = -this.anguloGiro
    }
    this.definirExagero(EXAGERO_PADRAO)
    // H103: tudo o que tem relevo vira tubo (os rótulos deitados ficam rígidos, já ancorados).
    if (this.uCurva) curvarArvore(this.relevo, this.uCurva, this.curvados, new Set(this.rigidos.map((r) => r.suporte)))
  }

  /** Caixa da sala vista por dentro: piso de ladrilhos, paredes de blocos e teto com luminárias. */
  private montarSala(): void {
    const { piso } = SALA
    const oficinaPequena = this.op.oficinaTreino || this.op.serralheria
    const altura = oficinaPequena ? 1400 : SALA.altura
    const meia = oficinaPequena ? 700 : SALA.meia
    const tPiso = texturaPiso()
    tPiso.repeat.set((2 * meia) / 500, (2 * meia) / 500)
    const tParede = texturaParede(false)
    tParede.repeat.set((2 * meia) / 600, altura / 600)
    const tTeto = texturaParede(true)
    tTeto.repeat.set((2 * meia) / 800, (2 * meia) / 800)
    this.texturas.push(tPiso, tParede, tTeto)
    const parede = new THREE.MeshStandardMaterial({ map: tParede, roughness: 0.95, metalness: 0, side: THREE.BackSide })
    const teto = new THREE.MeshStandardMaterial({ map: tTeto, roughness: 0.9, metalness: 0, side: THREE.BackSide, emissive: '#ffffff', emissiveMap: tTeto, emissiveIntensity: 0.25 })
    const chao = new THREE.MeshStandardMaterial({ map: tPiso, roughness: 0.9, metalness: 0.05, side: THREE.BackSide })
    // Ordem das faces do BoxGeometry: +x, −x, +y (teto), −y (piso), +z, −z.
    const sala = new THREE.Mesh(new THREE.BoxGeometry(2 * meia, altura, 2 * meia), [parede, parede, teto, chao, parede, parede])
    sala.position.y = piso + altura / 2
    // A estação do treino fica junto à parede traseira, onde o painel é fixado.
    if (oficinaPequena) sala.position.z = 420
    sala.receiveShadow = true
    this.ambienteGrupo.add(sala)
  }

  /** Marcas da missão (INÍCIO/FIM, tolerância) e régua, como em cena.ts. */
  private montarMarcas(): void {
    const { geometria: geo, missao, regua, contexto } = this.op
    const junta = juntaDe(contexto)
    // Na superfície das chapas (no filete, subindo pelas paredes do canto), H46.
    const naSuperficie = (n: number) => pontoNaSuperficie(junta, contexto, n)
    const ponto = (s: number, n: number) => {
      const [nn, w] = naSuperficie(n)
      const p = geo.pontoEm(s, nn)
      return new THREE.Vector3(...paraMundo(p.x, p.y, w + SOBRE_CHAPA))
    }
    const deitar = (m: THREE.Mesh, s: number, n: number) => {
      m.position.copy(ponto(s, n))
      // Acompanha a inclinação da superfície (parede do filete).
      const [a0, b0] = naSuperficie(n - 0.5)
      const [a1, b1] = naSuperficie(n + 0.5)
      m.rotation.x = -Math.PI / 2 - Math.atan2(b1 - b0, a1 - a0)
      this.relevo.add(this.ancorar(m, m.position.x, m.position.z))
      this.texturas.push((m.material as THREE.MeshBasicMaterial).map!)
    }
    if (missao) {
      const pts: THREE.Vector3[] = []
      for (const s of [missao.inicioMm, missao.fimMm]) {
        for (const [n0, n1] of [[-14, -4], [4, 14]]) pts.push(ponto(s, n0), ponto(s, n1))
      }
      this.relevo.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffc440', transparent: true, opacity: 0.9, toneMapped: false })))
      if (regua) {
        deitar(rotuloDeitado('INÍCIO', 3, '#ffc440'), missao.inicioMm, -19)
        // H103: no tubo o fim da volta encontra o início; o FIM vai para o outro lado da junta.
        deitar(rotuloDeitado('FIM', 3, '#ffc440'), missao.fimMm, contexto.tubo ? 19 : -19)
      }
      if (missao.alinhamentoMm) {
        // Faixa de tolerância de alinhamento: tracejado dos dois lados da junta.
        for (const n of [-missao.alinhamentoMm, missao.alinhamentoMm]) {
          const linha: THREE.Vector3[] = []
          for (let s = missao.inicioMm; s < missao.fimMm; s += 1) linha.push(ponto(s, n))
          linha.push(ponto(missao.fimMm, n))
          const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(linha), new THREE.LineDashedMaterial({ color: '#ffc440', transparent: true, opacity: 0.75, dashSize: 1.1, gapSize: 1.3, toneMapped: false }))
          l.computeLineDistances()
          this.relevo.add(l)
        }
      }
    }
    if (regua) {
      const pts: THREE.Vector3[] = []
      for (let s = 0; s <= PECA.comprimentoMm; s += 10) {
        const grande = s % 50 === 0
        pts.push(ponto(s, -20), ponto(s, grande ? -25 : -22.5))
        if (grande) deitar(rotuloDeitado(String(s), 2.6, 'rgba(230,233,237,0.8)'), s, -29)
      }
      this.relevo.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#e6e9ed', transparent: true, opacity: 0.6, toneMapped: false })))
    }
  }

  /** Buffers do cordão (null antes do primeiro cordão); trocam quando o cordão é outro. */
  get malhaCordao(): MalhaCordaoViva | null {
    return this.viva
  }

  get geometriaCordao(): THREE.BufferGeometry {
    return this.cordao3d.geometry
  }

  /** Texturas criadas fora do palco que devem ser liberadas com ele. */
  guardarTexturas(...t: THREE.Texture[]): void {
    this.texturas.push(...t)
  }

  get exageroVertical(): number {
    return this.exagero
  }

  definirExagero(fator: number): void {
    // H103: no tubo o relevo não pode ser esticado em y (o tubo viraria oval).
    this.exagero = this.curva ? 1 : Math.min(EXAGERO_MAX, Math.max(EXAGERO_MIN, fator))
    this.relevo.scale.y = this.exagero
    this.posicionarAmbiente()
  }

  /** Giro da peça (radianos, positivo = horário na tela, como Vista.angulo). */
  definirGiro(angulo: number): void {
    if (this.curva && this.uCurva) {
      // H103: no tubo, girar é rodar o tubo no próprio eixo.
      this.curva.giro = angulo
      this.uCurva.uGiroTubo.value = angulo
      return
    }
    // Na tela, x aponta para a direita e z para baixo: horário na tela = −θ em torno de y.
    this.giro.rotation.y = -angulo
    if (angulo !== this.anguloGiro) {
      this.anguloGiro = angulo
      this.posicionarAmbiente()
    }
  }

  /**
   * Peça tombada (H47): gira no próprio pivô; ambiente e câmera permanecem independentes.
   */
  definirRolagem(graus: number): void {
    if (graus === this.rolagemGraus) return
    this.rolagemGraus = graus
    this.posicionarAmbiente()
  }

  /** Monta o suporte uma vez e mantém a articulação na orelha lateral. */
  private posicionarAmbiente(): void {
    const f = (this.rolagemGraus * Math.PI) / 180
    this.ambienteGrupo.rotation.x = 0
    this.giro.rotation.x = f
    this.cena.updateMatrixWorld(true)
    if (this.suportePronto) return
    this.suportePronto = true
    // Orelha nas coordenadas do mundo que tombou (y = para cima de verdade).
    const o = this.ambienteGrupo.worldToLocal(this.peca.localToWorld(this.temp.copy(this.orelha)))
    const base = SALA.piso
    const topo = Math.max(base + 20, o.y - 8)
    this.coluna.scale.y = topo - base
    this.coluna.position.set(o.x, (base + topo) / 2, o.z)
    this.garra.position.copy(o)
    // Pivô na fixação: a orelha permanece na garra em qualquer rotação.
    this.giro.position.copy(o)
    this.peca.position.copy(this.orelha).negate()
    this.cena.updateMatrixWorld(true)
    this.sapata.position.set(o.x, base + 6, o.z)
  }

  /** Teste conservador das chapas contra a coluna, a base e a garra fixas. */
  permitePosicao(giroGraus: number, rolagemGraus: number): boolean {
    const anterior = this.giro.rotation.clone()
    this.giro.rotation.set(THREE.MathUtils.degToRad(rolagemGraus), -THREE.MathUtils.degToRad(giroGraus), 0)
    this.cena.updateMatrixWorld(true)
    const obstaculos = [this.coluna, this.sapata, this.garra].map(m => new THREE.Box3().setFromObject(m).expandByScalar(-.3))
    let livre = true
    for (const m of this.chapasColisao) {
      m.geometry.computeBoundingBox()
      const caixa = new OBB().fromBox3(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld)
      if (obstaculos.some(b => caixa.intersectsBox3(b))) { livre = false; break }
    }
    this.giro.rotation.copy(anterior)
    this.cena.updateMatrixWorld(true)
    return livre
  }

  /**
   * Atualiza o cordão em buffers fixos: só as fatias que mudaram são
   * reescritas e enviadas à placa de vídeo. `s0Mm`–`s1Mm` limita a leitura
   * às fatias perto da tocha (execução); sem a janela, ou se ela não achar
   * a mudança, lê o cordão inteiro.
   */
  atualizarCordao(cordao: Cordao, s0Mm?: number, s1Mm?: number): boolean {
    const volume = cordao.volumeTotal()
    if (cordao === this.cordaoAtual && volume === this.volumeAtual) return false
    // Cordão novo: a janela não vale (o metal pode estar em qualquer lugar).
    const nova = cordao !== this.cordaoAtual || !this.viva || this.viva.nPosicoes !== cordao.nPosicoes
    if (nova) this.novaMalha(cordao)
    this.cordaoAtual = cordao
    this.volumeAtual = volume
    const viva = this.viva!
    let mudou = !nova && s0Mm !== undefined && s1Mm !== undefined ? viva.atualizar(cordao, cordao.indiceEm(s0Mm), cordao.indiceEm(s1Mm)) : false
    if (!mudou) mudou = viva.atualizar(cordao)
    const soltos = this.atualizarSoltos(cordao)
    if (mudou) this.enviarCordao()
    return mudou || soltos
  }

  /** H58: uma malha por cordão solto, apoiada na superfície das chapas. Devolve true se algo mudou. */
  private atualizarSoltos(cordao: Cordao): boolean {
    let mudou = false
    cordao.soltos.forEach((solto, k) => {
      let s = this.soltos3d[k]
      if (!s) {
        const viva = new MalhaCordaoViva(solto.nPosicoes, solto.passoMm, this.op.geometria, undefined, null, { junta: juntaDe(this.op.contexto), dimensoes: this.op.contexto })
        const malha = new THREE.Mesh(this.geometriaViva(viva), this.cordao3d.material)
        malha.castShadow = malha.receiveShadow = true
        if (this.curva) malha.castShadow = false
        malha.frustumCulled = false
        this.relevo.add(malha)
        s = this.soltos3d[k] = { viva, malha }
      }
      if (!s.viva.atualizar(solto)) return
      mudou = true
      const g = s.malha.geometry
      for (const nome of ['position', 'normal'] as const) {
        const atr = g.getAttribute(nome) as THREE.BufferAttribute
        atr.clearUpdateRanges()
        atr.addUpdateRange(3 * s.viva.inicioMudado, 3 * (s.viva.fimMudado - s.viva.inicioMudado))
        atr.needsUpdate = true
      }
      if (s.viva.indicesMudaram) {
        const idx = g.getIndex()!
        idx.clearUpdateRanges()
        idx.addUpdateRange(0, s.viva.nIndices)
        idx.needsUpdate = true
        g.setDrawRange(0, s.viva.nIndices)
        s.malha.visible = s.viva.nIndices > 0
      }
    })
    return mudou
  }

  /** Remove as malhas dos cordões soltos (peça nova). */
  private limparSoltos(): void {
    for (const s of this.soltos3d) {
      this.relevo.remove(s.malha)
      s.malha.geometry.dispose()
    }
    this.soltos3d = []
  }

  /** Geometria com os buffers fixos de uma malha viva e as cores das camadas. */
  private geometriaViva(viva: MalhaCordaoViva): THREE.BufferGeometry {
    const cor = new Float32Array(viva.raios.length * 3)
    const c = new THREE.Color()
    viva.raios.forEach((r, k) => this.corDaCamada(r, c).toArray(cor, 3 * k))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(viva.posicoes, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('normal', new THREE.BufferAttribute(viva.normais, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('color', new THREE.BufferAttribute(cor, 3))
    g.setIndex(new THREE.BufferAttribute(viva.indices, 1).setUsage(THREE.DynamicDrawUsage))
    g.setDrawRange(0, 0)
    return g
  }

  /**
   * Defeitos visíveis (defeitos.ts): mudam a forma do cordão e desenham gotas,
   * respingos, poros e faixas na chapa. null apaga. Não muda nada no modelo.
   */
  atualizarDefeitos(a: AnaliseDefeitos | null): void {
    const viva = this.viva
    if (viva && this.cordaoAtual) {
      viva.definirDefeitos(a)
      if (viva.atualizar(this.cordaoAtual)) this.enviarCordao()
    }
    // H101: a face dos cordoes fora da junta tambem afunda antes do furo.
    this.soltos3d.forEach((s, i) => s.viva.definirDefeitos(a?.consumosSoltos?.[i]?.analise ?? null))
    if (this.cordaoAtual) this.atualizarSoltos(this.cordaoAtual)
    this.defeitos3d.atualizar(a, viva)
    this.atualizarConsumo(a)
  }

  /**
   * H103: põe um objeto rígido no tubo. Com (x, z), fica fixo nesse ponto; sem,
   * segue a posição plana do próprio objeto a cada quadro (tocha, mira). Sem
   * tubo, devolve o próprio objeto. Adicione ao grupo o que esta função devolve.
   */
  ancorar(objeto: THREE.Object3D, x?: number, z?: number): THREE.Object3D {
    if (!this.curva) return objeto
    const suporte = new THREE.Group()
    suporte.matrixAutoUpdate = false
    suporte.add(objeto)
    this.rigidos.push({ suporte, objeto, x, z })
    this.posicionarRigido(this.rigidos[this.rigidos.length - 1])
    return suporte
  }

  private posicionarRigido(r: { suporte: THREE.Group; objeto: THREE.Object3D; x?: number; z?: number }): void {
    if (!this.curva) return
    poseNoTubo(this.curva, r.x ?? r.objeto.position.x, r.z ?? r.objeto.position.z, r.suporte.matrix)
    r.suporte.matrixWorldNeedsUpdate = true
  }

  /** H103: curva também objetos criados fora do palco (faixas de calor, brilho). */
  curvarTambem(objeto: THREE.Object3D): void {
    if (this.uCurva) curvarArvore(objeto, this.uCurva, this.curvados)
  }

  /** H101: recorta também outras malhas que cobrem o cordão (o brilho do metal quente). */
  furarTambem(mat: THREE.Material): void {
    if (this.texturaConsumo) furarComMapa(mat, this.texturaConsumo, false)
  }

  /** H101: buraco e borda queimada na chapa e no cordão, a partir da análise. */
  private atualizarConsumo(a: AnaliseDefeitos | null): void {
    const mapa = this.mapaConsumo
    if (!mapa || !this.texturaConsumo) return
    const viva = this.viva
    if (a && viva) preencherMapaConsumo(mapa, a.passoMm, a.furoMm, viva.centro, a.afundamento)
    else mapa.dados.fill(0)
    for (const solto of a?.consumosSoltos ?? []) {
      const d = solto.analise
      preencherMapaConsumo(mapa, d.passoMm, d.furoMm, solto.centro, d.afundamento, false)
    }
    this.texturaConsumo.needsUpdate = true
  }

  /** Empeno angular das chapas (graus, H57): no topo e no V, as pontas de fora sobem. */
  definirEmpeno(graus: number): void {
    // H103: o tubo não empena como as duas chapas soltas.
    if (this.curva) graus = 0
    const r = THREE.MathUtils.degToRad(graus)
    for (const { pivo, sinal } of this.pivosEmpeno) pivo.rotation.x = sinal * r
    this.defeitos3d.definirEmpeno(this.pivosEmpeno.length ? graus : 0)
  }

  /** Envia à placa de vídeo só a faixa de vértices que a malha viva reescreveu. */
  private enviarCordao(): void {
    const viva = this.viva!
    const g = this.cordao3d.geometry
    const a = viva.inicioMudado
    const b = viva.fimMudado
    for (const nome of ['position', 'normal'] as const) {
      const atr = g.getAttribute(nome) as THREE.BufferAttribute
      atr.clearUpdateRanges()
      atr.addUpdateRange(3 * a, 3 * (b - a))
      atr.needsUpdate = true
    }
    if (viva.indicesMudaram) {
      const idx = g.getIndex()!
      idx.clearUpdateRanges()
      idx.addUpdateRange(0, viva.nIndices)
      idx.needsUpdate = true
      g.setDrawRange(0, viva.nIndices)
      this.cordao3d.visible = viva.nIndices > 0
    }
  }

  /** Aloca os buffers do cordão (uma vez por cordão; as cores das camadas não mudam). */
  private novaMalha(cordao: Cordao): void {
    const viva = (this.viva = new MalhaCordaoViva(cordao.nPosicoes, cordao.passoMm, this.op.geometria, undefined, cordao.forma))
    // Peça nova: os defeitos e os cordões soltos da anterior somem.
    this.defeitos3d.atualizar(null, null)
    this.atualizarConsumo(null)
    this.limparSoltos()
    const g = this.geometriaViva(viva)
    this.cordao3d.geometry.dispose()
    this.cordao3d.geometry = g
    this.cordao3d.visible = false
  }

  /** H105: cores do cordão (da borda à crista), para a liga de brasagem ter a cor dela; vale para o que for desenhado depois. */
  definirCoresCordao(cores: readonly [string, string, string, string]): void {
    cores.forEach((c, i) => this.cores[i].set(c))
  }

  /** Altura da crista do cordão em s acima do plano da mira (mm, já com o exagero), para pôr a tocha em cima. */
  alturaEm(s: number): number {
    const c = this.cordaoAtual
    return c ? Math.max(0, cristaMm(c.secao(c.indiceEm(s)), juntaDe(this.op.contexto))) * this.exagero : 0
  }

  private corDaCamada(r: number, alvo: THREE.Color): THREE.Color {
    // LIMITES_CAMADAS vai da borda (1) à crista (0,14): cores[0] é a borda.
    const cores = this.cores
    if (r <= LIMITES_CAMADAS[3]) return alvo.copy(cores[3])
    for (let k = 0; k < 3; k++) {
      const [r0, r1] = [LIMITES_CAMADAS[k + 1], LIMITES_CAMADAS[k]]
      if (r <= r1) return alvo.copy(cores[k + 1]).lerp(cores[k], (r - r0) / (r1 - r0))
    }
    return alvo.copy(cores[0])
  }

  /** Tamanho em pixels CSS; devolve true se mudou. */
  ajustarTamanho(largura: number, altura: number): boolean {
    if (largura <= 0 || altura <= 0 || (largura === this.largura && altura === this.altura)) return false
    this.largura = largura
    this.altura = altura
    this.renderer.setSize(largura, altura, false)
    return true
  }

  desenhar(camera: THREE.Camera): void {
    for (const r of this.rigidos) this.posicionarRigido(r)
    if (this.fundoMar) (this.fundoMar.userData.tempo as { value: number }).value = performance.now() / 1000
    if (this.largura > 0) this.renderer.render(this.cena, camera)
  }

  destruir(): void {
    this.cena.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) {
        o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) m.dispose()
      }
    })
    for (const t of this.texturas) t.dispose()
    this.defeitos3d.destruir()
    this.ambiente.dispose()
    this.pmrem.dispose()
    this.sol.shadow.map?.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.elemento.remove()
  }
}
