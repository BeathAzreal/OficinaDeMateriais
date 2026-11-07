/**
 * Desenho esquemático de micrografias e do mapa da seção.
 * As imagens são geradas a partir da zona verdadeira em cada ponto e dos achados da aquisição;
 * a textura (grãos, lamelas, ripas) é ilustrativa, não uma simulação de microestrutura.
 */
import type { Ampliacao, CasoDefinicao, ZonaDef } from '../../casos/tipos';
import type { Amostra, AquisicaoMicrografia, Preparo } from '../../motor/tipos';
import { pontoNaPeca, pontoNaSecao, zonaEm, contornoSecao } from '../../motor/geometria';
import { excessoRiscos, temArrancamento } from '../../motor/metalografia';
import { hashInt, hashValores, unitario } from '../../motor/rng';
import { desenharBarraEscala, fbm, mapaJanela, paraPx, type Mapa } from './comum';

interface Vor {
  id: number;
  d1: number;
  d2: number;
}

function voronoi(gx: number, gy: number, semente: number): Vor {
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let d1 = 99;
  let d2 = 99;
  let id = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const h = hashInt(cx, cy, semente);
      const px = cx + 0.08 + unitario(h) * 0.84;
      const py = cy + 0.08 + unitario(hashInt(h, 7, semente)) * 0.84;
      const d = (px - gx) * (px - gx) + (py - gy) * (py - gy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = h;
      } else if (d < d2) d2 = d;
    }
  }
  return { id, d1: Math.sqrt(d1), d2: Math.sqrt(d2) };
}

const SEMENTE_ZONA: Record<string, number> = {};
function sementeZona(id: string): number {
  if (!(id in SEMENTE_ZONA)) SEMENTE_ZONA[id] = hashValores('zona', id) & 0xffff;
  return SEMENTE_ZONA[id];
}

/** Tom (0–1) de uma zona atacada no ponto (u, v) em mm; esc = px/mm. */
function tomAtacado(def: ZonaDef, zid: number, u: number, v: number, esc: number, fatorBorda: number): number {
  // contornos com ~1 µm (ou 1 px), independentemente do tamanho de grão
  const bw = Math.max(1.1 / esc, Math.min(def.tamanhoGrao * 0.035, 0.0009)) * fatorBorda;
  switch (def.estilo) {
    case 'ferrita-perlita':
    case 'ferrita-perlita-parcial':
    case 'zf-refinada': {
      const c = def.tamanhoGrao;
      const vo = voronoi(u / c, v / c, zid);
      const borda = (vo.d2 - vo.d1) * c * 0.5 < bw;
      const escuro = unitario(hashInt(vo.id, 3, zid)) < def.fracaoEscura;
      if (escuro) {
        if (def.estilo === 'ferrita-perlita-parcial') {
          return 0.42 + 0.3 * unitario(hashInt(Math.floor(u / 0.002), Math.floor(v / 0.002), zid));
        }
        if (esc > 1500) {
          const th = unitario(hashInt(vo.id, 5, zid)) * Math.PI;
          const s = Math.sin(((u * Math.cos(th) + v * Math.sin(th)) / 0.0011) * 2 * Math.PI);
          return 0.36 + 0.17 * s;
        }
        return 0.3 + 0.05 * unitario(hashInt(vo.id, 6, zid));
      }
      if (borda) return 0.3;
      return 0.86 + 0.06 * (unitario(hashInt(vo.id, 9, zid)) - 0.5);
    }
    case 'martensita':
    case 'martensita-revenida': {
      const rev = def.estilo === 'martensita-revenida';
      const c = def.tamanhoGrao;
      const vo = voronoi(u / c, v / c, zid);
      if ((vo.d2 - vo.d1) * c * 0.5 < bw * 1.2) return 0.2;
      const c2 = c / 3.5;
      const pk = voronoi(u / c2, v / c2, zid + 11);
      const th = unitario(hashInt(pk.id, vo.id & 0xffff, 1)) * Math.PI;
      const s = Math.sin(((u * Math.cos(th) + v * Math.sin(th)) / 0.0026) * 2 * Math.PI);
      let t = 0.5 + (unitario(hashInt(pk.id, 2, zid)) - 0.5) * 0.16 + (rev ? 0.07 : 0.15) * s;
      if (rev) {
        t += 0.06;
        if (unitario(hashInt(Math.floor(u / 0.003), Math.floor(v / 0.003), zid + 5)) < 0.12) t -= 0.2;
      }
      return t;
    }
    case 'zf-colunar': {
      const c = def.tamanhoGrao;
      const vo = voronoi(u / c, v / (c * 3), zid);
      const distBorda = (vo.d2 - vo.d1) * c * 0.5;
      if (distBorda < Math.max(0.006, bw)) return distBorda < bw * 0.5 ? 0.35 : 0.88;
      const pk = voronoi(u / 0.009, v / 0.009, zid + 3);
      const th = unitario(hashInt(pk.id, 4, zid)) * Math.PI;
      const s = Math.sin(((u * Math.cos(th) + v * Math.sin(th)) / 0.0024) * 2 * Math.PI);
      return 0.56 + 0.2 * s;
    }
  }
}

function emInclusao(u: number, v: number, def: ZonaDef, aoLongoDeU: boolean): boolean {
  if (def.inclusoes <= 0) return false;
  const cel = 0.12;
  const iu = Math.floor(u / cel);
  const iv = Math.floor(v / cel);
  const p = def.inclusoes * cel * cel;
  for (let du = -1; du <= 1; du++) {
    const h = hashInt(iu + du, iv, 913);
    if (unitario(h) > p) continue;
    const cu = (iu + du + unitario(hashInt(h, 1, 2))) * cel;
    const cv = (iv + unitario(hashInt(h, 3, 4))) * cel;
    const L = aoLongoDeU ? 0.02 + 0.05 * unitario(hashInt(h, 5, 6)) : 0.006;
    const W = 0.0028;
    const a = (u - cu) / (L / 2);
    const b = (v - cv) / (W / 2);
    if (a * a + b * b < 1) return true;
  }
  return false;
}

function emArrancamento(u: number, v: number, semente: number): boolean {
  const cel = 0.08;
  const iu = Math.floor(u / cel);
  const iv = Math.floor(v / cel);
  for (let du = -1; du <= 1; du++) {
    for (let dv = -1; dv <= 1; dv++) {
      const h = hashInt(iu + du, iv + dv, semente);
      if (unitario(h) > 0.5) continue;
      const cu = (iu + du + unitario(hashInt(h, 1, 9))) * cel;
      const cv = (iv + dv + unitario(hashInt(h, 2, 9))) * cel;
      const r0 = 0.004 + 0.009 * unitario(hashInt(h, 3, 9));
      const ang = Math.atan2(v - cv, u - cu);
      const r = r0 * (1 + 0.35 * Math.sin(3 * ang + unitario(h) * 6) + 0.2 * Math.sin(5 * ang));
      if ((u - cu) * (u - cu) + (v - cv) * (v - cv) < r * r) return true;
    }
  }
  return false;
}

const RISCO: Record<Preparo['lixamento'], { s: number; w: number }> = {
  'lixa-220': { s: 0.02, w: 0.006 },
  'lixa-600': { s: 0.012, w: 0.003 },
  'lixa-1200': { s: 0.007, w: 0.0018 },
};

function escreverPixel(d: Uint8ClampedArray, i: number, t: number): void {
  const x = Math.max(0, Math.min(1, t));
  d[i] = 255 * x;
  d[i + 1] = 247 * x;
  d[i + 2] = 230 * x;
  d[i + 3] = 255;
}

const RESINA: [number, number, number] = [34, 32, 38];

export interface OpcoesMicro {
  /** Esconde rótulos (miniaturas). */
  semRotulo?: boolean;
}

export function desenharMicrografia(
  canvas: HTMLCanvasElement,
  caso: CasoDefinicao,
  amostra: Amostra,
  preparo: Preparo,
  aq: Pick<AquisicaoMicrografia, 'janela' | 'ampliacao' | 'achados'>,
  opcoes: OpcoesMicro = {},
): Mapa {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const mapa = mapaJanela(aq.janela, W, H);
  const esc = mapa.escala;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const g = caso.verdade.geometria;
  const atacado = preparo.ataque !== 'nenhum';
  const sobre = preparo.ataque === 'nital-30s';
  const macro = esc < 60;
  const excesso = excessoRiscos(preparo, aq.ampliacao as Ampliacao);
  const sem = hashValores('prep', preparo.id) & 0xffff;
  const risco = RISCO[preparo.lixamento];
  const th1 = unitario(hashInt(sem, 1, 1)) * Math.PI;
  const th2 = th1 + 0.35;
  const contrasteRisco = excesso > 0 ? Math.min(1, Math.max(0.2, excesso)) * 0.38 : 0;
  const arrancamento = temArrancamento(preparo) && !macro;
  const poros = aq.achados.filter((a) => a.forma === 'circulos').flatMap((a) => a.marcadores);
  const aoLongoDeU = amostra.orientacao === 'transversal';

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const u = mapa.u0 + (px + 0.5 - mapa.ox) / esc;
      const v = mapa.v0 + (py + 0.5 - mapa.oy) / esc;
      if (!pontoNaSecao(caso, amostra, u, v)) {
        const n = 0.9 + 0.1 * unitario(hashInt(px, py, 5));
        d[i] = RESINA[0] * n;
        d[i + 1] = RESINA[1] * n;
        d[i + 2] = RESINA[2] * n;
        d[i + 3] = 255;
        continue;
      }
      const p = pontoNaPeca(amostra, u, v);
      const zona = zonaEm(g, p.x, p.y, p.z) ?? 'mb';
      const def = caso.verdade.zonas[zona];
      let t: number;
      if (macro) {
        t = atacado ? def.tomMacro + 0.05 * (fbm(u * 2, v * 2, 3) - 0.5) : 0.76 + 0.04 * (fbm(u, v, 4) - 0.5);
        if (sobre) t = t * 0.62;
      } else if (atacado) {
        t = tomAtacado(def, sementeZona(zona), u, v, esc, sobre ? 2.5 : 1);
        if (sobre) t = t * 0.6 - 0.03;
        if (emInclusao(u, v, def, aoLongoDeU)) t = Math.min(t, 0.42);
      } else {
        t = 0.82 + 0.03 * (unitario(hashInt(px >> 2, py >> 2, 11)) - 0.5);
        if (emInclusao(u, v, def, aoLongoDeU)) t = 0.46;
      }
      for (const c of poros) {
        const dd = (u - c.u) * (u - c.u) + (v - c.v) * (v - c.v);
        if (dd < c.raio * c.raio) {
          t = dd > c.raio * c.raio * 0.8 ? 0.22 : 0.05;
          break;
        }
      }
      if (arrancamento && emArrancamento(u, v, sem)) t = 0.07;
      if (contrasteRisco > 0) {
        const larg = Math.max(risco.w, 0.9 / esc);
        const n = Math.max(1, Math.ceil(1.5 / (risco.s * esc)));
        for (const th of [th1, th2]) {
          const proj = u * Math.cos(th) + v * Math.sin(th);
          const idx = Math.floor(proj / risco.s);
          if (idx % n !== 0) continue;
          if (unitario(hashInt(idx, th === th1 ? 1 : 2, sem)) > (th === th1 ? 0.55 : 0.2)) continue;
          const frac = proj - idx * risco.s - risco.s / 2;
          if (Math.abs(frac) < larg / 2) t -= contrasteRisco * (th === th1 ? 1 : 0.7);
        }
      }
      escreverPixel(d, i, t);
    }
  }
  ctx.putImageData(img, 0, 0);

  // trincas (polilinhas)
  for (const a of aq.achados) {
    if (a.forma !== 'linha' || a.marcadores.length < 2) continue;
    ctx.save();
    ctx.strokeStyle = sobre ? 'rgba(20,16,14,0.55)' : a.qualidade === 'nitida' ? 'rgba(8,6,5,0.95)' : 'rgba(25,20,18,0.7)';
    ctx.lineWidth = Math.max(1.3, 0.004 * esc);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    a.marcadores.forEach((m, k) => {
      // pequeno desvio determinístico para dar aspecto sinuoso
      const j = (unitario(hashInt(k, 3, 77)) - 0.5) * 0.012;
      const [x, y] = paraPx(mapa, m.u + j, m.v);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  if (!opcoes.semRotulo) desenharBarraEscala(ctx, esc, `Esquemático · ${aq.ampliacao}× · ${preparo.id}`);
  return mapa;
}

/**
 * Mapa da seção inteira (como vista a olho nu): contorno e, se atacada, tons das zonas.
 * Usado para escolher campos e posicionar indentações.
 */
export function desenharSecao(
  canvas: HTMLCanvasElement,
  caso: CasoDefinicao,
  amostra: Amostra,
  preparo: Preparo | null,
): Mapa {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const g = caso.verdade.geometria;
  const janela = {
    u: [amostra.extensao[0] - 1, amostra.extensao[1] + 1] as [number, number],
    v: [-4.5, g.espessura + 2.5] as [number, number],
  };
  const mapa = mapaJanela(janela, W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const atacado = preparo && preparo.ataque !== 'nenhum';
  const sobre = preparo?.ataque === 'nital-30s';
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const u = mapa.u0 + (px + 0.5 - mapa.ox) / mapa.escala;
      const v = mapa.v0 + (py + 0.5 - mapa.oy) / mapa.escala;
      if (!pontoNaSecao(caso, amostra, u, v)) {
        d[i] = RESINA[0];
        d[i + 1] = RESINA[1];
        d[i + 2] = RESINA[2];
        d[i + 3] = 255;
        continue;
      }
      let t = 0.74 + 0.03 * (fbm(u, v, 4) - 0.5);
      if (atacado) {
        const p = pontoNaPeca(amostra, u, v);
        const z = zonaEm(g, p.x, p.y, p.z) ?? 'mb';
        t = caso.verdade.zonas[z].tomMacro + 0.03 * (fbm(u * 2, v * 2, 3) - 0.5);
        if (sobre) t *= 0.62;
      }
      escreverPixel(d, i, t);
    }
  }
  ctx.putImageData(img, 0, 0);
  // contorno
  const cont = contornoSecao(caso, amostra);
  if (cont.length) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    cont.forEach(([u, v], k) => {
      const [x, y] = paraPx(mapa, u, v);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  return mapa;
}
