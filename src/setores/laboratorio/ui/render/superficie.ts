/**
 * Desenho esquemático das superfícies na inspeção visual (fratura e superfícies externas).
 * O contraste de cada feição depende da limpeza e da luz, e só é forte quando o achado
 * correspondente está presente na aquisição — imagem e dados vêm do mesmo modelo.
 */
import type { CasoDefinicao } from '../../casos/tipos';
import type { AquisicaoVisual } from '../../motor/tipos';
import { alturaReforcoFace, meiaLarguraFusao, xFraturaFace } from '../../motor/geometria';
import { hashInt, unitario } from '../../motor/rng';
import { desenharBarraEscala, fbm, mapaJanela, paraPx, type Mapa } from './comum';

type RGB = [number, number, number];
const FUNDO: RGB = [22, 27, 34];

function mistura(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function soma(a: RGB, k: number): RGB {
  return [a[0] + k, a[1] + k, a[2] + k];
}

function removido(aq: AquisicaoVisual, u: number, v: number): boolean {
  return aq.removidos.some((r) => u >= r.u[0] && u <= r.u[1] && v >= r.v[0] && v <= r.v[1]);
}

export function desenharSuperficie(canvas: HTMLCanvasElement, caso: CasoDefinicao, aq: AquisicaoVisual, semRotulo = false): Mapa {
  const ctx = canvas.getContext('2d')!;
  const W = canvas.width;
  const H = canvas.height;
  const mapa = mapaJanela(aq.janela, W, H);
  const sup = caso.publico.superficies.find((s) => s.id === aq.superficie)!;
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const ids = new Set(aq.achados.map((a) => a.achadoId));
  const pixel = sup.tipo === 'fratura' ? pixelFratura(caso, aq, ids) : pixelExterno(caso, aq, ids);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const u = mapa.u0 + (px + 0.5 - mapa.ox) / mapa.escala;
      const v = mapa.v0 + (py + 0.5 - mapa.oy) / mapa.escala;
      let c = pixel(u, v, px, py, mapa.escala);
      if (c !== FUNDO && removido(aq, u, v)) {
        const listra = Math.floor((u + v) * 1.2) % 2 === 0;
        c = listra ? [58, 62, 70] : [44, 48, 56];
      }
      const i = (py * W + px) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // marcação estampada (texto em relevo)
  if (sup.id === 'metal-base' && aq.vista === 'detalhe') {
    const m = caso.verdade.superficieExterna.marcacao;
    const ach = aq.achados.find((a) => a.achadoId === 'vm-marcacao');
    if (ach) {
      const [x, y] = paraPx(mapa, m.x, m.y);
      const txt = ach.qualidade === 'nitida' ? m.texto : m.texto.replace(/7(?=3)/, '?');
      ctx.save();
      ctx.font = `bold ${Math.round(3 * mapa.escala)}px ui-monospace, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillText(txt, x - 1.5, y - 1.5);
      ctx.fillStyle = ach.qualidade === 'nitida' ? 'rgba(20,20,22,0.75)' : 'rgba(40,52,46,0.55)';
      ctx.fillText(txt, x, y);
      ctx.restore();
    }
  }
  if (!semRotulo) {
    desenharBarraEscala(ctx, mapa.escala, `Esquemático · ${aq.vista === 'geral' ? 'visão geral' : 'estereoscópio ~10×'} · ${aq.iluminacao === 'rasante' ? 'luz rasante' : 'luz difusa'}`);
  }
  return mapa;
}

function pixelFratura(caso: CasoDefinicao, aq: AquisicaoVisual, ids: Set<string>) {
  const g = caso.verdade.geometria;
  const sf = caso.verdade.superficieFratura;
  const T = g.espessura;
  const L = g.largura;
  const rasante = aq.iluminacao === 'rasante';
  const limp = aq.limpeza;
  const cb = rasante ? { suave: 1, 'como-recebida': 0.35, agressiva: 0.3 }[limp] : { suave: 0.4, 'como-recebida': 0.05, agressiva: 0.15 }[limp];
  const escuraNitida = ids.has('vf-origem-escura');
  const catracas = ids.has('vf-catracas');

  return (u: number, v: number, px: number, py: number, esc: number): RGB => {
    if (u < 0 || u > L || v < 0 || v > T) return FUNDO;
    const du = (u - sf.origem.u) / sf.raioU;
    const dv = (v - sf.origem.v) / sf.raioV;
    const r = Math.sqrt(du * du + dv * dv);
    const fadiga = r < 1;
    let c: RGB;
    if (fadiga) {
      c = soma([98, 86, 74], (r - 0.5) * 30 + (fbm(u * 1.5, v * 1.5, 7) - 0.5) * 14);
    } else {
      const fibra = (fbm(u * 9, v * 9, 9) - 0.5) * 34 + (unitario(hashInt(px, py, 3)) - 0.5) * (esc > 20 ? 26 : 10);
      c = soma([150, 147, 143], fibra);
      const lb = sf.larguraLabios;
      const labio = Math.min(v, T - v, L - u);
      if (labio < lb) c = soma([176, 173, 168], (labio / lb) * 18 - 8 + (rasante ? (v < T / 2 ? 22 : -18) : 0));
    }
    // região escura da origem
    const re = sf.regiaoEscura;
    const cu = (re.u[0] + re.u[1]) / 2;
    const hu = (re.u[1] - re.u[0]) / 2;
    const e = ((u - cu) / hu) ** 2 + (v / re.profundidade) ** 2;
    if (e < 1 && limp !== 'agressiva') {
      const granular = (unitario(hashInt(Math.floor(u / 0.07), Math.floor(v / 0.07), 21)) - 0.5) * 26;
      const forca = escuraNitida ? (rasante ? 0.45 : 0.9) : limp === 'suave' ? 0.3 : 0.1;
      c = mistura(c, soma([56, 46, 40], granular), forca);
    }
    // marcas de praia
    if (fadiga && cb > 0) {
      const grad = Math.sqrt((du / sf.raioU) ** 2 + (dv / sf.raioV) ** 2) / Math.max(r, 1e-6);
      const w = Math.max(0.1, 1.1 / esc);
      for (const f of sf.marcasPraia) {
        const dmm = (r - f) / Math.max(grad, 1e-6);
        if (Math.abs(dmm) < w) {
          if (rasante) c = soma(c, (dmm < 0 ? 42 : -42) * cb);
          else c = soma(c, -30 * cb);
          break;
        }
      }
    }
    // catracas
    if (catracas && v < 1.4) {
      for (const cu2 of sf.catracas) {
        const dd = u - cu2;
        if (Math.abs(dd) < Math.max(0.05, 0.8 / esc)) {
          c = soma(c, rasante ? (dd < 0 ? 45 : -45) : -20);
          break;
        }
      }
    }
    // iluminação
    if (rasante) c = soma(mistura(c, [0, 0, 0], 0.18), (1 - v / T) * 26);
    // sujeira
    if (limp === 'como-recebida') {
      const a = 0.35 + 0.35 * fbm(u * 0.6, v * 0.6, 31);
      c = mistura(c, soma([84, 74, 60], (fbm(u * 3, v * 3, 5) - 0.5) * 20), a);
    }
    // escovação agressiva
    if (limp === 'agressiva') {
      c = mistura(c, [146, 144, 140], 0.45);
      const proj = u * Math.cos(0.26) + v * Math.sin(0.26);
      const idx = Math.floor(proj / 0.18);
      if (Math.abs(proj - idx * 0.18 - 0.09) < Math.max(0.03, 0.6 / esc) && unitario(hashInt(idx, 2, 8)) < 0.6) c = soma(c, 38);
    }
    return c;
  };
}

function pixelExterno(caso: CasoDefinicao, aq: AquisicaoVisual, ids: Set<string>) {
  const g = caso.verdade.geometria;
  const se = caso.verdade.superficieExterna;
  const rasante = aq.iluminacao === 'rasante';
  const limp = aq.limpeza;
  const raiz = aq.superficie === 'raiz-cordao';
  const hw0 = meiaLarguraFusao(g, 0);
  const hwR = g.meiaLarguraRaiz;
  const xGap0 = raiz ? g.fratura.xPlano : xFraturaFace(g);
  const xGap1 = xGap0 + 1.2;
  const linhaPe = ids.has('vc-linha-pe-A');
  const pintado = limp === 'como-recebida';

  return (u: number, v: number, px: number, py: number, esc: number): RGB => {
    if (v < 0 || v > g.largura) return FUNDO;
    if (u >= xGap0 && u <= xGap1) return [12, 14, 18];
    const ux = u > xGap1 ? u - 1.2 : u; // fragmento B deslocado na bancada
    const pertoFratura = Math.abs(u - xGap0) < 4 || Math.abs(u - xGap1) < 4;
    // chapa
    let c: RGB;
    const ferrugem = fbm(u * 0.25, v * 0.25, 41);
    if (pintado && !(pertoFratura && fbm(u, v, 3) > 0.45)) {
      c = soma([76, 96, 86], (fbm(u * 0.8, v * 0.8, 2) - 0.5) * 12);
      if (aq.superficie === 'metal-base' && ferrugem > 0.68) c = mistura(c, [128, 86, 58], Math.min(1, (ferrugem - 0.68) * 6));
    } else {
      c = soma([124, 122, 118], (fbm(u * 0.5, v * 0.5, 6) - 0.5) * 30);
      if (ferrugem > 0.62) c = mistura(c, [120, 82, 56], Math.min(0.7, (ferrugem - 0.62) * 4));
      if (limp === 'agressiva') {
        const idx = Math.floor((u * 0.97 + v * 0.24) / 0.25);
        if (unitario(hashInt(idx, 4, 4)) < 0.4) c = soma(c, 24);
      }
    }
    // cordão
    const hwc = raiz ? hwR : hw0;
    if (aq.superficie !== 'metal-base' && Math.abs(ux) < hwc && u < xGap0) {
      const h = raiz ? 1 : alturaReforcoFace(g, ux, v) / g.alturaReforcoFace;
      const onda = Math.sin(((v + 0.6 * Math.abs(ux)) / 1.1) * 2 * Math.PI);
      let relevo = onda * (rasante ? 22 : 9) + (h - 0.6) * 20;
      if (!raiz && v >= g.reinicio.y[0] && v <= g.reinicio.y[1]) relevo += (fbm(ux * 1.5, v * 1.5, 12) - 0.5) * 50 + (rasante ? 18 : 8);
      // a tinta cobre a cor do metal, mas o relevo continua visível
      c = pintado ? soma([84, 102, 92], relevo * 0.8) : soma([138, 134, 126], relevo);
    }
    // pé do cordão: sombra
    if (aq.superficie !== 'metal-base') {
      const dp = Math.abs(Math.abs(ux) - hwc);
      if (dp < Math.max(0.12, 1 / esc) && u < xGap0) c = soma(c, rasante ? -40 : -12);
      // mordedura no lado A
      if (!raiz && ux < -hw0 && ux > -hw0 - 0.6 && v >= se.mordeduraA.y[0] && v <= se.mordeduraA.y[1]) {
        const k = pintado ? 0.35 : rasante ? 1 : 0.45;
        c = mistura(c, [36, 34, 32], 0.75 * k);
      }
      if (!raiz && linhaPe && Math.abs(ux + hw0 + 0.03) < Math.max(0.025, 0.7 / esc) && v >= se.linhaPeA.y[0] && v <= se.linhaPeA.y[1]) {
        if (Math.sin(v * 9) > -0.6) c = [18, 16, 15];
      }
      // respingos
      const cel = 2.2;
      const iu = Math.floor(ux / cel);
      const iv = Math.floor(v / cel);
      const hsp = hashInt(iu, iv, raiz ? 88 : 77);
      if (unitario(hsp) < 0.12 && Math.abs(ux) > hwc + 1 && Math.abs(ux) < 24) {
        const cu = (iu + unitario(hashInt(hsp, 1, 1))) * cel;
        const cv = (iv + unitario(hashInt(hsp, 2, 2))) * cel;
        const rr = 0.25 + 0.3 * unitario(hashInt(hsp, 3, 3));
        const dd = Math.hypot(ux - cu, v - cv);
        if (dd < rr) c = soma(pintado ? [86, 104, 94] : [150, 146, 138], rasante ? (1 - dd / rr) * 40 - 10 : 6);
      }
    }
    if (rasante) c = soma(mistura(c, [0, 0, 0], 0.12), ((v / g.largura) - 0.5) * -18);
    void px;
    void py;
    return c;
  };
}
