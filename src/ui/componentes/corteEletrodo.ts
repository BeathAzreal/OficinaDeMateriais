import { h, n1 } from '../dom'
import { abrirPainel } from '../dialogo'
import { baseEletrodo, type DepositoEletrodo } from '../../modelo/depositoEletrodo'
import type { PecaEletrodo } from '../../missoes/pecasEletrodo'

/** Cores dos passes no corte (o 1º embaixo); depois do último, repete. */
const CORES_PASSE = ['#c9a46b', '#7fa7c9', '#a7c47f', '#c98a7f', '#b49ad1', '#d1c27f']

/**
 * H97: corte transversal do eletrodo numa posição x, desenhado das camadas
 * guardadas pelo depósito (o mesmo estado que a análise usou). Não inventa
 * defeito: a linha vermelha é a interface que a análise marcou sem fundir.
 */
export function desenharCorteEletrodo(canvas: HTMLCanvasElement, dep: DepositoEletrodo, peca: PecaEletrodo, xMm: number): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width, H = canvas.height
  const meiaVista = 15, esp = peca.espessuraMm
  // Escala igual nos dois eixos: o que se vê tem a proporção real.
  const escala = Math.min(W / (2 * meiaVista), H / (esp + 8))
  const px = (y: number) => W / 2 + y * escala
  const py = (z: number) => H - 8 - (z + esp) * escala
  ctx.fillStyle = '#14171b'
  ctx.fillRect(0, 0, W, H)
  const dy = dep.dy
  for (let y = -meiaVista; y < meiaVista; y += dy) {
    const yc = y + dy / 2
    const base = baseEletrodo(peca, yc)
    // Chapa: do fundo até a superfície (na abertura da junta, a base é o fundo).
    if (base > -esp + 1e-6) {
      ctx.fillStyle = '#4b555e'
      ctx.fillRect(px(y), py(base), dy * escala + 0.5, (base + esp) * escala)
    }
    const camadas = dep.camadas.get(dep.celula(xMm, yc)) ?? []
    let z = base
    camadas.forEach((c, n) => {
      if (c.espessuraMm <= 0.005) return
      ctx.fillStyle = CORES_PASSE[(c.passe - 1) % CORES_PASSE.length]
      ctx.fillRect(px(y), py(z + c.espessuraMm), dy * escala + 0.5, c.espessuraMm * escala)
      if (n > 0 && c.fundiu === false && c.espessuraMm >= 0.2) {
        ctx.fillStyle = '#ff3b30'
        ctx.fillRect(px(y), py(z) - 1.5, dy * escala + 0.5, 3)
      }
      z += c.espessuraMm
    })
  }
  ctx.fillStyle = '#cfd6dd'
  ctx.font = '12px sans-serif'
  ctx.fillText(`x = ${n1(xMm)} mm · escala real (1 mm = ${n1(escala)} px)`, 8, 16)
}

/** Painel com o corte e a escolha da posição; abre no meio do trecho ou onde houver falta de fusão entre passes. */
export function abrirCorteEletrodo(dep: DepositoEletrodo, peca: PecaEletrodo, xInicialMm?: number): void {
  const canvas = h('canvas', { width: 640, height: 260, class: 'corte-eletrodo', 'aria-label': 'Corte transversal da peça soldada' }) as HTMLCanvasElement
  const x0 = xInicialMm ?? (peca.inicioMm + peca.fimMm) / 2
  const faixa = h('input', { type: 'range', min: peca.inicioMm, max: peca.fimMm, step: 0.5, value: x0, 'aria-label': 'Posição do corte (mm)' }) as HTMLInputElement
  const valor = h('output', {}, `${n1(x0)} mm`)
  const desenhar = () => { valor.value = `${n1(Number(faixa.value))} mm`; desenharCorteEletrodo(canvas, dep, peca, Number(faixa.value)) }
  faixa.addEventListener('input', desenhar)
  const passes = Math.max(0, ...[...dep.camadas.values()].flatMap((l) => l.map((c) => c.passe)))
  abrirPainel('Corte da peça', h('section', { class: 'resultado-smaw' },
    h('p', {}, 'Corte transversal no ponto escolhido, com a proporção real. Cada cor é um passe; em vermelho, onde o passe não fundiu no de baixo.'),
    canvas,
    h('label', { class: 'p15-linha' }, 'Posição do corte', valor), faixa,
    h('ul', { class: 'legenda-corte' },
      ...Array.from({ length: Math.min(passes, CORES_PASSE.length) }, (_, i) => h('li', {}, h('span', { style: `display:inline-block;width:12px;height:12px;background:${CORES_PASSE[i]};margin-right:6px` }), `Passe ${i + 1}`)),
      h('li', {}, h('span', { style: 'display:inline-block;width:12px;height:3px;background:#ff3b30;margin-right:6px;vertical-align:middle' }), 'Sem fundir no passe de baixo')),
    h('small', {}, 'Corte do estado simulado pelo jogo (camadas e calor de cada passe). Modelo didático: não é macrografia.')))
  desenhar()
}
