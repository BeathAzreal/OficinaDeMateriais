import { INFO_TECNICA } from '../modelo/processo'
import * as THREE from 'three'
import { estiloArco } from './efeitos'

/*
 * Tocha, arco e poça da execução em 3D. EFEITOS PURAMENTE VISUAIS (H8, H43,
 * H45), como em efeitos.ts: nada daqui volta para o modelo. O clarão usa a
 * mesma regra do 2D (estiloArco), ligada ao desvio do equilíbrio (H10).
 * Coordenadas: as do grupo "peça" do palco (mm, y para cima, sem exagero).
 */

/** Degradê radial numa textura (clarão e poça). */
function texturaRadial(paradas: [number, string][]): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (const [f, cor] of paradas) g.addColorStop(f, cor)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/**
 * Desenho da DBCP (H48): o bico de contato fica a DBCP mm da superfície; o
 * arame sai do bico e o arco ocupa os últimos ARCO_MM até a poça. O
 * comprimento do arco não é calculado pelo modelo (é só desenho); a DBCP é.
 */
const BICO_MM = 15
const ARCO_MM = 3
/** Intensidade da luz do arco equilibrado (candela do Three, ajuste visual). */
const LUZ_ARCO = 700

export interface QuadroTocha {
  /** Ponto do arco no mundo (x, z), já com o vaivém visual (H39). */
  x: number
  /** Distância bico de contato–peça escolhida na bancada (mm, H48). */
  dbcpMm: number
  z: number
  /** Altura da superfície do cordão sob a tocha (mm, com exagero). */
  topoMm: number
  /** Arco aberto sobre a peça. */
  soldando: boolean
  /** Tocha fora da chapa: o modelo não deposita ali. */
  fora: boolean
  desvio: number
  /** Largura do cordão sob a tocha (mm), para o tamanho da poça. */
  larguraMm: number
  /** Direção da junta no mundo (radianos em torno de y), para alongar a poça. */
  rumo: number
  /** 0,5 no alumínio, que quase não brilha (aparencia.brilhoFraco). */
  intensidadePoca: number
  /** Índice de fusão sob a tocha (H33): poça mais longa e mais alta com mais calor (H56). */
  calorPoca: number
  /** Sentido do avanço ao longo da junta (+1 / −1): a poça fica para trás. */
  sentido: number
  /** Gravidade no plano da chapa (mundo x e z, H47): a poça pende para o lado de baixo. */
  gravidadeX: number
  gravidadeZ: number
  /** Giro da peça (Vista.angulo): o pescoço compensa para ficar fixo na tela. */
  angulo: number
  /**
   * Inclinação da tocha ao longo da junta (radianos, H38): positivo = topo
   * da tocha para trás de +s. Vem da técnica e do sentido de avanço.
   */
  inclinacao: number
}

/** Quanto a tocha tomba na técnica empurrando/puxando: o ângulo de avanço do modelo (H38). */
export const INCLINACAO_TECNICA_RAD = (INFO_TECNICA.empurrando.anguloAvancoGraus * Math.PI) / 180

export class Tocha3D {
  readonly grupo = new THREE.Group()
  readonly texturas: THREE.Texture[] = []
  /** Gira em torno da ponta do arame (o arco): a técnica tomba a tocha (H38). */
  private readonly inclinacao = new THREE.Group()
  private readonly corpo = new THREE.Group()
  private readonly pescoco = new THREE.Group()
  private readonly arame: THREE.Mesh
  private readonly clarao: THREE.Sprite
  private readonly matClarao: THREE.SpriteMaterial
  private readonly luz: THREE.PointLight
  private readonly poca: THREE.Mesh
  private readonly matPoca: THREE.MeshBasicMaterial
  /** Metal líquido em relevo sob o arco (H56). */
  private readonly pocaVolume: THREE.Mesh
  private readonly matPocaVolume: THREE.MeshBasicMaterial
  private readonly matBocal: THREE.MeshStandardMaterial
  private readonly corBocal = new THREE.Color('#b9915a')
  private readonly corFora = new THREE.Color('#d0473a')
  private dbcpAtual = BICO_MM

  constructor() {
    // Bocal aberto (vê-se o arco por dentro olhando de cima), bico de contato, cano reto no eixo da tocha
    // e, no alto, a curva do pescoço e o punho indo para longe da câmera.
    this.matBocal = new THREE.MeshStandardMaterial({ color: this.corBocal, metalness: 0.9, roughness: 0.32, side: THREE.DoubleSide })
    const bocal = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 5, 18, 32, 1, true), this.matBocal)
    bocal.position.y = 9
    const matCobre = new THREE.MeshStandardMaterial({ color: '#c77b43', metalness: 0.9, roughness: 0.35 })
    const bico = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.1, 6, 12), matCobre)
    bico.position.y = 4
    // Cano reto no eixo da tocha: é ele que mostra a inclinação da técnica (H38), mesmo vista de cima.
    const matCano = new THREE.MeshStandardMaterial({ color: '#3a3f46', metalness: 0.6, roughness: 0.45 })
    const cano = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.2, 34, 20), matCano)
    cano.position.y = 18 + 17
    const anel = new THREE.Mesh(new THREE.TorusGeometry(5.6, 1.1, 10, 28), matCobre)
    anel.rotation.x = Math.PI / 2
    anel.position.y = 18.5
    // Pescoço curvado e punho semitransparentes: vistos de cima, não escondem a junta à frente da tocha.
    const matCorpo = new THREE.MeshStandardMaterial({ color: '#2c3036', metalness: 0.4, roughness: 0.6, transparent: true, opacity: 0.5, depthWrite: false })
    const curva = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 22, 16), matCorpo)
    // Sai do topo do cano inclinado 45°; o grupo aponta para cima e à esquerda NA TELA.
    curva.position.set(0, 52 + 7.8, -7.8)
    curva.rotation.x = -Math.PI / 4
    const punho = new THREE.Mesh(new THREE.CylinderGeometry(7, 6, 46, 18), matCorpo)
    punho.position.set(0, 52 + 15.6 + 6, -15.6 - 21)
    punho.rotation.x = -Math.PI / 2.6
    this.pescoco.add(curva, punho)
    this.corpo.add(bocal, bico, cano, anel, this.pescoco)
    for (const m of [bocal, bico, cano, curva, punho]) m.castShadow = true
    // Bocal acima do arco; o arame vai do bico até a superfície. Tudo gira em torno da ponta do arame.
    this.corpo.position.y = BICO_MM - 1
    this.arame = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1, 8), new THREE.MeshStandardMaterial({ color: '#d9dde2', metalness: 1, roughness: 0.25 }))
    this.posicionarBico(BICO_MM)
    this.inclinacao.add(this.corpo, this.arame)
    this.grupo.add(this.inclinacao)

    const tClarao = texturaRadial([[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(215,232,255,0.9)'], [0.45, 'rgba(130,175,255,0.28)'], [1, 'rgba(90,140,255,0)']])
    this.matClarao = new THREE.SpriteMaterial({ map: tClarao, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, toneMapped: false })
    this.clarao = new THREE.Sprite(this.matClarao)
    this.clarao.renderOrder = 20
    this.grupo.add(this.clarao)
    this.luz = new THREE.PointLight('#cfe6ff', 0, 160, 2)
    this.grupo.add(this.luz)

    const tPoca = texturaRadial([[0, 'rgba(255,250,225,0.95)'], [0.5, 'rgba(255,190,80,0.65)'], [1, 'rgba(255,120,30,0)']])
    this.matPoca = new THREE.MeshBasicMaterial({ map: tPoca, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })
    this.poca = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.matPoca)
    this.poca.rotation.order = 'YXZ'
    this.poca.renderOrder = 5
    this.grupo.add(this.poca)
    this.matPocaVolume = new THREE.MeshBasicMaterial({ color: '#ffd08c', blending: THREE.AdditiveBlending, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })
    this.pocaVolume = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.matPocaVolume)
    this.pocaVolume.renderOrder = 6
    this.grupo.add(this.pocaVolume)
    this.texturas.push(tClarao, tPoca)
    this.grupo.visible = false
  }

  /** Bico de contato a `dbcp` mm da superfície; arame do bico até o arco. */
  private posicionarBico(dbcp: number): void {
    this.corpo.position.y = dbcp - 1
    this.arame.scale.y = Math.max(0.5, dbcp - ARCO_MM)
    this.arame.position.y = ARCO_MM + this.arame.scale.y / 2
  }

  esconder(): void {
    this.grupo.visible = false
    this.luz.intensity = 0
  }

  atualizar(q: QuadroTocha): void {
    this.grupo.visible = true
    this.grupo.position.set(q.x, 0, q.z)
    // A ponta do arame fica na superfície do cordão; a técnica tomba a tocha em torno dela.
    this.inclinacao.position.y = q.topoMm
    this.inclinacao.rotation.z = q.inclinacao
    if (q.dbcpMm !== this.dbcpAtual) {
      this.dbcpAtual = q.dbcpMm
      this.posicionarBico(q.dbcpMm)
    }
    // −z do grupo = para cima na tela; +45° em y leva para cima e à esquerda; +giro desfaz o giro da peça.
    this.pescoco.rotation.y = Math.PI / 4 + q.angulo
    this.arame.visible = !q.fora
    this.matBocal.color.copy(q.fora ? this.corFora : this.corBocal)

    this.clarao.visible = q.soldando
    this.poca.visible = this.pocaVolume.visible = q.soldando
    if (!q.soldando) {
      this.luz.intensity = 0
      return
    }
    const e = estiloArco(q.desvio)
    const raio = e.raioMm
    this.clarao.position.set(e.dxMm, q.topoMm + 1, e.dyMm)
    this.clarao.scale.set(2 * raio, 2 * raio, 1)
    this.matClarao.opacity = e.alfa
    this.luz.position.set(e.dxMm, q.topoMm + 3, e.dyMm)
    this.luz.intensity = LUZ_ARCO * e.tamanho * e.alfa

    // Poça viva (H56): mais longa com mais calor, para trás do avanço e pendendo para o lado da gravidade.
    const meia = Math.max(1.5, q.larguraMm / 2)
    const calor = Math.min(2, Math.max(0, q.calorPoca))
    const comprimento = meia * (1.3 + 0.45 * calor)
    const atras = -(q.sentido || 1) * 0.35 * comprimento
    const dx = atras * Math.cos(q.rumo) + 0.35 * meia * q.gravidadeX
    const dz = atras * Math.sin(q.rumo) + 0.35 * meia * q.gravidadeZ
    this.poca.rotation.set(-Math.PI / 2, -q.rumo, 0)
    this.poca.scale.set(2 * comprimento, 2 * meia, 1)
    this.poca.position.set(dx, q.topoMm + 0.15, dz)
    this.matPoca.opacity = q.intensidadePoca
    this.pocaVolume.rotation.set(0, -q.rumo, 0)
    this.pocaVolume.scale.set(0.8 * comprimento, 0.25 + 0.2 * calor, 0.8 * meia)
    this.pocaVolume.position.set(dx, q.topoMm - 0.05, dz)
    this.matPocaVolume.opacity = 0.5 * q.intensidadePoca
  }
}
