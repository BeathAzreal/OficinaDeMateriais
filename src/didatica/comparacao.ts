import type { Tentativa } from '../modelo/avaliacao'
import { EXPLICACAO } from '../modelo/parametros'
import { fatorFormaAlimentacao, razaoPelaTensao, taxaDeposicao, textoAlimentacao, textoTensao, type Ajustes } from '../modelo/processo'
import { exigeExplicacaoContextual } from './contexto'
import { n1, pct, variacao } from './formato'

/*
 * Comparação com a tentativa avaliada anterior (H24, H25). Regras fixas,
 * sem IA. "Melhor/pior" só onde o jogo tem critério.
 */

/** melhor/pior: há critério do jogo. maior/menor: só a direção. */
export type Juizo = 'melhor' | 'pior' | 'igual' | 'maior' | 'menor' | 'diferente'

export interface LinhaComparacao {
  rotulo: string
  anterior: string
  atual: string
  juizo: Juizo
}

export interface Comparacao {
  linhas: LinhaComparacao[]
  frases: string[]
}

type Criterio = 'menor-melhor' | 'maior-melhor' | 'neutro'

function julgar(anterior: number, atual: number, tolerancia: number, criterio: Criterio): Juizo {
  const d = atual - anterior
  if (Math.abs(d) < tolerancia) return 'igual'
  if (criterio === 'neutro') return d > 0 ? 'maior' : 'menor'
  const subiu = d > 0
  return (criterio === 'maior-melhor') === subiu ? 'melhor' : 'pior'
}

const mesmoAjuste = (a: Ajustes, b: Ajustes) => a.alimentacao === b.alimentacao && a.tensao === b.tensao
const textoAjustes = (lista: Ajustes[]) => lista.map((a) => `${textoAlimentacao(a.alimentacao)} / ${textoTensao(a.tensao)}`).join('; ') || '—'

/** Devolve null se alguma das tentativas não tem medidas (nada a comparar). */
export function comparar(anterior: Tentativa, atual: Tentativa): Comparacao | null {
  const ma = anterior.avaliacao.medidas
  const mb = atual.avaliacao.medidas
  const va = anterior.movimento
  const vb = atual.movimento
  if (!ma || !mb || !va || !vb) return null

  const tolMm = EXPLICACAO.toleranciaMm
  const tolFr = EXPLICACAO.toleranciaFracao
  const linha = (
    rotulo: string,
    a: number,
    b: number,
    formato: (v: number) => string,
    tol: number,
    criterio: Criterio,
  ): LinhaComparacao => ({ rotulo, anterior: formato(a), atual: formato(b), juizo: julgar(a, b, tol, criterio) })
  const mm = (v: number) => `${n1(v)} mm`

  const ajustesIguais =
    anterior.ajustesUsados.length === atual.ajustesUsados.length &&
    anterior.ajustesUsados.every((a, i) => mesmoAjuste(a, atual.ajustesUsados[i]))

  const linhas: LinhaComparacao[] = [
    {
      rotulo: 'Ajustes (alimentação / tensão)',
      anterior: textoAjustes(anterior.ajustesUsados),
      atual: textoAjustes(atual.ajustesUsados),
      juizo: ajustesIguais ? 'igual' : 'diferente',
    },
    linha('Velocidade média', va.velocidadeMediaMms, vb.velocidadeMediaMms, (v) => `${n1(v)} mm/s`, tolMm, 'neutro'),
    linha('Variação da velocidade', va.cvVelocidade, vb.cvVelocidade, pct, tolFr, 'neutro'),
    linha('Largura média', ma.largura.media, mb.largura.media, mm, tolMm, 'neutro'),
    linha('Altura média', ma.altura.media, mb.altura.media, mm, tolMm, 'neutro'),
    linha('Variação da largura (regularidade)', ma.cvLargura, mb.cvLargura, pct, tolFr, 'menor-melhor'),
    linha('Desvio médio da junta', ma.desvioCentro.medioAbsMm, mb.desvioCentro.medioAbsMm, mm, tolMm, 'menor-melhor'),
    linha('Seção no alvo do jogo', ma.fracaoNoAlvo, mb.fracaoNoAlvo, pct, tolFr, 'maior-melhor'),
    linha('Interrupções', ma.interrupcoes.quantidade, mb.interrupcoes.quantidade, String, 0.5, 'menor-melhor'),
    linha(
      'Linha da junta coberta (vista de cima)',
      anterior.avaliacao.fracaoLinhaCoberta,
      atual.avaliacao.fracaoLinhaCoberta,
      pct,
      tolFr,
      'neutro',
    ),
  ]

  const contextual = exigeExplicacaoContextual(anterior) || exigeExplicacaoContextual(atual)
  const frases: string[] = []

  // Regularidade ← variação da velocidade (H2 + H3).
  const jReg = julgar(ma.cvLargura, mb.cvLargura, tolFr, 'menor-melhor')
  if (jReg === 'melhor' || jReg === 'pior') {
    const jVel = julgar(va.cvVelocidade, vb.cvVelocidade, tolFr, 'menor-melhor')
    const causa =
      jVel === jReg
        ? `No modelo, isso acompanha a variação da sua velocidade, que foi de ${pct(va.cvVelocidade)} para ${pct(vb.cvVelocidade)}.`
        : `A variação da velocidade quase não acompanhou (${pct(va.cvVelocidade)} → ${pct(vb.cvVelocidade)}); ` +
          'outros fatores, como emendas, oscilação, posição e regulagens, também podem contribuir.'
    frases.push(
      `A regularidade ${jReg === 'melhor' ? 'melhorou' : 'piorou'}: a variação da largura foi de ` +
        `${pct(ma.cvLargura)} para ${pct(mb.cvLargura)}. ${causa}`,
    )
  }

  // Largura média: decomposição em alimentação, velocidade e tensão (H25).
  const unicos = !contextual && anterior.ajustesUsados.length === 1 && atual.ajustesUsados.length === 1
  const fatoresRelevantes = unicos
    ? decomporLargura(anterior.ajustesUsados[0], atual.ajustesUsados[0], va.velocidadeMediaMms, vb.velocidadeMediaMms)
        .filter((f) => Math.abs(f.fator - 1) > EXPLICACAO.fatorRelevante)
        .map((f) => `${f.nome} (${variacao(f.fator)})`)
    : []
  if (julgar(ma.largura.media, mb.largura.media, tolMm, 'neutro') === 'igual') {
    // Largura igual pode esconder causas que se compensaram.
    if (fatoresRelevantes.length >= 2) {
      frases.push(
        `A largura média quase não mudou (${mm(ma.largura.media)} → ${mm(mb.largura.media)}), mas por compensação: ` +
          `${fatoresRelevantes.join(', ')}. Pelo modelo, os efeitos se anularam.`,
      )
    }
  } else {
    const inicio = `A largura média foi de ${mm(ma.largura.media)} para ${mm(mb.largura.media)} (${variacao(mb.largura.media / ma.largura.media)}).`
    if (unicos) {
      frases.push(
        fatoresRelevantes.length
          ? `${inicio} Pelo modelo, a mudança se explica aproximadamente por: ${fatoresRelevantes.join(', ')}.`
          : `${inicio} Alimentação, velocidade média e tensão quase não mudaram; no modelo, a diferença vem de pausas e emendas.`,
      )
    } else {
      frases.push(contextual
        ? `${inicio} Junta, preenchimento, consumíveis, técnica e posição podem mudar a relação entre área e largura. A comparação é descritiva e não separa causas.`
        : `${inicio} Como alguma tentativa usou mais de um ajuste, o jogo não separa as contribuições.`)
    }
  }

  const jAlin = julgar(ma.desvioCentro.medioAbsMm, mb.desvioCentro.medioAbsMm, tolMm, 'menor-melhor')
  if (jAlin === 'melhor' || jAlin === 'pior') {
    frases.push(
      `O cordão ficou ${jAlin === 'melhor' ? 'mais' : 'menos'} centrado (desvio médio de ${mm(ma.desvioCentro.medioAbsMm)} ` +
        `para ${mm(mb.desvioCentro.medioAbsMm)}). Movimento lateral e posição da peça podem contribuir para esse deslocamento.`,
    )
  }

  if (julgar(ma.fracaoNoAlvo, mb.fracaoNoAlvo, tolFr, 'maior-melhor') !== 'igual') {
    frases.push(`A seção ficou no alvo do jogo em ${pct(mb.fracaoNoAlvo)} do comprimento avaliado (antes, ${pct(ma.fracaoNoAlvo)}).`)
  }

  if (ma.interrupcoes.quantidade !== mb.interrupcoes.quantidade) {
    frases.push(
      `Interrupções: de ${ma.interrupcoes.quantidade} para ${mb.interrupcoes.quantidade} ` +
        `(aberturas de arco: de ${anterior.aberturasDeArco} para ${atual.aberturasDeArco}).`,
    )
  }

  if (frases.length === 0) frases.push('As duas tentativas ficaram praticamente iguais pelos critérios do jogo.')
  return { linhas, frases }
}

export interface FatorLargura {
  nome: string
  fator: number
}

/**
 * H25: no modelo, largura ∝ √(taxa ÷ (velocidade × razão altura/largura)).
 * A razão entre larguras é o produto dos três fatores abaixo.
 */
export function decomporLargura(a: Ajustes, b: Ajustes, vA: number, vB: number): FatorLargura[] {
  return [
    { nome: `alimentação ${textoAlimentacao(a.alimentacao)} → ${textoAlimentacao(b.alimentacao)}`, fator: Math.sqrt((taxaDeposicao(b) / taxaDeposicao(a)) * (fatorFormaAlimentacao(a) / fatorFormaAlimentacao(b))) },
    { nome: `velocidade média ${n1(vA)} → ${n1(vB)} mm/s`, fator: Math.sqrt(vA / vB) },
    { nome: `tensão ${textoTensao(a.tensao)} → ${textoTensao(b.tensao)}`, fator: Math.sqrt(razaoPelaTensao(a) / razaoPelaTensao(b)) },
  ]
}
