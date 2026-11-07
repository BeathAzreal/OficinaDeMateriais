/*
 * Condições de soldagem (H106-b). Ficam SEPARADAS do movimento, como na
 * célula real: o job do robô diz ARCON ASF#(1); o arquivo de início de arco
 * guarda o que o controlador manda para a fonte (alimentação do arame e
 * correção do comprimento do arco); a fonte (painel da Aristo, na tese de
 * referência) roda a linha sinérgica escolhida no PRÓPRIO painel, que dá
 * corrente e tensão a partir da alimentação.
 *
 * A linha sinérgica abaixo é DIDÁTICA (números do jogo, monótonos e
 * plausíveis para GMAW pulsado com arame de 1,2 mm). Não é o programa
 * sinérgico da ESAB nem medição da tese.
 */

export interface ArquivoInicio {
  /** Alimentação do arame (m/min) enviada à fonte. */
  alimentacaoMMin: number
  /** Correção do comprimento do arco (trim), em passos de −10 a +10. */
  correcaoArco: number
}

export interface ArquivoFim {
  /** Tempo de preenchimento da cratera com o robô parado (s). */
  crateraS: number
  /** Alimentação durante o preenchimento (m/min). */
  alimentacaoMMin: number
}

export interface Condicoes {
  inicio: ArquivoInicio[]
  fim: ArquivoFim[]
}

export const FAIXA_ALIMENTACAO = { min: 2, max: 12 }
export const FAIXA_CORRECAO = { min: -10, max: 10 }
export const FAIXA_CRATERA = { min: 0, max: 3 }
export const ARQUIVOS_MAX = 8

/** Linha sinérgica didática da fonte (painel da fonte, não do robô). */
export const LINHA_SINERGICA = {
  nome: 'GMAW pulsado · arame inox 316LSi Ø 1,2 mm · Ar + 2 % CO₂ (didática)',
  diametroArameMm: 1.2,
  /** Massa específica do arame 316LSi (g/cm³). */
  densidadeGcm3: 7.9,
  /** Fração do arame que vira depósito (o resto é respingo e vapor). */
  rendimento: 0.92,
}

export function condicoesPadrao(): Condicoes {
  return {
    inicio: [{ alimentacaoMMin: 5, correcaoArco: 0 }, { alimentacaoMMin: 6.5, correcaoArco: 0 }],
    fim: [{ crateraS: 0.6, alimentacaoMMin: 3 }],
  }
}

/** Corrente e tensão médias da linha sinérgica didática. */
export function sinergia(alimentacaoMMin: number, correcaoArco: number): { correnteA: number; tensaoV: number; potenciaW: number } {
  const correnteA = 30 + 25 * alimentacaoMMin
  const tensaoV = 16 + 1.4 * alimentacaoMMin + 0.25 * correcaoArco
  return { correnteA, tensaoV, potenciaW: correnteA * tensaoV }
}

/** Volume depositado por segundo (mm³/s): rendimento × área do arame × alimentação. */
export function vazaoDeposito(alimentacaoMMin: number): number {
  const d = LINHA_SINERGICA.diametroArameMm
  return LINHA_SINERGICA.rendimento * (Math.PI * d * d / 4) * (alimentacaoMMin * 1000 / 60)
}

/** Massa de arame consumida (g) num tempo com dada alimentação. */
export function massaArameG(alimentacaoMMin: number, segundos: number): number {
  const d = LINHA_SINERGICA.diametroArameMm
  const volumeMm3 = (Math.PI * d * d / 4) * (alimentacaoMMin * 1000 / 60) * segundos
  return volumeMm3 / 1000 * LINHA_SINERGICA.densidadeGcm3
}

const limitar = (v: number, f: { min: number; max: number }) => Math.max(f.min, Math.min(f.max, v))

/** Valida dados lidos (salvos) e devolve condições seguras. */
export function validarCondicoes(d: unknown): Condicoes | null {
  if (!d || typeof d !== 'object') return null
  const o = d as { inicio?: unknown; fim?: unknown }
  if (!Array.isArray(o.inicio) || !Array.isArray(o.fim)) return null
  const num = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) ? v : padrao)
  const inicio = o.inicio.slice(0, ARQUIVOS_MAX).map((a) => {
    const x = (a ?? {}) as Partial<ArquivoInicio>
    return { alimentacaoMMin: limitar(num(x.alimentacaoMMin, 5), FAIXA_ALIMENTACAO), correcaoArco: Math.round(limitar(num(x.correcaoArco, 0), FAIXA_CORRECAO)) }
  })
  const fim = o.fim.slice(0, ARQUIVOS_MAX).map((a) => {
    const x = (a ?? {}) as Partial<ArquivoFim>
    return { crateraS: limitar(num(x.crateraS, 0.6), FAIXA_CRATERA), alimentacaoMMin: limitar(num(x.alimentacaoMMin, 3), FAIXA_ALIMENTACAO) }
  })
  if (!inicio.length || !fim.length) return null
  return { inicio, fim }
}
