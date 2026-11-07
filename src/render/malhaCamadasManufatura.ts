import type { Deposito } from '../modelo/manufatura/deposicao'
import { CELULA_MM } from '../modelo/manufatura/deposicao'
import { coordenadasCamadas } from './camadasManufatura'

interface Vertice { x: number; y: number; h: number; camada: number; gx: number; gy: number }
export interface MalhaCamadas { posicoes: Float32Array; camadas: Float32Array; alturas: Float32Array; indices: Uint32Array }

/** Cordão arredondado de tamanho variável por passe; milímetros do desenho. */
export function salienciaCamada(camada: number, x: number, y: number): number {
  const faixa = Math.floor(camada), fase = camada - faixa
  const tamanho = 0.22 + 0.34 * (0.5 + 0.5 * Math.sin(faixa * 2.17 + 0.8))
  const ondas = 0.82 + 0.18 * Math.sin(x * 0.55 + faixa * 1.9) * Math.cos(y * 0.31)
  return tamanho * ondas * Math.sin(Math.PI * fase) ** 2
}

const interpolar = (a: Vertice, b: Vertice, t: number): Vertice => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: a.h + (b.h - a.h) * t,
  camada: a.camada + (b.camada - a.camada) * t,
  gx: a.gx + (b.gx - a.gx) * t, gy: a.gy + (b.gy - a.gy) * t,
})

/** Corta um polígono por uma altura, preservando a orientação das faces. */
function cortar(poligono: Vertice[], h: number, acima: boolean): Vertice[] {
  const saida: Vertice[] = []
  for (let k = 0; k < poligono.length; k++) {
    const a = poligono[k], b = poligono[(k + 1) % poligono.length]
    const dentroA = acima ? a.h >= h : a.h <= h, dentroB = acima ? b.h >= h : b.h <= h
    if (dentroA) saida.push(a)
    if (dentroA !== dentroB) saida.push(interpolar(a, b, (h - a.h) / (b.h - a.h)))
  }
  return saida
}

/** Malha tessellada por planos horizontais comuns: interfaces sem frestas entre células.
 * Apenas representação: não modifica o mapa térmico, colisões ou medidas do modelo.
 */
export function malhaCamadas(d: Deposito): MalhaCamadas {
  const faixas = coordenadasCamadas(d), gx = new Float32Array(d.altura.length), gy = new Float32Array(d.altura.length)
  let topo = 0
  for (let j = 0; j < d.ny; j++) for (let i = 0; i < d.nx; i++) {
    const k = j * d.nx + i, im = Math.max(0, i - 1), ip = Math.min(d.nx - 1, i + 1), jm = Math.max(0, j - 1), jp = Math.min(d.ny - 1, j + 1)
    gx[k] = (d.altura[j * d.nx + ip] - d.altura[j * d.nx + im]) / Math.max(CELULA_MM, (ip - im) * CELULA_MM)
    gy[k] = (d.altura[jp * d.nx + i] - d.altura[jm * d.nx + i]) / Math.max(CELULA_MM, (jp - jm) * CELULA_MM)
    topo = Math.max(topo, d.altura[k])
  }
  // No máximo 128 faixas verticais; detalhe de 0,3 mm nas paredes usuais.
  const passo = Math.max(0.3, topo / 128)
  const pos: number[] = [], camadas: number[] = [], alturas: number[] = [], indices: number[] = []
  const unicos = new Map<string, number>()
  const adicionar = (v: Vertice): number => {
    const chave = `${Math.round(v.x * 1e5)},${Math.round(v.y * 1e5)},${Math.round(v.h * 1e5)}`
    const existente = unicos.get(chave)
    if (existente !== undefined) return existente
    const inclinacao = Math.hypot(v.gx, v.gy), lateral = Math.min(1, inclinacao / 2)
    const pe = Math.min(1, Math.max(0, v.h / 0.5))
    const relevo = salienciaCamada(v.camada, v.x, v.y) * lateral * pe
    const dx = inclinacao > 0 ? -v.gx / inclinacao : 0, dy = inclinacao > 0 ? -v.gy / inclinacao : 0
    const indice = camadas.length
    pos.push((v.x + dx * relevo) / 100, Math.max(0, v.h - relevo * 0.12) / 100, -(v.y + dy * relevo) / 100)
    camadas.push(v.camada); alturas.push(v.h)
    unicos.set(chave, indice)
    return indice
  }
  const triangulo = (a: Vertice, b: Vertice, c: Vertice) => {
    const min = Math.min(a.h, b.h, c.h), max = Math.max(a.h, b.h, c.h)
    if (max < 0.05) return
    const primeiro = Math.floor(min / passo), ultimo = Math.floor(max / passo)
    for (let n = primeiro; n <= ultimo; n++) {
      let p = [a, b, c]
      if (n > primeiro) p = cortar(p, n * passo, true)
      if (n < ultimo) p = cortar(p, (n + 1) * passo, false)
      if (p.length < 3) continue
      const ids = p.map(adicionar)
      for (let i = 1; i + 1 < ids.length; i++) if (ids[0] !== ids[i] && ids[i] !== ids[i + 1] && ids[0] !== ids[i + 1]) indices.push(ids[0], ids[i], ids[i + 1])
    }
  }
  const vertice = (i: number, j: number): Vertice => {
    const k = j * d.nx + i
    return { x: d.x0 + (i + 0.5) * CELULA_MM, y: d.y0 + (j + 0.5) * CELULA_MM, h: d.altura[k], camada: faixas[k], gx: gx[k], gy: gy[k] }
  }
  for (let j = 0; j + 1 < d.ny; j++) for (let i = 0; i + 1 < d.nx; i++) {
    const k = j * d.nx + i
    if (Math.max(d.altura[k], d.altura[k + 1], d.altura[k + d.nx], d.altura[k + d.nx + 1]) < 0.05) continue
    const a = vertice(i, j), b = vertice(i + 1, j), c = vertice(i, j + 1), e = vertice(i + 1, j + 1)
    triangulo(a, b, c); triangulo(b, e, c)
  }
  return { posicoes: new Float32Array(pos), camadas: new Float32Array(camadas), alturas: new Float32Array(alturas), indices: new Uint32Array(indices) }
}
