import * as THREE from 'three'
import type { GeometriaJunta } from '../modelo/junta'
import type { MalhaCordaoViva } from './cordaoVivo'
import { alcanceHalo, brilhoRGBA, extraTintaTermica, FAISCAS_POR_S, FUMACA_POR_S, recencia, TAU_HALO_MS } from './efeitos'
import { INFO_JUNTA, pontoAoLadoDe, type DimensoesJunta, type TipoJunta } from '../modelo/juntas'
import { PECA } from '../modelo/parametros'

/*
 * Faíscas, fumaça, brilho do metal quente, halo de calor e tinta térmica da
 * execução em 3D. EFEITOS PURAMENTE VISUAIS (H8, H43), com as mesmas regras
 * de efeitos.ts (taxa de faíscas, τ do brilho, alcance do halo, faixa da
 * tinta). Nada daqui é campo de temperatura nem volta para o modelo.
 * Tudo é alocado uma vez; a cada quadro só se reescrevem os buffers.
 */

export interface LimitesParticulas {
  faiscas: number
  fumaca: number
}

/** Bolinha de borda suave para as partículas. */
function texturaPonto(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Um conjunto de partículas num anel de tamanho fixo (a mais antiga dá lugar à nova). */
class Nuvem {
  readonly pontos: THREE.Points
  readonly pos: Float32Array
  readonly cor: Float32Array
  readonly vel: Float32Array
  readonly vida: Float32Array
  readonly duracao: Float32Array
  private proxima = 0

  constructor(
    readonly max: number,
    material: THREE.PointsMaterial,
  ) {
    this.pos = new Float32Array(3 * max)
    this.cor = new Float32Array(4 * max)
    this.vel = new Float32Array(3 * max)
    this.vida = new Float32Array(max)
    // Começam "mortas".
    this.duracao = new Float32Array(max)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute('color', new THREE.BufferAttribute(this.cor, 4).setUsage(THREE.DynamicDrawUsage))
    this.pontos = new THREE.Points(g, material)
    this.pontos.frustumCulled = false
  }

  /** Índice livre (ou o mais antigo). */
  nova(): number {
    const k = this.proxima
    this.proxima = (this.proxima + 1) % this.max
    return k
  }

  enviar(): void {
    const g = this.pontos.geometry
    g.getAttribute('position').needsUpdate = true
    g.getAttribute('color').needsUpdate = true
  }
}

export class Calor3D {
  /** Vai no grupo "peça" (gira com a chapa; sem exagero). */
  readonly particulas = new THREE.Group()
  /** Vão no grupo "relevo" (mesma escala do cordão). */
  readonly relevo = new THREE.Group()
  readonly texturas: THREE.Texture[] = []
  private readonly faiscas: Nuvem
  private readonly fumaca: Nuvem
  /** Gotas de metal que caem da poça na sobrecabeça (H50). */
  private readonly gotas: Nuvem
  /** Corpo das gotas que caem: esferas de metal líquido (o brilho fica nos pontos). */
  private readonly gotasCorpo: THREE.InstancedMesh
  private readonly matrizGota = new THREE.Matrix4()
  private readonly corGota = new THREE.Color()
  private acumGota = 0
  private acumVaza = 0
  private acumFaisca = 0
  private acumFumaca = 0
  private tAnterior: number | null = null

  // Brilho do metal quente: malha sobreposta ao cordão, com os mesmos vértices e uma cor própria.
  private readonly brilho: THREE.Mesh
  private corBrilho: Float32Array | null = null
  private geoCordao: THREE.BufferGeometry | null = null
  private aceso: Uint8Array | null = null
  private readonly rgba = [0, 0, 0, 0]

  // Halo na chapa e tinta térmica: faixas com 3 (halo) ou 2 (tinta) vértices por fatia.
  private readonly halo: THREE.Mesh
  private readonly tintas: THREE.Mesh[] = []
  private readonly n: number
  private haloAceso: Uint8Array
  /** Ponto da junta e normal (na chapa) no meio de cada fatia: pontoEm(s, n) = ponto + n·normal. */
  private readonly baseX: Float64Array
  private readonly baseY: Float64Array
  private readonly normX: Float64Array
  private readonly normY: Float64Array

  /** Materiais que cobrem o cordão e a chapa perto dele (o buraco do H101 tem de recortá-los também). */
  get materiaisSobreACapa(): THREE.Material[] {
    return [this.brilho.material as THREE.Material, this.halo.material as THREE.Material]
  }

  constructor(
    geo: GeometriaJunta,
    nPosicoes: number,
    private readonly passoMm: number,
    limites: LimitesParticulas,
    readonly comTinta: boolean,
    private readonly junta: TipoJunta = 'topo',
    private readonly dim: DimensoesJunta = { espessuraMm: 3, aberturaMm: 1 },
  ) {
    this.n = nPosicoes
    this.haloAceso = new Uint8Array(nPosicoes)
    this.baseX = new Float64Array(nPosicoes)
    this.baseY = new Float64Array(nPosicoes)
    this.normX = new Float64Array(nPosicoes)
    this.normY = new Float64Array(nPosicoes)
    for (let i = 0; i < nPosicoes; i++) {
      const s = (i + 0.5) * passoMm
      const a = geo.pontoEm(s, 0)
      const b = geo.pontoEm(s, 1)
      this.baseX[i] = a.x
      this.baseY[i] = a.y
      this.normX[i] = b.x - a.x
      this.normY[i] = b.y - a.y
    }
    const ponto = texturaPonto()
    this.texturas.push(ponto)
    this.faiscas = new Nuvem(
      limites.faiscas,
      new THREE.PointsMaterial({ size: 3.2, map: ponto, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    )
    this.fumaca = new Nuvem(limites.fumaca, new THREE.PointsMaterial({ size: 14, map: ponto, vertexColors: true, transparent: true, depthWrite: false }))
    // Mistura normal (não aditiva): a gota é metal opaco, não luz; aparece laranja sobre qualquer fundo.
    this.gotas = new Nuvem(40, new THREE.PointsMaterial({ size: 9, map: ponto, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }))
    this.gotasCorpo = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), this.gotas.max)
    this.gotasCorpo.count = 0
    this.gotasCorpo.frustumCulled = false
    this.particulas.add(this.fumaca.pontos, this.faiscas.pontos, this.gotas.pontos, this.gotasCorpo)

    this.brilho = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, depthFunc: THREE.LessEqualDepth, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    )
    this.brilho.frustumCulled = false
    this.brilho.visible = false
    this.relevo.add(this.brilho)

    this.halo = this.faixa(3, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }), 0.02)
    if (comTinta) {
      // Mesmas cores e opacidades da vista de cima (cena.ts): faixa externa azulada, interna dourada.
      // Uma faixa de cada lado do cordão (no filete, cada uma na sua parede).
      this.tintas.push(
        this.faixa(4, new THREE.MeshBasicMaterial({ color: '#5a60aa', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }), 0.008, 1),
        this.faixa(4, new THREE.MeshBasicMaterial({ color: '#c9a050', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }), 0.012, 1),
      )
    }
  }

  /**
   * Faixa ao longo da junta com `largura` vértices por fatia (índices fixos,
   * posições a cada quadro). `pular`: coluna de quadriláteros que não existe
   * (o vão entre as faixas dos dois lados do cordão).
   */
  private faixa(largura: number, material: THREE.Material, alturaMm: number, pular = -1): THREE.Mesh {
    const n = this.n
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * largura * n), 3).setUsage(THREE.DynamicDrawUsage))
    if (largura === 3) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(3 * 3 * n), 3).setUsage(THREE.DynamicDrawUsage))
    const idx = new Uint32Array((n - 1) * (largura - 1) * 6)
    let q = 0
    for (let i = 0; i + 1 < n; i++) {
      for (let k = 0; k + 1 < largura; k++) {
        if (k === pular) continue
        const a = i * largura + k
        const b = a + 1
        const c = a + largura
        const d = c + 1
        // Com s → +x e n → +z, (a, b, c) aponta para cima.
        idx.set([a, b, c, b, d, c], q)
        q += 6
      }
    }
    g.setIndex(new THREE.BufferAttribute(idx.subarray(0, q), 1))
    const m = new THREE.Mesh(g, material)
    m.frustumCulled = false
    m.position.y = alturaMm
    m.renderOrder = largura === 3 ? 3 : 2
    this.relevo.add(m)
    return m
  }

  /** Vértice v no meio da fatia i, no ponto (n, w) do corte (mundo: x = X − 75, y = w, z = Y; sem alocar). */
  private escreverPonto(arr: Float32Array, v: number, i: number, n: number, w = 0): void {
    arr[3 * v] = this.baseX[i] + n * this.normX[i] - PECA.comprimentoMm / 2
    arr[3 * v + 1] = w
    arr[3 * v + 2] = this.baseY[i] + n * this.normY[i]
  }

  /** Ponto na chapa ao lado do cordão da fatia i (H46), escrito no vértice v. */
  private escreverAoLado(arr: Float32Array, v: number, i: number, viva: MalhaCordaoViva, lado: -1 | 1, distancia: number): void {
    const [n, w] = pontoAoLadoDe(this.junta, this.dim, viva.largura[i], viva.centro[i], viva.perna1[i], viva.perna2[i], lado, distancia)
    this.escreverPonto(arr, v, i, n, w)
  }

  private get filete(): boolean {
    return INFO_JUNTA[this.junta].familia === 'filete'
  }

  /**
   * Faíscas e fumaça (H43). `emissor`: ponto do arco (coordenadas da peça)
   * ou null com o arco fechado; `taxa` vem de taxaFaiscas (efeitos.ts).
   */
  atualizarParticulas(agoraMs: number, emissor: { x: number; y: number; z: number } | null, taxa: number, g: { x: number; y: number; z: number } = { x: 0, y: -1, z: 0 }, gotejamento = 0, avesso: { x: number; y: number; z: number; vazamento: number } | null = null): void {
    const dt = this.tAnterior === null ? 0 : Math.min(0.05, (agoraMs - this.tAnterior) / 1000)
    this.tAnterior = agoraMs
    const F = this.faiscas
    const S = this.fumaca
    if (emissor && dt > 0) {
      this.acumFaisca += dt * FAISCAS_POR_S * taxa
      this.acumFumaca += dt * FUMACA_POR_S
      while (this.acumFaisca >= 1) {
        this.acumFaisca--
        const k = F.nova()
        const ang = Math.random() * Math.PI * 2
        // Mesma velocidade no plano da face do 2D (25–95 mm/s), mais um salto para fora da face.
        const v = 25 + Math.random() * 70
        F.pos[3 * k] = emissor.x
        F.pos[3 * k + 1] = emissor.y
        F.pos[3 * k + 2] = emissor.z
        F.vel[3 * k] = Math.cos(ang) * v
        F.vel[3 * k + 1] = 20 + Math.random() * 60
        F.vel[3 * k + 2] = Math.sin(ang) * v
        F.vida[k] = 0
        F.duracao[k] = 0.15 + Math.random() * 0.35
      }
      while (this.acumFumaca >= 1) {
        this.acumFumaca--
        const k = S.nova()
        S.pos[3 * k] = emissor.x + (Math.random() - 0.5) * 6
        S.pos[3 * k + 1] = emissor.y + 2
        S.pos[3 * k + 2] = emissor.z + (Math.random() - 0.5) * 6
        // A fumaça sobe: contra a gravidade (H47), seja qual for a posição da peça.
        const sobe = 12 + Math.random() * 14
        S.vel[3 * k] = (Math.random() - 0.5) * 10 - g.x * sobe
        S.vel[3 * k + 1] = (Math.random() - 0.5) * 10 - g.y * sobe
        S.vel[3 * k + 2] = (Math.random() - 0.5) * 10 - g.z * sobe
        S.vida[k] = 0
        S.duracao[k] = 1.6 + Math.random() * 1.4
      }
    }
    // Gotas que se soltam da poça (H50): caem pela gravidade, sem arrasto, e apagam esfriando.
    const G = this.gotas
    if (emissor && dt > 0 && gotejamento > 0) {
      this.acumGota += dt * 4 * gotejamento
      while (this.acumGota >= 1) {
        this.acumGota--
        const k = G.nova()
        G.pos[3 * k] = emissor.x + (Math.random() - 0.5) * 2
        G.pos[3 * k + 1] = emissor.y
        G.pos[3 * k + 2] = emissor.z + (Math.random() - 0.5) * 2
        for (let e = 0; e < 3; e++) G.vel[3 * k + e] = 0
        G.vida[k] = 0
        G.duracao[k] = 1.1 + Math.random() * 0.4
      }
    }
    // H101: metal vazando pelo avesso da chapa: as gotas se soltam por baixo e caem.
    if (avesso && dt > 0 && avesso.vazamento > 0) {
      this.acumVaza += dt * 5 * avesso.vazamento
      while (this.acumVaza >= 1) {
        this.acumVaza--
        const k = G.nova()
        G.pos[3 * k] = avesso.x + (Math.random() - 0.5) * 3
        G.pos[3 * k + 1] = avesso.y
        G.pos[3 * k + 2] = avesso.z + (Math.random() - 0.5) * 2
        for (let e = 0; e < 3; e++) G.vel[3 * k + e] = 0
        G.vida[k] = 0
        G.duracao[k] = 1.1 + Math.random() * 0.4
      }
    }
    for (let k = 0; k < G.max; k++) {
      G.vida[k] += dt
      const resto = G.duracao[k] > 0 ? Math.max(0, 1 - G.vida[k] / G.duracao[k]) : 0
      if (resto > 0) {
        G.vel[3 * k] += 900 * g.x * dt
        G.vel[3 * k + 1] += 900 * g.y * dt
        G.vel[3 * k + 2] += 900 * g.z * dt
        for (let e = 0; e < 3; e++) G.pos[3 * k + e] += G.vel[3 * k + e] * dt
      }
      // Metal líquido: amarelo-alaranjado ao se soltar, vermelho escuro esfriando na queda.
      G.cor[4 * k] = 1
      G.cor[4 * k + 1] = (70 + 150 * resto) / 255
      G.cor[4 * k + 2] = (20 + 70 * resto) / 255
      G.cor[4 * k + 3] = resto > 0 ? Math.min(1, 0.45 + resto) : 0
    }
    G.enviar()
    let vivas = 0
    for (let k = 0; k < G.max; k++) {
      const resto = G.duracao[k] > 0 ? Math.max(0, 1 - G.vida[k] / G.duracao[k]) : 0
      if (resto <= 0) continue
      // Gota de ~2 mm, um pouco alongada na queda.
      const r = 0.9 + 0.3 * resto
      this.matrizGota.makeScale(r, r, r)
      this.matrizGota.setPosition(G.pos[3 * k], G.pos[3 * k + 1], G.pos[3 * k + 2])
      this.gotasCorpo.setMatrixAt(vivas, this.matrizGota)
      this.gotasCorpo.setColorAt(vivas, this.corGota.setRGB(1, (60 + 160 * resto) / 255, (15 + 40 * resto) / 255))
      vivas++
    }
    this.gotasCorpo.count = vivas
    this.gotasCorpo.instanceMatrix.needsUpdate = true
    if (this.gotasCorpo.instanceColor) this.gotasCorpo.instanceColor.needsUpdate = true
    for (let k = 0; k < F.max; k++) {
      F.vida[k] += dt
      const resto = F.duracao[k] > 0 ? Math.max(0, 1 - F.vida[k] / F.duracao[k]) : 0
      if (resto > 0) {
        // Arrasto como no 2D, mais a gravidade da posição (H47); com a face para cima, quica de leve na chapa.
        const amort = 1 - 2.5 * dt
        F.vel[3 * k] = F.vel[3 * k] * amort + 400 * g.x * dt
        F.vel[3 * k + 1] += 400 * g.y * dt
        F.vel[3 * k + 2] = F.vel[3 * k + 2] * amort + 400 * g.z * dt
        for (let e = 0; e < 3; e++) F.pos[3 * k + e] += F.vel[3 * k + e] * dt
        if (g.y < -0.5 && F.pos[3 * k + 1] < 0) {
          F.pos[3 * k + 1] = 0
          F.vel[3 * k + 1] *= -0.3
        }
      }
      F.cor[4 * k] = 1
      F.cor[4 * k + 1] = (150 + 90 * resto) / 255
      F.cor[4 * k + 2] = (60 + 120 * resto) / 255
      F.cor[4 * k + 3] = resto
    }
    for (let k = 0; k < S.max; k++) {
      S.vida[k] += dt
      const resto = S.duracao[k] > 0 ? Math.max(0, 1 - S.vida[k] / S.duracao[k]) : 0
      if (resto > 0) for (let e = 0; e < 3; e++) S.pos[3 * k + e] += S.vel[3 * k + e] * dt
      S.cor[4 * k] = 190 / 255
      S.cor[4 * k + 1] = 195 / 255
      S.cor[4 * k + 2] = 200 / 255
      S.cor[4 * k + 3] = 0.12 * resto
    }
    F.enviar()
    S.enviar()
  }

  /**
   * Brilho do metal recém-depositado (τ = 1,2 s) e halo na chapa em volta
   * (mais largo com o aquecimento, H32), como desenharBrilho e
   * desenharHaloCalor. `intensidade` < 1 no alumínio.
   */
  atualizarCalor(agoraMs: number, aquecimento: number, viva: MalhaCordaoViva | null, geoCordao: THREE.BufferGeometry, intensidadeBrilho: number, intensidadeHalo: number): void {
    if (!viva) return
    this.ligarBrilho(viva, geoCordao)
    const cor = this.corBrilho!
    const aceso = this.aceso!
    const V = viva.V
    let menor = Infinity
    let maior = -Infinity
    for (let i = 0; i < this.n; i++) {
      const r = viva.visivel[i] && viva.largura[i] >= 0.5 ? recencia(agoraMs, viva.tUltimo[i]) : 0
      const ligado = r >= 0.03
      if (!ligado && !aceso[i]) continue
      aceso[i] = ligado ? 1 : 0
      if (i < menor) menor = i
      if (i > maior) maior = i
      brilhoRGBA(r, 0.85 * intensidadeBrilho, this.rgba)
      // Mistura aditiva: a opacidade do 2D vira intensidade (cor × alfa).
      const a = ligado ? this.rgba[3] : 0
      // Só o meio do cordão brilha: largura (0,55 + 0,35·r) da total, com borda suave.
      const limite = 0.55 + 0.35 * r
      for (let v = i * V; v < (i + 1) * V; v++) {
        const f = Math.min(1, Math.max(0, (limite - viva.raios[v]) / 0.15)) * a
        cor[3 * v] = (this.rgba[0] / 255) * f
        cor[3 * v + 1] = (this.rgba[1] / 255) * f
        cor[3 * v + 2] = (this.rgba[2] / 255) * f
      }
    }
    const atr = this.brilho.geometry.getAttribute('color') as THREE.BufferAttribute
    if (menor <= maior) {
      atr.clearUpdateRanges()
      atr.addUpdateRange(3 * menor * V, 3 * (maior - menor + 1) * V)
      atr.needsUpdate = true
    }
    this.brilho.visible = true

    // Halo: centro alaranjado, bordas apagadas, até alcance·r além da borda do cordão.
    const pos = this.halo.geometry.getAttribute('position') as THREE.BufferAttribute
    const corHalo = this.halo.geometry.getAttribute('color') as THREE.BufferAttribute
    const P = pos.array as Float32Array
    const C = corHalo.array as Float32Array
    const alcance = alcanceHalo(aquecimento)
    const ativo = aquecimento > 0.02
    let mudouHalo = false
    for (let i = 0; i < this.n; i++) {
      const r = ativo && viva.largura[i] >= 0.5 ? recencia(agoraMs, viva.tUltimo[i], TAU_HALO_MS) : 0
      const ligado = r >= 0.04
      if (!ligado && !this.haloAceso[i]) continue
      this.haloAceso[i] = ligado ? 1 : 0
      mudouHalo = true
      const yc = viva.centro[i]
      if (!ligado) {
        // Apagado: os três pontos no centro (faixa sem área).
        for (let k = 0; k < 3; k++) this.escreverPonto(P, 3 * i + k, i, this.filete ? 0 : yc)
      } else {
        // Das bordas do cordão até alcance·r para fora, pela chapa; o meio fica embaixo do cordão (a raiz, no filete).
        this.escreverAoLado(P, 3 * i, i, viva, -1, alcance * r)
        this.escreverPonto(P, 3 * i + 1, i, this.filete ? 0 : yc)
        this.escreverAoLado(P, 3 * i + 2, i, viva, 1, alcance * r)
      }
      // As duas camadas do 2D somam 0,15·r no meio; o degradê até a borda pede um pouco mais.
      const a = ligado ? 0.15 * r * intensidadeHalo * 1.6 : 0
      C[9 * i + 3] = a
      C[9 * i + 4] = (110 / 255) * a
      C[9 * i + 5] = (40 / 255) * a
    }
    if (mudouHalo) {
      pos.needsUpdate = true
      corHalo.needsUpdate = true
    }
  }

  /** Faixa de coloração térmica do inox (H8), como desenharTintaTermica. Chamar quando o cordão mudar. */
  atualizarTinta(aportes: ArrayLike<number>, necessario: number, viva: MalhaCordaoViva | null): void {
    if (!this.comTinta || !viva) return
    for (const [t, fator] of [[this.tintas[0], 1], [this.tintas[1], 0.55]] as const) {
      const atr = t.geometry.getAttribute('position') as THREE.BufferAttribute
      const P = atr.array as Float32Array
      for (let i = 0; i < this.n; i++) {
        // Da borda do cordão até a largura extra, de cada lado: [fora −, borda −, borda +, fora +].
        const extra = viva.largura[i] >= 1 ? extraTintaTermica(aportes, i, this.passoMm, necessario) * fator : 0
        this.escreverAoLado(P, 4 * i, i, viva, -1, extra)
        this.escreverAoLado(P, 4 * i + 1, i, viva, -1, 0)
        this.escreverAoLado(P, 4 * i + 2, i, viva, 1, 0)
        this.escreverAoLado(P, 4 * i + 3, i, viva, 1, extra)
      }
      atr.needsUpdate = true
    }
  }

  /** A malha de brilho usa os mesmos buffers do cordão; refeita quando o cordão é outro. */
  private ligarBrilho(viva: MalhaCordaoViva, geoCordao: THREE.BufferGeometry): void {
    if (geoCordao === this.geoCordao) return
    this.geoCordao = geoCordao
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', geoCordao.getAttribute('position'))
    g.setIndex(geoCordao.getIndex())
    this.corBrilho = new Float32Array(viva.raios.length * 3)
    g.setAttribute('color', new THREE.BufferAttribute(this.corBrilho, 3).setUsage(THREE.DynamicDrawUsage))
    // O desenho acompanha o do cordão (mesmo drawRange, atualizado pelo palco).
    g.drawRange = geoCordao.drawRange
    this.aceso = new Uint8Array(this.n)
    // Só a cor é desta malha; posição e índices continuam do cordão (liberados por ele).
    this.brilho.geometry.dispose()
    this.brilho.geometry = g
  }
}
