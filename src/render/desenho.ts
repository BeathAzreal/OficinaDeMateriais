import { requisitosEfetivos, type Dificuldade, type Missao } from '../missoes/catalogo'

/*
 * Desenho da missão em SVG: vista de cima e corte das chapas, com cotas.
 * É um esquema próprio do jogo — NÃO segue a norma de símbolos de soldagem.
 */

const f = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function desenhoMissao(m: Missao, d: Dificuldade): string {
  const req = requisitosEfetivos(m, d)
  const { comprimentoMm: L, larguraChapaMm: W, espessuraMm: e, aberturaMm: a } = m.geometria
  const k = 2.4 // px/mm na vista de cima
  const ox = 70
  const oy = 48
  const px = (x: number) => ox + x * k
  const py = (y: number) => oy + (y + W) * k // y = 0 é a junta
  const jy = py(0)

  // Corte: escala exagerada para a espessura aparecer.
  const ks = 9
  const cx = 560
  const cy = 190
  const meiaVista = 12 // mm de chapa mostrados de cada lado
  const sx = (u: number) => cx + u * ks
  const sz = (z: number) => cy - z * ks

  const cota = (x1: number, y1: number, x2: number, y2: number, texto: string, dx = 0, dy = -6) => `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="cota" marker-start="url(#seta)" marker-end="url(#seta)"/>
    <text x="${(x1 + x2) / 2 + dx}" y="${(y1 + y2) / 2 + dy}" class="texto-cota">${texto}</text>`

  const cordaoMeio = (req.larguraMinMm + req.larguraMaxMm) / 4
  const hCord = req.reforcoMaxMm * 0.8

  return `
<svg viewBox="0 0 760 350" class="desenho" role="img" aria-label="Desenho da missão ${m.titulo}: duas chapas de ${f(L)} por ${f(W)} milímetros e ${f(e)} de espessura, junta de topo com abertura de ${f(a)}; soldar de ${f(m.trecho.inicioMm)} a ${f(m.trecho.fimMm)} milímetros.">
  <defs>
    <marker id="seta" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M0,1 L9,5 L0,9" fill="none" stroke="currentColor" stroke-width="1.4"/>
    </marker>
    <pattern id="hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-width="1" opacity="0.5"/>
    </pattern>
  </defs>
  <text x="${ox}" y="22" class="titulo-desenho">VISTA DE CIMA</text>
  <rect x="${px(0)}" y="${py(-W)}" width="${L * k}" height="${W * k - (a * k) / 2}" class="peca"/>
  <rect x="${px(0)}" y="${jy + (a * k) / 2}" width="${L * k}" height="${W * k - (a * k) / 2}" class="peca"/>
  <line x1="${px(m.trecho.inicioMm)}" y1="${jy}" x2="${px(m.trecho.fimMm)}" y2="${jy}" class="linha-solda"/>
  <line x1="${px(m.trecho.inicioMm)}" y1="${jy - 16}" x2="${px(m.trecho.inicioMm)}" y2="${jy + 16}" class="marca"/>
  <line x1="${px(m.trecho.fimMm)}" y1="${jy - 16}" x2="${px(m.trecho.fimMm)}" y2="${jy + 16}" class="marca"/>
  ${cota(px(0), oy - 14, px(L), oy - 14, `${f(L)}`)}
  ${cota(px(0), jy + W * k * 0.55, px(m.trecho.inicioMm), jy + W * k * 0.55, `${f(m.trecho.inicioMm)}`, 0, -5)}
  ${cota(px(m.trecho.inicioMm), jy + W * k * 0.75, px(m.trecho.fimMm), jy + W * k * 0.75, `cordão ${f(m.trecho.fimMm - m.trecho.inicioMm)}`, 0, -5)}
  ${cota(ox - 22, py(-W), ox - 22, jy, `${f(W)}`, -16, 4)}
  ${cota(ox - 22, jy, ox - 22, py(W), `${f(W)}`, -16, 4)}
  <text x="${px(L) + 8}" y="${jy - 6}" class="texto-nota">junta</text>
  <text x="${px(L) + 8}" y="${jy + 8}" class="texto-nota">de topo</text>

  <text x="${cx - meiaVista * ks}" y="22" class="titulo-desenho">CORTE (esquema)</text>
  <rect x="${sx(-meiaVista)}" y="${sz(0)}" width="${(meiaVista - a / 2) * ks}" height="${e * ks}" class="peca" fill="url(#hachura)"/>
  <rect x="${sx(a / 2)}" y="${sz(0)}" width="${(meiaVista - a / 2) * ks}" height="${e * ks}" class="peca" fill="url(#hachura)"/>
  <path d="M ${sx(-cordaoMeio)} ${sz(0)} Q ${sx(0)} ${sz(2 * hCord)} ${sx(cordaoMeio)} ${sz(0)}" class="cordao-esquema"/>
  ${cota(sx(-req.larguraMaxMm / 2), sz(req.reforcoMaxMm + 2.6), sx(req.larguraMaxMm / 2), sz(req.reforcoMaxMm + 2.6), `largura ${f(req.larguraMinMm)}–${f(req.larguraMaxMm)}`)}
  ${cota(sx(meiaVista + 1.2), sz(0), sx(meiaVista + 1.2), sz(-e), `${f(e)}`, 22, 4)}
  ${cota(sx(-a / 2), sz(-e - 1.6), sx(a / 2), sz(-e - 1.6), `abertura ${f(a)}`, 0, 16)}
  <line x1="${sx(cordaoMeio)}" y1="${sz(hCord)}" x2="${sx(cordaoMeio + 5)}" y2="${sz(hCord + 2)}" class="cota"/>
  <text x="${sx(cordaoMeio + 5.3)}" y="${sz(hCord + 2) + 4}" class="texto-cota">reforço ≤ ${f(req.reforcoMaxMm)}</text>

  <text x="${ox}" y="${py(W) + 30}" class="texto-nota">Medidas em mm. Centro do cordão a até ${f(req.alinhamentoMm)} mm da linha da junta.</text>
  <text x="${ox}" y="${py(W) + 46}" class="texto-nota">Desenho didático do jogo: requisitos fictícios; não segue a norma de símbolos de soldagem.</text>
</svg>`
}
