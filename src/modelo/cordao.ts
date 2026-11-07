import { secaoNaJunta, type DimensoesJunta, type TipoJunta } from './juntas'
import { Percurso } from './percurso'
import { MODELO, PECA } from './parametros'

/**
 * Hipótese H3: a seção transversal do cordão é um "domo" parabólico com
 * altura = razão × largura. A área de um segmento parabólico é
 * (2/3)·largura·altura, logo área = (2/3)·razão·largura².
 * A razão vem da tensão (H9); sem informação, usa a de referência.
 */
export function larguraPelaArea(areaMm2: number, razao: number = MODELO.razaoAlturaLargura): number {
  return areaMm2 > 0 ? Math.sqrt(areaMm2 / ((2 / 3) * razao)) : 0
}

/** H44: quanto a largura oscila com o arco totalmente instável, e o viés curto/longo. */
const AMPLITUDE_INSTABILIDADE = 0.28
const VIES_INSTABILIDADE = 0.1

/**
 * Padrão fixo e suave entre −1 e 1 ao longo da junta (H44). É o mesmo em toda
 * tentativa, então o replay e qualquer taxa de quadros dão o mesmo cordão.
 */
export function padraoIrregular(xMm: number): number {
  const v = Math.sin((2 * Math.PI * xMm) / 7.3) + 0.6 * Math.sin((2 * Math.PI * xMm) / 3.1 + 1.3) + 0.4 * Math.sin((2 * Math.PI * xMm) / 13.7 + 0.4)
  return Math.max(-1, Math.min(1, v / 2))
}

/** O que o modelo sabe sobre o cordão numa posição x da junta. */
export interface SecaoLocal {
  xMm: number
  /** Área da seção transversal de metal depositado (acima da chapa). */
  areaMm2: number
  larguraMm: number
  alturaMm: number
  /** Altura ÷ largura (média ponderada pelo volume se houve ajustes diferentes, H7). */
  razaoAlturaLargura: number
  /** Onde está o centro do cordão (desvio em relação à junta). */
  yCentroMm: number
  /** Espalhamento lateral da tocha nesta posição (desvio-padrão, mm, H39). */
  espalhamentoMm: number
  /** Largura que o cordão teria sem oscilação lateral (H3); igual à largura sem tecimento. */
  larguraSemOscilacaoMm: number
  /** Instabilidade média do arco aqui (H44): −1 curto demais … 0 estável … 1 longo demais. */
  instabilidade: number
  /** Último instante em que recebeu material (ms); -Infinity se nunca. */
  tUltimoDepositoMs: number
  /** Metal acima da face (mm²): no V, o que sobra depois de encher o chanfro (H46). */
  areaReforcoMm2?: number
  /** Metal ÷ área do chanfro em V (≥ 1 = cheio); 1 nas outras juntas (H46). */
  enchimento?: number
  /** Pernas do filete (mm): [lado +n, lado −n] (H46). */
  pernasMm?: [number, number]
}

/**
 * Gravidade vista pela poça no momento do depósito (H47, H50): para fora da
 * face (0 a 1, sobrecabeça), de lado (−1 a 1, sinal = lado da junta para onde
 * cai) e ao longo do avanço (−1 subindo … 1 descendo).
 */
export interface GravidadePoca {
  cabeca: number
  lado: number
  descida: number
}

/** Médias por fatia do que agiu sobre a poça quando o metal caiu ali (H50). */
export interface FisicaLocal {
  cabeca: number
  lado: number
  descida: number
  instabilidade: number
}

/**
 * H58: até esta distância lateral da linha da junta (mm) o metal é sempre do
 * cordão da junta (tecimento largo incluído). Mais longe, só se continuar o
 * cordão que já existe naquela posição; senão vira um cordão solto.
 */
export const LIMITE_JUNTA_MM = 8
/** Cordões soltos guardados no máximo; além disso o metal vai para o mais próximo. */
const MAX_SOLTOS = 12

/** Em que junta o cordão está (H46). Ausente = topo reto (etapas anteriores). */
export interface FormaCordao {
  junta: TipoJunta
  dimensoes: DimensoesJunta
}

/**
 * O cordão é guardado como uma lista de "fatias" ao longo da junta.
 * Cada fatia acumula o volume de metal que recebeu. Dividindo o volume pelo
 * comprimento da fatia obtemos a área da seção — é só balanço de massa (H2).
 */
export class Cordao {
  readonly passoMm: number
  readonly nPosicoes: number
  private readonly volumes: Float64Array
  /** Soma de volume × y, para achar o centro do cordão em cada fatia. */
  private readonly momentosY: Float64Array
  /** Soma de volume × (y² + σ²): dá o espalhamento lateral da tocha (H39). */
  private readonly momentosY2: Float64Array
  /** Soma de volume × instabilidade do arco (H44). */
  private readonly momentosInstab: Float64Array
  /** Soma de volume × razão altura/largura, para a forma média em cada fatia. */
  private readonly momentosRazao: Float64Array
  /** Somas de volume × componentes da gravidade (H50). */
  private readonly momentosCabeca: Float64Array
  private readonly momentosLado: Float64Array
  private readonly momentosDescida: Float64Array
  private readonly tUltimo: Float64Array
  private readonly nucleo: Float64Array
  private readonly raio: number
  private readonly raioRecente: number
  /**
   * H58: cordões soltos — metal que caiu longe da junta e longe do cordão que
   * já estava ali (outro ponto de solda na chapa). Cada um tem a própria
   * forma (domo sobre a superfície) e não entra na seção da junta.
   */
  readonly soltos: Cordao[] = []
  /** Centro lateral de referência de um cordão solto (onde começou). */
  private yReferencia = 0
  /** Calor local dos depósitos fora da junta, separado da avaliação da junta. */
  readonly termico: Percurso

  constructor(
    readonly comprimentoMm: number = PECA.comprimentoMm,
    passoMm: number = MODELO.passoMm,
    readonly sigmaMm: number = MODELO.sigmaPocaMm,
    readonly forma: FormaCordao | null = null,
    /** Este é um cordão solto (H58): aceita todo depósito, sem repartir. */
    readonly solto = false,
  ) {
    this.termico = new Percurso(comprimentoMm, passoMm)
    this.passoMm = passoMm
    this.nPosicoes = Math.ceil(comprimentoMm / passoMm)
    this.volumes = new Float64Array(this.nPosicoes)
    this.momentosY = new Float64Array(this.nPosicoes)
    this.momentosY2 = new Float64Array(this.nPosicoes)
    this.momentosInstab = new Float64Array(this.nPosicoes)
    this.momentosRazao = new Float64Array(this.nPosicoes)
    this.momentosCabeca = new Float64Array(this.nPosicoes)
    this.momentosLado = new Float64Array(this.nPosicoes)
    this.momentosDescida = new Float64Array(this.nPosicoes)
    this.tUltimo = new Float64Array(this.nPosicoes).fill(-Infinity)

    // Núcleo gaussiano (H4): espalha cada depósito por alguns milímetros.
    this.raio = Math.ceil((3 * sigmaMm) / passoMm)
    this.nucleo = new Float64Array(2 * this.raio + 1)
    for (let k = -this.raio; k <= this.raio; k++) {
      this.nucleo[k + this.raio] = Math.exp(-0.5 * ((k * passoMm) / sigmaMm) ** 2)
    }
    this.raioRecente = Math.max(1, Math.round(sigmaMm / passoMm))
  }

  indiceEm(xMm: number): number {
    return Math.min(this.nPosicoes - 1, Math.max(0, Math.floor(xMm / this.passoMm)))
  }

  /**
   * Coloca um volume de metal em (x, y), com a forma de seção dada pela razão
   * altura/largura. Nada se perde: o núcleo é renormalizado nas bordas.
   * `sigmaLateralMm` é a oscilação escolhida na bancada (H39); a feita à mão
   * já aparece na variação de y entre depósitos.
   */
  depositar(
    xMm: number,
    yMm: number,
    volumeMm3: number,
    tMs: number,
    razao: number = MODELO.razaoAlturaLargura,
    sigmaLateralMm = 0,
    instabilidade = 0,
    g: GravidadePoca | null = null,
  ): Cordao {
    if (volumeMm3 <= 0) return this
    if (!this.solto && !this.daJunta(xMm, yMm)) {
      return this.soltoPara(xMm, yMm).depositar(xMm, yMm, volumeMm3, tMs, razao, sigmaLateralMm, instabilidade, g)
    }
    const centro = this.indiceEm(xMm)
    const ini = Math.max(0, centro - this.raio)
    const fim = Math.min(this.nPosicoes - 1, centro + this.raio)

    let soma = 0
    for (let i = ini; i <= fim; i++) soma += this.nucleo[i - centro + this.raio]

    for (let i = ini; i <= fim; i++) {
      const dv = (volumeMm3 * this.nucleo[i - centro + this.raio]) / soma
      this.volumes[i] += dv
      this.momentosY[i] += dv * yMm
      this.momentosY2[i] += dv * (yMm * yMm + sigmaLateralMm * sigmaLateralMm)
      this.momentosInstab[i] += dv * instabilidade
      this.momentosRazao[i] += dv * razao
      if (g) {
        this.momentosCabeca[i] += dv * g.cabeca
        this.momentosLado[i] += dv * g.lado
        this.momentosDescida[i] += dv * g.descida
      }
      if (Math.abs(i - centro) <= this.raioRecente && tMs > this.tUltimo[i]) this.tUltimo[i] = tMs
    }
    return this
  }

  secao(i: number): SecaoLocal {
    const volume = this.volumes[i]
    const area = volume / this.passoMm
    const razao = volume > 0 ? this.momentosRazao[i] / volume : MODELO.razaoAlturaLargura
    const largura0 = larguraPelaArea(area, razao)
    const yCentro = volume > 0 ? this.momentosY[i] / volume : 0
    // H39: espalhamento lateral alarga o cordão; a área (metal) não muda.
    const variancia = volume > 0 ? Math.max(0, this.momentosY2[i] / volume - yCentro * yCentro) : 0
    const espalhamento = variancia > 1e-9 ? Math.sqrt(variancia) : 0
    const xMm = (i + 0.5) * this.passoMm
    // H44: arco instável → largura oscila ao longo da junta (a área não muda).
    const instab = volume > 0 ? this.momentosInstab[i] / volume : 0
    const fator = instab !== 0 ? Math.max(0.5, 1 + AMPLITUDE_INSTABILIDADE * Math.abs(instab) * padraoIrregular(xMm) + VIES_INSTABILIDADE * instab) : 1
    const largura = (espalhamento > 0 ? Math.sqrt(largura0 * largura0 + 12 * variancia) : largura0) * fator
    const altura = largura > 0 ? (largura0 * largura0 * razao) / largura : 0
    const base: SecaoLocal = {
      xMm,
      areaMm2: area,
      larguraMm: largura,
      alturaMm: altura,
      razaoAlturaLargura: largura > 0 ? altura / largura : razao,
      yCentroMm: yCentro,
      espalhamentoMm: espalhamento,
      // Com o mesmo fator de H44, para o espalhamento do calor (H39) só ver o tecimento.
      larguraSemOscilacaoMm: largura0 * fator,
      instabilidade: instab,
      tUltimoDepositoMs: this.tUltimo[i],
    }
    // H46: a mesma quantidade de metal, na forma da junta.
    return this.forma ? secaoNaJunta(base, this.forma.junta, this.forma.dimensoes, razao) : base
  }

  /** Centro lateral do metal na fatia de x, ou null se ela ainda não tem metal. */
  private centroEm(xMm: number): number | null {
    const i = this.indiceEm(xMm)
    const v = this.volumes[i]
    return v > 1e-9 ? this.momentosY[i] / v : null
  }

  /** Distância lateral até onde um depósito ainda continua o cordão já existente na fatia de x. */
  private alcanceEm(xMm: number): number {
    const i = this.indiceEm(xMm)
    const v = this.volumes[i]
    if (v <= 1e-9) return 0
    const c = this.momentosY[i] / v
    const largura = Math.sqrt(larguraPelaArea(v / this.passoMm, this.momentosRazao[i] / v) ** 2 + 12 * Math.max(0, this.momentosY2[i] / v - c * c))
    return Math.max(5, 0.75 * largura)
  }

  /** H58: o depósito em (x, y) é do cordão da junta? Perto da junta, ou continuando o cordão que já está ali. */
  private daJunta(xMm: number, yMm: number): boolean {
    if (Math.abs(yMm) <= LIMITE_JUNTA_MM) return true
    const c = this.centroEm(xMm)
    return c !== null && Math.abs(yMm - c) <= this.alcanceEm(xMm)
  }

  /** Cordão solto que recebe o depósito: o que já passa perto, ou um novo. */
  private soltoPara(xMm: number, yMm: number): Cordao {
    let melhor: Cordao | null = null
    let menor = Infinity
    for (const s of this.soltos) {
      const c = s.centroEm(xMm)
      const d = Math.abs(yMm - (c ?? s.yReferencia))
      const alcance = c === null ? 5 : s.alcanceEm(xMm)
      if (d <= alcance && d < menor) {
        menor = d
        melhor = s
      }
    }
    if (melhor) return melhor
    if (this.soltos.length >= MAX_SOLTOS) {
      // Sem lugar: o mais próximo pela referência.
      return this.soltos.reduce((a, b) => (Math.abs(b.yReferencia - yMm) < Math.abs(a.yReferencia - yMm) ? b : a))
    }
    const novo = new Cordao(this.comprimentoMm, this.passoMm, this.sigmaMm, null, true)
    novo.yReferencia = yMm
    this.soltos.push(novo)
    return novo
  }

  /** Metal dos cordões soltos (mm³, H58): fora da seção da junta. */
  volumeSolto(): number {
    return this.soltos.reduce((t, s) => t + s.volumeTotal(), 0)
  }

  /** Gravidade e arco médios na fatia i, ponderados pelo metal (H50); zeros sem metal. */
  fisica(i: number): FisicaLocal {
    const v = this.volumes[i]
    if (v <= 0) return { cabeca: 0, lado: 0, descida: 0, instabilidade: 0 }
    return { cabeca: this.momentosCabeca[i] / v, lado: this.momentosLado[i] / v, descida: this.momentosDescida[i] / v, instabilidade: this.momentosInstab[i] / v }
  }

  /** Quantos mm da junta têm cordão mais largo que o limiar. */
  comprimentoComMaterial(larguraMinMm = 1): number {
    let n = 0
    for (let i = 0; i < this.nPosicoes; i++) if (this.secao(i).larguraMm >= larguraMinMm) n++
    return n * this.passoMm
  }

  /** Todo o metal depositado: o do cordão da junta e o dos cordões soltos (H58). */
  volumeTotal(): number {
    let v = 0
    for (let i = 0; i < this.nPosicoes; i++) v += this.volumes[i]
    return v + this.volumeSolto()
  }

  /** Volumes por fatia do cordão da junta (sem os soltos). */
  copiaDosVolumes(): Float64Array {
    return this.volumes.slice()
  }
}
