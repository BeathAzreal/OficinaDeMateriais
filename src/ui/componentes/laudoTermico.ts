/*
 * Botão "Laudo térmico (MFL)" do resultado do MIG/MAG (H111). Abre uma
 * sobreposição com o aporte, o t8/5 e as larguras da zona fundida e da ZTA
 * calculados pela MFL, e os próprios modelos .mfl em "Ver a fórmula".
 * Modo sombra: não muda a nota.
 */
import type { Tentativa } from '../../modelo/avaliacao'
import { MATERIAIS } from '../../modelo/material'
import { correnteA, tensaoV, type Ajustes, type ContextoProcesso } from '../../modelo/processo'
import { calcularLaudo, fontesDoLaudo, semLaudo, type EntradaLaudo, type LaudoTermico } from '../../mfl/laudoTermico'
import { abrirPainel } from '../dialogo'
import { h } from '../dom'
import '../../mfl/laudo.css'

const fmt = (v: number, casas = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })

/** Entradas do laudo a partir da tentativa. Com vários ajustes no passe, vale o último. */
export function entradaDaTentativa(ctx: ContextoProcesso, t: Tentativa, inicial: Ajustes): EntradaLaudo {
  const ajustes = t.ajustesUsados.at(-1) ?? inicial
  return {
    material: ctx.material,
    tensaoV: tensaoV(ajustes.tensao),
    correnteA: correnteA(ajustes, ctx),
    velocidadeMms: t.movimento?.velocidadeMediaMms ?? 0,
    espessuraMm: ctx.espessuraMm,
  }
}

function linha(rotulo: string, valor: string, explicacao: string): HTMLElement {
  return h('li', {}, h('strong', {}, rotulo), h('span', { class: 'laudo-valor' }, valor), h('p', {}, explicacao))
}

export function montarLaudo(l: LaudoTermico, variosAjustes: boolean): HTMLElement {
  const e = l.entrada
  const material = MATERIAIS[e.material]
  const itens: HTMLElement[] = [
    linha('Aporte térmico', `${fmt(l.aporteKJmm, 2)} kJ/mm`,
      `Energia que entra na peça a cada milímetro de cordão: Q = k·U·I/v, com k = 0,8 para o MIG/MAG (EN 1011-1). Potência na peça: ${fmt(l.potenciaKW, 2)} kW.`),
  ]
  if (l.aco) {
    const a = l.aco
    itens.push(
      linha('Escoamento do calor', a.chapaFina ? 'chapa fina (2-D)' : 'chapa grossa (3-D)',
        a.chapaFina
          ? `A chapa de ${fmt(e.espessuraMm)} mm é mais fina que a espessura de transição (${fmt(a.transicaoMm)} mm): o calor só escoa pelos lados e a peça esfria mais devagar.`
          : `A chapa de ${fmt(e.espessuraMm)} mm é mais grossa que a espessura de transição (${fmt(a.transicaoMm)} mm): o calor escoa também para baixo e a peça esfria mais rápido.`),
      linha('Resfriamento de 800 a 500 °C (t8/5)', `${fmt(a.t85S)} s`,
        'Quanto menor, mais rápido a ZTA esfria e mais dura (e frágil) ela tende a ficar, principalmente no aço com mais carbono. Mais aporte ou pré-aquecimento aumentam o t8/5 (EN 1011-2, Anexo D).'),
      linha('Zona fundida', `${fmt(2 * a.meiaLarguraZfMm)} mm de largura`,
        `Onde o pico de temperatura passa da fusão (1500 °C): ${fmt(a.meiaLarguraZfMm)} mm para cada lado da linha central. Estimativa: o modelo não vê o chanfro nem o metal de adição.`),
      linha('Zona afetada pelo calor (ZTA)', `${fmt(a.larguraZtaMm)} mm de cada lado`,
        'Faixa depois da zona fundida em que o pico passa de 727 °C (A1): o aço muda de estrutura sem fundir. É onde a trinca do braço da OS-01 começou.'),
    )
  }
  return h('div', { class: 'laudo-termico' },
    h('p', { class: 'nota laudo-aviso' },
      'Em teste: estes números são calculados pela linguagem MFL e não mudam a nota. Compare com o que o jogo mostrou.'),
    l.aco?.foraDaValidade
      ? h('p', { class: 'laudo-fora' }, h('strong', {}, 'Fora do que o modelo representa. '),
          `Com este aporte, a zona fundida passaria de 4 vezes a espessura da chapa: na prática a poça atravessa a chapa e escorre (veja o avesso). Os números abaixo servem só para mostrar que o calor foi demais.`)
      : null,
    h('ul', { class: 'lista-explicacao laudo-lista' }, itens),
    l.aco ? null : h('p', { class: 'nota' }, `${material.nome}: por enquanto o laudo completo cobre só os aços carbono (a EN 1011-2 é para aços ferríticos). Aqui vai só o aporte.`),
    h('p', { class: 'nota laudo-entradas' },
      `Entradas: ${material.nomeCurto}, ${fmt(e.espessuraMm)} mm · ${fmt(e.tensaoV)} V · ${fmt(e.correnteA, 0)} A · ${fmt(e.velocidadeMms)} mm/s (média do trecho avaliado) · peça a ${fmt(e.preaquecimentoC, 0)} °C antes de soldar.`,
      variosAjustes ? ' Você mudou a máquina durante o passe: o laudo usa o último ajuste.' : ''),
    h('details', { class: 'laudo-formula' },
      h('summary', {}, 'Ver a fórmula (modelos em MFL)'),
      h('p', { class: 'nota' },
        'Modelos analíticos (Rosenthal; EN 1011-1 e EN 1011-2): propriedades constantes e sem perdas pela superfície. Valem para a ZTA, longe do arco; não preveem a poça, a penetração nem a microestrutura.'),
      fontesDoLaudo(l.aco !== null).map((f) => h('figure', {}, h('figcaption', {}, f.caminho), h('pre', {}, h('code', {}, f.texto))))),
  )
}

/** Botão do resultado. Null se a tentativa não tem o que medir. */
export function botaoLaudo(ctx: ContextoProcesso, t: Tentativa | null, inicial: Ajustes): HTMLElement | null {
  if (!t) return null
  const entrada = entradaDaTentativa(ctx, t, inicial)
  const motivo = semLaudo(entrada)
  const abrir = () => {
    const corpo = h('div', { class: 'laudo-termico' }, h('p', { class: 'nota' }, motivo ?? 'Calculando com a MFL…'))
    if (!motivo) {
      calcularLaudo(entrada)
        .then((l) => corpo.replaceChildren(montarLaudo(l, t.ajustesUsados.length > 1)))
        .catch((erro: unknown) => corpo.replaceChildren(h('p', { class: 'nota' }, `Não deu para calcular o laudo: ${erro instanceof Error ? erro.message : String(erro)}`)))
    }
    void abrirPainel('Laudo térmico (MFL)', corpo)
  }
  return h('button', { type: 'button', class: 'botao-secundario', title: 'Aporte, t8/5 e ZTA calculados pela linguagem MFL (em teste, não muda a nota)', on: { click: abrir } }, 'Laudo térmico (MFL)')
}
