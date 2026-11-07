/*
 * Laudo térmico de um passe MIG/MAG (H111): aporte, regime de escoamento do
 * calor, t8/5 e larguras da zona fundida e da ZTA, calculados pela MFL com
 * modelos/soldagem/laudo_termico.mfl. Modo sombra: aparece no resultado ao
 * lado da avaliação do jogo e não muda a nota.
 */
import type { MaterialId } from '../modelo/material'
import { MODELOS, modelosDoJogo } from './motor'

export const MODELO_LAUDO = 'modelos/soldagem/laudo_termico.mfl'
export const MODELO_APORTE = 'modelos/soldagem/aporte.mfl'

/** Chapas cobertas pela EN 1011-2 (aços carbono e baixa liga). As outras só têm o aporte. */
const ACOS: ReadonlySet<MaterialId> = new Set<MaterialId>(['aco-carbono', 'aco-galvanizado', 'aco-medio-carbono'])

export interface EntradaLaudo {
  material: MaterialId
  tensaoV: number
  correnteA: number
  velocidadeMms: number
  espessuraMm: number
  /** Temperatura da peça antes de soldar (°C). O jogo ainda não tem pré-aquecimento: 20 °C. */
  preaquecimentoC?: number
}

export interface LaudoTermico {
  entrada: Required<EntradaLaudo>
  aporteKJmm: number
  potenciaKW: number
  /** null quando a chapa não é aço carbono (a EN 1011-2 não se aplica). */
  aco: null | {
    transicaoMm: number
    chapaFina: boolean
    t85S: number
    meiaLarguraZfMm: number
    larguraZtaMm: number
  }
}

/** Por que não há laudo para esta tentativa, ou null se há. */
export function semLaudo(e: EntradaLaudo): string | null {
  if (!(e.tensaoV > 0) || !(e.correnteA > 0)) return 'O arco não abriu: sem energia, não há laudo térmico.'
  if (!(e.velocidadeMms > 0)) return 'Não houve trecho de cordão para medir a velocidade.'
  if (!(e.espessuraMm > 0)) return 'Espessura da chapa desconhecida.'
  return null
}

export function acoCoberto(m: MaterialId): boolean {
  return ACOS.has(m)
}

export async function calcularLaudo(e: EntradaLaudo): Promise<LaudoTermico> {
  const entrada: Required<EntradaLaudo> = { preaquecimentoC: 20, ...e }
  const motivo = semLaudo(entrada)
  if (motivo) throw new Error(motivo)
  const m = await modelosDoJogo()
  const comuns = {
    tensao: [entrada.tensaoV, 'V'],
    corrente: [entrada.correnteA, 'A'],
    velocidade: [entrada.velocidadeMms, 'mm/s'],
  } as const
  if (!acoCoberto(entrada.material)) {
    const s = m.rodar(MODELO_APORTE, comuns)
    return { entrada, aporteKJmm: s.getNumber('aporte', 'kJ/mm'), potenciaKW: s.getNumber('potencia', 'kW'), aco: null }
  }
  const s = m.rodar(MODELO_LAUDO, {
    ...comuns,
    espessura: [entrada.espessuraMm, 'mm'],
    preaquecimento: [entrada.preaquecimentoC + 273.15, 'K'],
  })
  return {
    entrada,
    aporteKJmm: s.getNumber('aporte', 'kJ/mm'),
    potenciaKW: s.getNumber('potencia', 'kW'),
    aco: {
      transicaoMm: s.getNumber('transicao', 'mm'),
      chapaFina: s.getNumber('chapa_fina') === 1,
      t85S: s.getNumber('t85', 's'),
      meiaLarguraZfMm: s.getNumber('meia_largura_zf', 'mm'),
      larguraZtaMm: s.getNumber('largura_zta', 'mm'),
    },
  }
}

/** Os arquivos .mfl que o laudo usa, na ordem em que vale a pena ler. */
export function fontesDoLaudo(aco: boolean): { caminho: string; texto: string }[] {
  const caminhos = aco ? [MODELO_LAUDO, MODELO_APORTE, 'modelos/materiais/aco.mfl'] : [MODELO_APORTE]
  return caminhos.map((caminho) => ({ caminho, texto: MODELOS[caminho] ?? '' }))
}
