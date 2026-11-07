import type { SecaoLocal } from '../modelo/cordao'
import type { GeometriaJunta } from '../modelo/junta'
import { PECA } from '../modelo/parametros'

/*
 * Parte PURA da vista 3D (sem Three.js nem DOM): converte o que o modelo
 * sabe — seções do cordão (H3) e formato da junta (H41) — em vértices e
 * triângulos. Só LÊ os dados; nada daqui volta para o modelo ou a pontuação.
 *
 * Sistema do mundo 3D (y para cima, como no Three.js):
 *   x = X − 75  (ao longo da chapa, centrado)
 *   y = altura acima da face de cima da chapa (Z)
 *   z = Y       (lateral; positivo = "para baixo" na vista de cima 2D)
 * Vista de cima com a câmera em +y: x para a direita, z para baixo, igual à tela 2D.
 */

/** Abaixo desta largura a fatia não aparece (o mesmo limiar da vista de cima). */
export const LARGURA_MINIMA_3D_MM = 0.3
/** Pontos de cada perfil transversal do domo (M + 1 vértices por fatia). */
export const DIVISOES_PERFIL = 16

/** Chapa (X, Y) e altura Z → mundo 3D. */
export function paraMundo(X: number, Y: number, Z: number): [number, number, number] {
  return [X - PECA.comprimentoMm / 2, Z, Y]
}

/**
 * Perfil transversal do domo de H3, o mesmo de corte.ts:
 * z = h·(1 − r²), r = 2(u − yCentro)/largura, com u de uma borda à outra.
 */
export function perfilSecao(s: Pick<SecaoLocal, 'larguraMm' | 'alturaMm' | 'yCentroMm'>, divisoes = DIVISOES_PERFIL): { u: number; z: number; r: number }[] {
  const esq = s.yCentroMm - s.larguraMm / 2
  return Array.from({ length: divisoes + 1 }, (_, k) => {
    const u = esq + (s.larguraMm * k) / divisoes
    const r = (2 * (u - s.yCentroMm)) / s.larguraMm
    return { u, z: s.alturaMm * (1 - r * r), r }
  })
}

export interface MalhaCordao {
  posicoes: Float32Array
  /** |r| de cada vértice (0 na crista, 1 na borda): escolhe a cor da camada. */
  raios: Float32Array
  indices: Uint32Array
  /** Trechos contínuos de fatias visíveis: [primeira, última] índice de seção. */
  trechos: [number, number][]
}

/**
 * Malha do cordão: uma fatia por passoMm, com o domo por cima, tampas nas
 * pontas de cada trecho e uma base plana (z = 0). A fatia i está em
 * s = (i + 0,5)·passo; cada trecho começa em i0·passo e termina em
 * (i1 + 1)·passo, para cobrir exatamente o comprimento das fatias.
 */
export function malhaCordao(secoes: readonly SecaoLocal[], passoMm: number, geo: Pick<GeometriaJunta, 'pontoEm'>, divisoes = DIVISOES_PERFIL): MalhaCordao {
  const trechos: [number, number][] = []
  for (let i = 0; i < secoes.length; i++) {
    if (secoes[i].larguraMm < LARGURA_MINIMA_3D_MM) continue
    let j = i
    while (j + 1 < secoes.length && secoes[j + 1].larguraMm >= LARGURA_MINIMA_3D_MM) j++
    trechos.push([i, j])
    i = j
  }

  const pos: number[] = []
  const raios: number[] = []
  const idx: number[] = []
  const vertice = (s: number, u: number, z: number, r: number): number => {
    const p = geo.pontoEm(s, u)
    pos.push(...paraMundo(p.x, p.y, z))
    raios.push(Math.abs(r))
    return raios.length - 1
  }
  const M = divisoes

  for (const [i0, i1] of trechos) {
    // Fatias do trecho: ponta inicial, centros, ponta final.
    const fatias: { s: number; sec: SecaoLocal }[] = [{ s: i0 * passoMm, sec: secoes[i0] }]
    for (let i = i0; i <= i1; i++) fatias.push({ s: (i + 0.5) * passoMm, sec: secoes[i] })
    fatias.push({ s: (i1 + 1) * passoMm, sec: secoes[i1] })
    const perfis = fatias.map((f) => perfilSecao(f.sec, M))

    // Domo: (M + 1) vértices por fatia, compartilhados para a normal ficar suave.
    const base = raios.length
    fatias.forEach((f, j) => perfis[j].forEach((q) => vertice(f.s, q.u, q.z, q.r)))
    for (let j = 0; j + 1 < fatias.length; j++) {
      for (let k = 0; k < M; k++) {
        const a = base + j * (M + 1) + k
        const b = a + 1
        const c = a + (M + 1)
        const d = c + 1
        // Com s → +x e u → +z, (a, b, c) aponta para +y (para cima).
        idx.push(a, b, c, b, d, c)
      }
    }

    // Tampas planas nas pontas (vértices próprios: normal reta).
    for (const [j, sentido] of [[0, -1], [fatias.length - 1, 1]] as const) {
      const f = fatias[j]
      const centro = vertice(f.s, f.sec.yCentroMm, 0, 0)
      const ini = raios.length
      perfis[j].forEach((q) => vertice(f.s, q.u, q.z, q.r))
      for (let k = 0; k < M; k++) {
        // (centro, k, k+1) aponta para +s; a tampa inicial é invertida.
        if (sentido === 1) idx.push(centro, ini + k, ini + k + 1)
        else idx.push(centro, ini + k + 1, ini + k)
      }
    }

    // Base plana entre as bordas (só aparece pela fresta, olhando de baixo).
    const ini = raios.length
    for (const f of fatias) {
      vertice(f.s, f.sec.yCentroMm - f.sec.larguraMm / 2, 0, 1)
      vertice(f.s, f.sec.yCentroMm + f.sec.larguraMm / 2, 0, 1)
    }
    for (let j = 0; j + 1 < fatias.length; j++) {
      const a = ini + 2 * j
      const b = a + 1
      const c = a + 2
      const d = a + 3
      idx.push(a, c, b, b, c, d)
    }
  }

  return { posicoes: new Float32Array(pos), raios: new Float32Array(raios), indices: new Uint32Array(idx), trechos }
}

/**
 * Contorno da fresta (abertura da junta) na chapa, em (X, Y): vai pela borda
 * n = +a/2 e volta pela n = −a/2. Serve de recorte nas juntas que não são
 * retas; na reta são duas chapas separadas.
 */
export function contornoFresta(geo: Pick<GeometriaJunta, 'pontoEm' | 'comprimentoMm'>, aberturaMm: number, passoMm = 0.5): { x: number; y: number }[] {
  const n = Math.round(geo.comprimentoMm / passoMm)
  const ida = Array.from({ length: n + 1 }, (_, k) => geo.pontoEm((k * geo.comprimentoMm) / n, aberturaMm / 2))
  const volta = Array.from({ length: n + 1 }, (_, k) => geo.pontoEm(((n - k) * geo.comprimentoMm) / n, -aberturaMm / 2))
  return [...ida, ...volta]
}
