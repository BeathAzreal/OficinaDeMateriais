/**
 * Geometria de uma junta de topo em V e consultas de zona.
 * Funções puras sobre os parâmetros de `GeometriaJuntaTopo` (sem DOM).
 */
import type { CasoDefinicao, GeometriaJuntaTopo, Faixa } from '../casos/tipos';
import type { Amostra } from './tipos';

const GRAUS = Math.PI / 180;

/** Meia-largura da zona fundida na profundidade z (distância do eixo até a linha de fusão). */
export function meiaLarguraFusao(g: GeometriaJuntaTopo, z: number): number {
  const zc = Math.min(Math.max(z, 0), g.espessura);
  let hw = g.aberturaRaiz / 2 + (g.espessura - zc) * Math.tan(g.anguloBisel * GRAUS);
  if (zc < 1.5) hw += ((1.5 - zc) / 1.5) * g.sobreposicaoFace;
  const zRaiz = g.espessura - 1.5;
  if (zc > zRaiz) hw += ((zc - zRaiz) / 1.5) * (g.meiaLarguraRaiz - g.aberturaRaiz / 2);
  return hw;
}

/** Altura do reforço do cordão acima da face (mm, positiva) em (x, y). */
export function alturaReforcoFace(g: GeometriaJuntaTopo, x: number, y: number): number {
  const hw0 = meiaLarguraFusao(g, 0);
  if (Math.abs(x) >= hw0) return 0;
  const noReinicio = y >= g.reinicio.y[0] && y <= g.reinicio.y[1];
  const h = g.alturaReforcoFace + (noReinicio ? g.reinicio.alturaExtra : 0);
  const t = x / hw0;
  // Perfil um pouco mais "abrupto" no reinício (pé mais íngreme).
  const expoente = noReinicio ? 4 : 2;
  return h * (1 - Math.pow(Math.abs(t), expoente));
}

export function alturaReforcoRaiz(g: GeometriaJuntaTopo, x: number): number {
  const hr = g.meiaLarguraRaiz;
  if (Math.abs(x) >= hr) return 0;
  const t = x / hr;
  return g.alturaReforcoRaiz * (1 - t * t);
}

/**
 * Posição x da superfície de fratura (borda da parte A) em (y, z).
 * Perto da face a fratura acompanha a ZTA de grãos grosseiros; abaixo, segue um plano.
 * A rugosidade é maior e "facetada" na região da origem (trajeto intergranular).
 */
export function xBordaFratura(g: GeometriaJuntaTopo, y: number, z: number): number {
  const f = g.fratura;
  const naOrigem = y >= f.yOrigem[0] && y <= f.yOrigem[1];
  let x: number;
  if (z < f.profundidadeTrechoZta) {
    x = meiaLarguraFusao(g, Math.max(z, 0)) + f.afastamentoZta;
  } else {
    x = f.xPlano;
  }
  if (naOrigem && z < f.profundidadeTrechoZta) {
    // facetas com período da ordem do grão grosseiro (~0,1 mm)
    const p = 0.1;
    const s = ((z + y * 0.37) % p) / p;
    x += 0.035 * Math.abs(s - 0.5) * 2 - 0.017;
  } else {
    x += 0.006 * Math.sin(z * 61 + y * 3.1) + 0.004 * Math.sin(z * 173 + y * 7.3);
  }
  return x;
}

/** x da fratura na face (z = 0), usado para desenho. */
export function xFraturaFace(g: GeometriaJuntaTopo): number {
  return meiaLarguraFusao(g, 0) + g.fratura.afastamentoZta;
}

/** Parte da peça em que o ponto está, ou null se fora do material. */
export function parteEm(g: GeometriaJuntaTopo, x: number, y: number, z: number): 'A' | 'B' | null {
  if (y < 0 || y > g.largura) return null;
  if (Math.abs(x) > g.comprimento / 2) return null;
  if (z < 0 && z < -alturaReforcoFace(g, x, y)) return null;
  if (z > g.espessura && z > g.espessura + alturaReforcoRaiz(g, x)) return null;
  const xf = xBordaFratura(g, y, Math.min(Math.max(z, 0), g.espessura));
  return x <= xf ? 'A' : 'B';
}

/** Zona microestrutural verdadeira no ponto (x, y, z). */
export function zonaEm(g: GeometriaJuntaTopo, x: number, y: number, z: number): string | null {
  if (parteEm(g, x, y, z) === null) return null;
  if (z < 0) return 'zf-acab';
  if (z > g.espessura) return 'zf-reaq';
  const s = Math.abs(x) - meiaLarguraFusao(g, z);
  if (s < 0) return z < g.profundidadeZfAcabamento ? 'zf-acab' : 'zf-reaq';
  if (s < g.zta.gg) return z < g.profundidadeNaoRevenida ? 'zta-gg-acab' : 'zta-gg-rev';
  if (s < g.zta.gg + g.zta.gf) return 'zta-gf';
  if (s < g.zta.gg + g.zta.gf + g.zta.ic) return 'zta-ic';
  return 'mb';
}

// ---------------------------------------------------------------------------
// Amostras (cortes) e seus planos
// ---------------------------------------------------------------------------

/** Converte um ponto (u, v) do plano da amostra em coordenadas da peça. */
export function pontoNaPeca(a: Amostra, u: number, v: number): { x: number; y: number; z: number } {
  return a.orientacao === 'transversal' ? { x: u, y: a.posicao, z: v } : { x: a.posicao, y: u, z: v };
}

/** O ponto (u, v) pertence à seção da amostra? */
export function pontoNaSecao(caso: CasoDefinicao, a: Amostra, u: number, v: number): boolean {
  if (u < a.extensao[0] || u > a.extensao[1]) return false;
  const p = pontoNaPeca(a, u, v);
  return parteEm(caso.verdade.geometria, p.x, p.y, p.z) === a.parte;
}

/** Contorno aproximado da seção (polígono em u, v), para desenho. */
export function contornoSecao(caso: CasoDefinicao, a: Amostra, passos = 160): [number, number][] {
  const g = caso.verdade.geometria;
  const [e0, e1] = a.extensao;
  const topoEm = (u: number) => {
    const p = pontoNaPeca(a, u, 0);
    return -alturaReforcoFace(g, p.x, p.y);
  };
  const fundoEm = (u: number) => {
    const p = pontoNaPeca(a, u, 0);
    return g.espessura + alturaReforcoRaiz(g, p.x);
  };
  const linha = (ua: number, ub: number, f: (u: number) => number): [number, number][] => {
    const n = Math.max(2, Math.round((passos * Math.abs(ub - ua)) / Math.max(1e-6, e1 - e0)));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const u = ua + ((ub - ua) * i) / n;
      pts.push([u, f(u)]);
    }
    return pts;
  };
  if (a.orientacao === 'longitudinal') {
    return [...linha(e0, e1, topoEm), ...linha(e1, e0, fundoEm)];
  }
  const borda: [number, number][] = [];
  for (let i = 0; i <= 80; i++) {
    const v = (g.espessura * i) / 80;
    borda.push([xBordaFratura(g, a.posicao, v), v]);
  }
  const xfTopo = borda[0][0];
  const xfFundo = borda[borda.length - 1][0];
  if (a.parte === 'A') {
    if (e1 < xfFundo) return [...linha(e0, e1, topoEm), ...linha(e1, e0, fundoEm)];
    return [
      ...linha(e0, Math.min(e1, xfTopo), topoEm),
      ...borda.filter(([x]) => x <= e1),
      ...linha(Math.min(e1, xfFundo), e0, fundoEm),
    ];
  }
  if (e0 > xfTopo) return [...linha(e0, e1, topoEm), ...linha(e1, e0, fundoEm)];
  return [
    ...linha(Math.max(e0, xfTopo), e1, topoEm),
    ...linha(e1, Math.max(e0, xfFundo), fundoEm),
    ...borda.slice().reverse().filter(([x]) => x >= e0),
  ];
}

export function faixasSobrepoem(a: Faixa, b: Faixa): boolean {
  return a[0] < b[1] && b[0] < a[1];
}

/** Retângulo (no plano x-y da peça) ocupado pela fatia de uma amostra. */
export function retanguloFatia(a: Amostra): { x: Faixa; y: Faixa } {
  return a.orientacao === 'transversal'
    ? { x: a.extensao, y: [a.posicao - a.meiaFatia, a.posicao + a.meiaFatia] }
    : { x: [a.posicao - a.meiaFatia, a.posicao + a.meiaFatia], y: a.extensao };
}
