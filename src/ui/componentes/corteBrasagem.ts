import { ModeloBrasagem } from '../../modelo/brasagem'
import type { PecaBrasagem } from '../../missoes/pecasBrasagem'
import { h } from '../dom'

/**
 * H105: a folga vista de cima com a chapa de cima arrancada (como no ensaio
 * de arrancamento de uma junta brasada): onde a liga molhou, vazios, poros e,
 * em cima, o filete da borda. Escala real no comprimento; a profundidade da
 * sobreposição é ampliada para caber na tela.
 */
export function corteBrasagem(p: PecaBrasagem, m: ModeloBrasagem, corLiga: string): HTMLElement {
  const { NX, NY, DX, DY, Y0 } = ModeloBrasagem.grade
  const largura = 640, altura = 220, margem = 30
  const c = h('canvas', { width: largura, height: altura, class: 'corte-brasagem', 'aria-label': 'Folga vista de cima com a chapa de cima arrancada: liga, vazios e poros' })
  const ctx = c.getContext('2d')
  if (ctx) {
    const x0 = p.inicioMm - 5, x1 = p.fimMm + 5
    const ex = (largura - 2 * margem) / (x1 - x0)
    const topo = 46, fundo = altura - 34
    const ey = (fundo - topo) / p.sobreposicaoMm
    ctx.fillStyle = '#141a1d'
    ctx.fillRect(0, 0, largura, altura)
    // Chapa de baixo (onde a liga deveria ter molhado).
    ctx.fillStyle = '#3a4146'
    ctx.fillRect(margem, topo, (x1 - x0) * ex, p.sobreposicaoMm * ey)
    for (let j = 0; j < NY; j++) {
      const y = Y0 + (j + 0.5) * DY
      if (!m.naSobreposicao(y)) continue
      for (let i = 0; i < NX; i++) {
        const x = (i + 0.5) * DX
        if (x < x0 || x > x1) continue
        const k = j * NX + i
        const cheio = Math.min(1, m.solida[k] + m.liquida[k])
        if (cheio < 0.05) continue
        ctx.globalAlpha = Math.min(1, 0.25 + cheio)
        ctx.fillStyle = corLiga
        ctx.fillRect(margem + (x - DX / 2 - x0) * ex, topo + (-y - DY / 2) * ey, DX * ex + 0.5, DY * ey + 0.5)
        if (m.poros[k] > 0.15) {
          ctx.globalAlpha = Math.min(1, m.poros[k] * 1.5)
          ctx.fillStyle = '#0b0d0e'
          ctx.beginPath()
          ctx.arc(margem + (x - x0) * ex, topo + -y * ey, Math.min(DX * ex, DY * ey) * 0.45, 0, 2 * Math.PI)
          ctx.fill()
        }
      }
    }
    ctx.globalAlpha = 1
    // Filete na borda, em cima: altura pela seção.
    ctx.fillStyle = corLiga
    for (let i = 0; i < NX; i++) {
      const x = (i + 0.5) * DX
      if (x < x0 || x > x1 || m.filete[i] <= 0.02) continue
      const alturaFilete = Math.min(14, 5 * Math.sqrt(m.filete[i]))
      ctx.fillRect(margem + (x - DX / 2 - x0) * ex, topo - 2 - alturaFilete, DX * ex + 0.5, alturaFilete)
    }
    // Liga embolada (não molhou): bolas sobre a borda.
    ctx.fillStyle = '#8a8f93'
    for (let i = 0; i < NX; i++) {
      const v = m.embolada[i]
      if (v < 0.3) continue
      ctx.beginPath()
      ctx.arc(margem + ((i + 0.5) * DX - x0) * ex, topo - 18, Math.min(7, 2 + Math.cbrt(v) * 2), 0, 2 * Math.PI)
      ctx.fill()
    }
    // Trecho exigido e legendas.
    ctx.strokeStyle = '#ffc440'
    ctx.setLineDash([4, 3])
    for (const x of [p.inicioMm, p.fimMm]) { ctx.beginPath(); ctx.moveTo(margem + (x - x0) * ex, topo - 26); ctx.lineTo(margem + (x - x0) * ex, fundo + 4); ctx.stroke() }
    ctx.setLineDash([])
    ctx.fillStyle = '#cfd6da'
    ctx.font = '12px Consolas, monospace'
    ctx.textAlign = 'right'
    ctx.fillText('↑ BORDA (filete em cima)', largura - margem, altura - 8)
    ctx.textAlign = 'start'
    ctx.fillText(`↓ FIM DA SOBREPOSIÇÃO (${p.sobreposicaoMm} mm)`, margem, altura - 8)
    ctx.textAlign = 'center'
    ctx.fillText(`INÍCIO ${p.inicioMm} mm`, margem + (p.inicioMm - x0) * ex, topo - 30)
    ctx.fillText(`FIM ${p.fimMm} mm`, margem + (p.fimMm - x0) * ex, topo - 30)
    ctx.textAlign = 'start'
  }
  return h('figure', { class: 'figura-corte-brasagem' }, c,
    h('figcaption', {}, 'Chapa de cima arrancada, como no ensaio de arrancamento: em cor da liga, onde ela molhou; em cinza escuro, vazios; pontos pretos, poros. A profundidade está ampliada.'))
}
