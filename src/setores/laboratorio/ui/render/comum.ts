/** Mapeamento entre milímetros do plano da imagem e pixels do canvas. */
import type { Faixa } from '../../casos/tipos';

export interface Mapa {
  escala: number; // px por mm
  ox: number;
  oy: number;
  u0: number;
  v0: number;
  largura: number;
  altura: number;
}

/** Ajusta a janela (u, v) ao canvas preservando a proporção (centralizada). */
export function mapaJanela(janela: { u: Faixa; v: Faixa }, largura: number, altura: number): Mapa {
  const du = janela.u[1] - janela.u[0];
  const dv = janela.v[1] - janela.v[0];
  const escala = Math.min(largura / du, altura / dv);
  return {
    escala,
    ox: (largura - du * escala) / 2,
    oy: (altura - dv * escala) / 2,
    u0: janela.u[0],
    v0: janela.v[0],
    largura,
    altura,
  };
}

export function paraPx(m: Mapa, u: number, v: number): [number, number] {
  return [m.ox + (u - m.u0) * m.escala, m.oy + (v - m.v0) * m.escala];
}

export function paraMm(m: Mapa, x: number, y: number): [number, number] {
  return [m.u0 + (x - m.ox) / m.escala, m.v0 + (y - m.oy) / m.escala];
}

/** Ruído suave determinístico (value noise) em coordenadas contínuas. */
export function ruido(x: number, y: number, semente: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const h = (a: number, b: number) => {
    let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(semente, 1442695041);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

export function fbm(x: number, y: number, semente: number, oitavas = 3): number {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < oitavas; i++) {
    s += amp * ruido(x * f, y * f, semente + i * 17);
    amp *= 0.5;
    f *= 2;
  }
  return s / (1 - Math.pow(0.5, oitavas));
}

/** Escolhe um comprimento "redondo" para a barra de escala (mm). */
export function barraEscala(escala: number, alvoPx = 110): { mm: number; rotulo: string } {
  const opcoes = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
  let melhor = opcoes[0];
  for (const o of opcoes) if (o * escala <= alvoPx) melhor = o;
  const rotulo = melhor < 1 ? `${Math.round(melhor * 1000)} µm` : `${melhor} mm`;
  return { mm: melhor, rotulo };
}

export function desenharBarraEscala(ctx: CanvasRenderingContext2D, escala: number, rotuloExtra: string): void {
  const { mm, rotulo } = barraEscala(escala);
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const comp = mm * escala;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  ctx.fillRect(w - comp - 24, h - 34, comp + 16, 26);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(w - comp - 16, h - 16, comp, 3);
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(rotulo, w - comp / 2 - 16, h - 21);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  const larg = ctx.measureText(rotuloExtra).width;
  ctx.fillRect(6, h - 24, larg + 12, 18);
  ctx.fillStyle = '#e8edf2';
  ctx.fillText(rotuloExtra, 12, h - 11);
  ctx.restore();
}
