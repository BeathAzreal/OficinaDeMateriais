import type { Diagnostico } from '../../modelo/manufatura/inform'
import { h } from '../dom'

/*
 * Editor de texto do job (Manufatura Aditiva): números de linha, linha em
 * execução destacada e linhas com erro ou aviso marcadas. Um textarea
 * comum por cima de uma camada de fundo: leitor de tela, colar, desfazer e
 * Tab (que sai do campo) continuam como em qualquer campo de texto.
 */

export interface EditorInform {
  readonly elemento: HTMLElement
  readonly campo: HTMLTextAreaElement
  texto(): string
  definir(texto: string): void
  /** Linha em execução (1 = primeira), ou null. Rola para ela se for preciso. */
  marcarLinha(linha: number | null): void
  marcarDiagnosticos(d: Diagnostico[]): void
  somenteLeitura(sim: boolean): void
  irParaLinha(linha: number): void
  aoMudar(f: () => void): void
}

export function criarEditorInform(rotulo: string, descricaoId: string): EditorInform {
  const numeros = h('div', { class: 'ma-ed-numeros', 'aria-hidden': 'true' })
  const fundo = h('div', { class: 'ma-ed-fundo', 'aria-hidden': 'true' })
  const campo = h('textarea', {
    class: 'ma-ed-campo', spellcheck: 'false', autocomplete: 'off', autocapitalize: 'characters', wrap: 'off',
    'aria-label': rotulo, 'aria-describedby': descricaoId,
  }) as HTMLTextAreaElement
  const area = h('div', { class: 'ma-ed-area' }, fundo, campo)
  const elemento = h('div', { class: 'ma-editor' }, numeros, area)
  let atual: number | null = null
  let marcas = new Map<number, 'erro' | 'aviso'>()
  const ouvintes: (() => void)[] = []

  const redesenhar = () => {
    const n = campo.value.split('\n').length
    const numerosFilhos: HTMLElement[] = [], fundoFilhos: HTMLElement[] = []
    for (let i = 1; i <= n; i++) {
      const marca = marcas.get(i)
      const classe = `${i === atual ? ' ma-ed-atual' : ''}${marca ? ` ma-ed-${marca}` : ''}`
      numerosFilhos.push(h('div', { class: `ma-ed-num${classe}` }, String(i).padStart(3, '0')))
      fundoFilhos.push(h('div', { class: `ma-ed-linha${classe}` }))
    }
    numeros.replaceChildren(...numerosFilhos)
    fundo.replaceChildren(...fundoFilhos)
    sincronizar()
  }
  const sincronizar = () => {
    numeros.style.transform = `translateY(${-campo.scrollTop}px)`
    fundo.style.transform = `translate(${-campo.scrollLeft}px, ${-campo.scrollTop}px)`
  }
  campo.addEventListener('scroll', sincronizar)
  campo.addEventListener('input', () => { redesenhar(); for (const f of ouvintes) f() })

  const alturaLinha = () => parseFloat(getComputedStyle(campo).lineHeight) || 20
  const rolarPara = (linha: number) => {
    const a = alturaLinha(), topo = (linha - 1) * a
    if (topo < campo.scrollTop + a || topo > campo.scrollTop + campo.clientHeight - 2 * a) campo.scrollTop = Math.max(0, topo - campo.clientHeight / 3)
    sincronizar()
  }

  return {
    elemento,
    campo,
    texto: () => campo.value,
    definir(texto) { campo.value = texto; redesenhar() },
    marcarLinha(linha) {
      if (linha === atual) return
      atual = linha
      redesenhar()
      if (linha) rolarPara(linha)
    },
    marcarDiagnosticos(d) {
      marcas = new Map()
      for (const x of d) if (x.gravidade === 'erro' || !marcas.has(x.linha)) marcas.set(x.linha, x.gravidade)
      redesenhar()
    },
    somenteLeitura(sim) { campo.readOnly = sim; elemento.classList.toggle('ma-ed-travado', sim) },
    irParaLinha(linha) {
      const linhas = campo.value.split('\n')
      let pos = 0
      for (let i = 0; i < linha - 1 && i < linhas.length; i++) pos += linhas[i].length + 1
      campo.focus({ preventScroll: true })
      campo.setSelectionRange(pos, pos + (linhas[linha - 1]?.length ?? 0))
      rolarPara(linha)
    },
    aoMudar(f) { ouvintes.push(f) },
  }
}
