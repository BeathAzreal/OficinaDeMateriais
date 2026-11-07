import type { Medidas, Tentativa } from '../modelo/avaliacao'
import { larguraPelaArea } from '../modelo/cordao'
import type { AnaliseMovimento, TrechoMovimento } from '../modelo/movimento'
import { AJUSTES, EXPLICACAO } from '../modelo/parametros'
import {
  areaAlvo,
  correnteA,
  equilibrioArco,
  modoTransferencia,
  NOME_TRANSFERENCIA,
  tensaoV,
  textoAlimentacao,
  textoTensao,
  faixaVelocidadeAlvo,
  razaoAlturaLargura,
  taxaDeposicao,
  type Ajustes,
} from '../modelo/processo'
import { exigeExplicacaoContextual } from './contexto'
import { n0, n1, n2, pct, plural } from './formato'

/*
 * Explicação por REGRAS FIXAS (H21). Cada função abaixo lê as medidas e
 * escreve uma frase seguindo as relações do próprio modelo (H1, H2, H3, H9).
 * Não há IA nem sorteio: a mesma tentativa sempre gera o mesmo texto.
 */

export type Tema =
  | 'quantidade'
  | 'regularidade'
  | 'pausas'
  | 'alinhamento'
  | 'continuidade'
  | 'forma'
  | 'ajustes'
  | 'equilibrio'
  | 'limites'

export interface ItemExplicacao {
  tema: Tema
  titulo: string
  texto: string
}

export function explicar(t: Tentativa): ItemExplicacao[] {
  const m = t.avaliacao.medidas
  const mov = t.movimento
  if (!m || !mov) {
    return [
      {
        tema: 'continuidade',
        titulo: 'Pouco cordão para explicar',
        texto:
          'A região avaliada ficou curta demais (ou sem cordão) para medir velocidade e regularidade. ' +
          'Tente um passe mais longo ao longo da junta.',
      },
      limites(),
    ]
  }

  if (exigeExplicacaoContextual(t)) return explicarContextual(t, m, mov)

  const unico = t.ajustesUsados.length === 1 ? t.ajustesUsados[0] : null
  const itens: ItemExplicacao[] = [quantidade(m, mov, t.ajustesUsados), regularidade(m, mov, unico)]
  const p = pausas(mov)
  if (p) itens.push(p)
  itens.push(alinhamento(m, t.avaliacao.fracaoLinhaCoberta), continuidade(m, t.aberturasDeArco))
  if (unico) {
    itens.push(forma(m, unico))
    const e = equilibrio(unico)
    if (e) itens.push(e)
  } else {
    itens.push(variosAjustes(t.ajustesUsados))
  }
  itens.push(limites())
  return itens
}

function descreverAjustes(a: Ajustes): string {
  return `alimentação ${textoAlimentacao(a.alimentacao)} e tensão ${textoTensao(a.tensao)}`
}

/** H1 + H2: quanto metal entrou e por quanto comprimento se espalhou. */
function quantidade(m: Medidas, mov: AnaliseMovimento, ajustes: Ajustes[]): ItemExplicacao {
  const alvo = areaAlvo()
  const area = m.area.media
  const situacao = area < alvo.minMm2 ? 'abaixo' : area > alvo.maxMm2 ? 'acima' : 'dentro'
  const conselho =
    situacao === 'abaixo'
      ? ' No modelo, para pôr mais metal por milímetro: andar mais devagar ou aumentar a alimentação.'
      : situacao === 'acima'
        ? ' No modelo, para pôr menos metal por milímetro: andar mais rápido ou reduzir a alimentação.'
        : ''
  const resultado =
    `Andando em média a ${n1(mov.velocidadeMediaMms)} mm/s, a seção média ficou em ${n1(area)} mm² — ` +
    `${situacao} do alvo do jogo (${n1(alvo.minMm2)} a ${n1(alvo.maxMm2)} mm²).`

  if (ajustes.length !== 1) {
    return {
      tema: 'quantidade',
      titulo: 'Quanto metal entrou',
      texto:
        `Você usou ${ajustes.length} combinações de ajustes; com mais alimentação, entra mais metal por segundo. ` +
        resultado +
        conselho,
    }
  }
  const a = ajustes[0]
  const faixa = faixaVelocidadeAlvo(a)
  return {
    tema: 'quantidade',
    titulo: 'Quanto metal entrou',
    texto:
      `Com alimentação ${textoAlimentacao(a.alimentacao)} (${n2(a.alimentacao / AJUSTES.alimentacaoReferencia)} × a referência, ≈ ${n0(correnteA(a))} A), ` +
      `entram ${n0(taxaDeposicao(a))} mm³/s do jogo. ` +
      resultado +
      ` Com essa alimentação, a faixa de velocidade que leva ao alvo é de ${n1(faixa.minMms)} a ${n1(faixa.maxMms)} mm/s.` +
      conselho,
  }
}

function comArco(mov: AnaliseMovimento): TrechoMovimento[] {
  return mov.trechos.filter((t) => t.velocidadeMms !== null)
}

const meio = (t: TrechoMovimento) => (t.inicioMm + t.fimMm) / 2

/** H2 + H3: variação de velocidade → variação de seção → variação de largura. */
function regularidade(m: Medidas, mov: AnaliseMovimento, unico: Ajustes | null): ItemExplicacao {
  const titulo = `Regularidade: ${m.regularidade}`
  if (mov.cvVelocidade < EXPLICACAO.variacaoRelevante) {
    const resto =
      m.regularidade === 'irregular'
        ? ' Como a velocidade foi estável, no modelo a variação restante vem de emendas, sobreposições ou troca de ajustes.'
        : ''
    return {
      tema: 'regularidade',
      titulo,
      texto:
        `Você manteve a velocidade estável (variação de ${pct(mov.cvVelocidade)} entre trechos de ${EXPLICACAO.trechoMm} mm). ` +
        `No modelo, velocidade constante dá seção constante; a largura variou ${pct(m.cvLargura)}.` +
        resto,
    }
  }

  const trechos = comArco(mov)
  const lento = trechos.reduce((a, b) => (b.velocidadeMms! < a.velocidadeMms! ? b : a))
  const rapido = trechos.reduce((a, b) => (b.velocidadeMms! > a.velocidadeMms! ? b : a))
  let texto =
    `Sua velocidade efetiva variou de ${n1(mov.velocidade.min)} a ${n1(mov.velocidade.max)} mm/s entre trechos ` +
    `(variação de ${pct(mov.cvVelocidade)}). No modelo, a seção é taxa ÷ velocidade e a largura acompanha a raiz da seção — ` +
    `por isso a largura variou ${pct(m.cvLargura)}, menos que a velocidade. ` +
    `O trecho mais lento (perto de ${n0(meio(lento))} mm) ficou com ${n1(lento.larguraMediaMm)} mm de largura; ` +
    `o mais rápido (perto de ${n0(meio(rapido))} mm), com ${n1(rapido.larguraMediaMm)} mm.`
  if (unico) {
    // H23: contrafactual com velocidade constante igual à média.
    const area = taxaDeposicao(unico) / mov.velocidadeMediaMms
    const largura = larguraPelaArea(area, razaoAlturaLargura(unico))
    texto +=
      ` Se você tivesse andado sempre a ${n1(mov.velocidadeMediaMms)} mm/s, o modelo daria ` +
      `${n1(largura)} mm de largura em todo o cordão.`
  }
  return { tema: 'regularidade', titulo, texto }
}

/** H22: trechos quase parados viram acúmulo de metal. */
function pausas(mov: AnaliseMovimento): ItemExplicacao | null {
  if (mov.pausas.length === 0) return null
  const grupos: TrechoMovimento[][] = []
  for (const t of mov.pausas) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && Math.abs(ultimo[ultimo.length - 1].fimMm - t.inicioMm) < 1e-6) ultimo.push(t)
    else grupos.push([t])
  }
  const frases = grupos.map((g) => {
    const tempo = g.reduce((s, t) => s + t.permanenciaMs, 0)
    const largura = Math.max(...g.map((t) => t.larguraMediaMm))
    return (
      `entre ${n0(g[0].inicioMm)} e ${n0(g[g.length - 1].fimMm)} mm a tocha ficou ${n1(tempo / 1000)} s ` +
      `quase parada, e a largura chegou a ${n1(largura)} mm`
    )
  })
  return {
    tema: 'pausas',
    titulo: plural(grupos.length, 'pausa', 'pausas'),
    texto:
      `Com o arco aberto, o metal continua saindo mesmo com a tocha parada: ${frases.join('; ')}. ` +
      `No modelo, todo esse metal fica no mesmo lugar.`,
  }
}

/** O modelo deposita exatamente sob a tocha: desvio do cordão = desvio da mão. */
function alinhamento(m: Medidas, fracaoLinha: number): ItemExplicacao {
  const d = m.desvioCentro
  const inicio =
    m.alinhamento === 'centrado'
      ? `O centro do cordão ficou em média a ${n1(d.medioAbsMm)} mm da linha da junta.`
      : `O centro do cordão ficou em média a ${n1(d.medioAbsMm)} mm da linha da junta, ` +
        `chegando a ${n1(d.maxAbsMm)} mm perto de x = ${n0(d.xDoMaximoMm)} mm.`
  return {
    tema: 'alinhamento',
    titulo: `Alinhamento: ${m.alinhamento}`,
    texto:
      `${inicio} No modelo o metal cai exatamente onde está a tocha, então isso mede só a posição lateral da sua mão. ` +
      `Em ${pct(fracaoLinha)} da junta o cordão passa por cima da linha da junta (vista de cima — não indica fusão).`,
  }
}

function continuidade(m: Medidas, aberturas: number): ItemExplicacao {
  const q = m.interrupcoes.quantidade
  let texto: string
  if (q > 0) {
    texto =
      `Houve ${plural(q, 'interrupção', 'interrupções')}, somando ${n1(m.interrupcoes.comprimentoMm)} mm sem cordão na região avaliada. ` +
      (aberturas > 1
        ? `Você abriu o arco ${aberturas} vezes: as falhas ficam onde a tocha passou com o arco fechado.`
        : 'Com um único arco, a falha vem de um deslocamento rápido demais: a tocha "pulou" o trecho.')
  } else if (aberturas > 1) {
    texto =
      `Você abriu o arco ${aberturas} vezes, mas as emendas não deixaram falha no cordão do modelo. ` +
      'Onde as passadas se sobrepõem, o metal se soma e o cordão fica mais largo.'
  } else {
    texto = 'Cordão contínuo, feito com uma única abertura de arco.'
  }
  return { tema: 'continuidade', titulo: 'Continuidade', texto }
}

/** H3 + H9: a tensão muda a forma, não a quantidade. Contrafactuais de ±2 pontos (H23). */
function forma(m: Medidas, a: Ajustes): ItemExplicacao {
  const area = m.area.media
  const dimensoes = (tensao: number) => {
    const r = razaoAlturaLargura({ ...a, tensao })
    const w = larguraPelaArea(area, r)
    return `${n1(w)} × ${n1(w * r)} mm`
  }
  const r = razaoAlturaLargura(a)
  const alternativas: string[] = []
  if (a.tensao - 2 >= AJUSTES.minimo) alternativas.push(`${textoTensao(a.tensao - 2)} daria cerca de ${dimensoes(a.tensao - 2)} (mais estreito e alto)`)
  if (a.tensao + 2 <= AJUSTES.maximo) alternativas.push(`${textoTensao(a.tensao + 2)}, cerca de ${dimensoes(a.tensao + 2)} (mais largo e baixo)`)
  return {
    tema: 'forma',
    titulo: 'Forma da seção (tensão)',
    texto:
      `Com ${textoTensao(a.tensao)}, o modelo usa altura = ${n2(r)} × largura: a seção média ficou com cerca de ` +
      `${dimensoes(a.tensao)} (largura × altura). A tensão não muda a quantidade de metal, só a forma. ` +
      (alternativas.length ? `Com a mesma seção, ${alternativas.join('; ')}.` : ''),
  }
}

function equilibrio(a: Ajustes): ItemExplicacao | null {
  const e = equilibrioArco(a)
  if (e.condicao === 'equilibrado') return null
  return {
    tema: 'equilibrio',
    titulo: `Arco ${e.condicao} (aviso do jogo)`,
    texto:
      `Com ${descreverAjustes(a)}, o arco fica "${e.condicao}" pela reta do jogo (tensão de equilíbrio ≈ ${textoTensao(e.tensaoEquilibrio)}). ` +
      (e.condicao === 'curto'
        ? 'Arco curto: o arame bate na poça, respinga e o metal deita sem fundir bem as bordas (H44, H93).'
        : 'Arco longo: respingo, cordão achatado, mais mordedura e poros (H44, H93).') +
      ' Números do jogo, não de procedimento.',
  }
}

function variosAjustes(ajustes: Ajustes[]): ItemExplicacao {
  return {
    tema: 'ajustes',
    titulo: 'Vários ajustes na mesma tentativa',
    texto:
      `Você usou ${ajustes.length} combinações (${ajustes.map(descreverAjustes).join('; ')}). ` +
      'Cada trecho recebeu o metal e a forma do ajuste em uso; onde passadas com ajustes diferentes se sobrepõem, ' +
      'o modelo faz uma média da forma. Por isso os contrafactuais de forma ficam de fora.',
  }
}

function limites(): ItemExplicacao {
  return {
    tema: 'limites',
    titulo: 'O que esta explicação não cobre',
    texto:
      'Tudo acima segue as relações do jogo. Fusão e aquecimento são previsões sintéticas; o modelo não calcula ' +
      'penetração real, zona afetada pelo calor nem defeitos internos. A aparência não comprova qualidade interna.',
  }
}


/** Não aplica a relação largura ∝ raiz da área total à junta com fresta. */
function explicarContextual(t: Tentativa, m: Medidas, mov: AnaliseMovimento): ItemExplicacao[] {
  const ctx = t.contexto!
  const unico = t.ajustesUsados.length === 1 ? t.ajustesUsados[0] : null
  const itens: ItemExplicacao[] = [
    { tema: 'quantidade', titulo: 'Metal e avanço nesta tentativa',
      texto: `Seção média de ${n1(m.area.media)} mm², avanço médio de ${n1(mov.velocidadeMediaMms)} mm/s. ` +
        (unico ? `Com estes consumíveis e alimentação, a taxa prevista é ${n0(taxaDeposicao(unico, ctx))} mm³/s do jogo. ` : 'Foram usadas várias regulagens. ') +
        'Mais permanência concentra metal por comprimento; mudanças simultâneas de ajustes e movimento impedem isolar uma causa.' },
    { tema: 'forma', titulo: 'Geometria e preenchimento',
      texto: `Largura média ${n1(m.largura.media)} mm; altura média ${n1(m.altura.media)} mm. ` +
        'A área total inclui o metal que preenche a junta. Com fresta ou chanfro, nem toda essa área vira reforço. ' +
        'Por isso não usamos a raiz da área total para prever largura, nem apresentamos uma largura contrafactual exata.' },
    { tema: 'regularidade', titulo: `Regularidade: ${m.regularidade}`,
      texto: `Variação da largura ${pct(m.cvLargura)} e do avanço ${pct(mov.cvVelocidade)}. ` +
        'Compare os trechos na inspeção. Oscilação, emendas, posição da peça e regulagens também podem contribuir.' },
    { tema: 'alinhamento', titulo: 'Posicionamento do cordão',
      texto: `Desvio médio do centro ${n1(m.desvioCentro.medioAbsMm)} mm. ` +
        'Esse valor descreve o cordão calculado; movimento lateral e efeitos de posição da peça podem influenciá-lo.' },
    continuidade(m, t.aberturasDeArco),
  ]
  const paradas = pausas(mov)
  if (paradas) itens.push(paradas)
  if (unico) {
    const e = equilibrioArco(unico, ctx)
    itens.push({ tema: 'equilibrio', titulo: `Arco ${e.condicao} (modelo)`,
      texto: `Desvio de ${n1(tensaoV(unico.tensao) - tensaoV(e.tensaoEquilibrio))} V em relação ao equilíbrio previsto para este preparo (${NOME_TRANSFERENCIA[modoTransferencia(unico, ctx)].toLowerCase()}). ` +
        'A DBCP influencia a corrente relativa; tensão, consumíveis e técnica devem ser considerados na comparação.' })
  }
  itens.push(limites())
  return itens
}
