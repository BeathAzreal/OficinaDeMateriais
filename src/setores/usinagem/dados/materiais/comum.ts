// Peças reutilizáveis para montar o comportamento de cada material.
// Cada material combina essas peças com parâmetros e regras próprias.

import type { ClasseFerramenta, CondicaoCavaco, CurvaVida, ResultadoCavaco } from '../../modelo/tipos';

function suave(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Aresta postiça: valor máximo até vcPlena, caindo suavemente até zero em vcFim. */
export function janelaApc(vcPlena: number, vcFim: number, raMax: number) {
  return (vc: number) => {
    if (raMax <= 0) return 0;
    if (vc <= vcPlena) return raMax;
    if (vc >= vcFim) return 0;
    return raMax * (1 - suave((vc - vcPlena) / (vcFim - vcPlena)));
  };
}

/** Taylor estendida sintética: T = 10 min · (vcRef/vc)^expoente · (0,25/f). */
export function vidaTaylor(curvas: Record<ClasseFerramenta, CurvaVida>) {
  return (vc: number, f: number, classe: ClasseFerramenta) => {
    const c = curvas[classe];
    return 10 * (c.vcRef / Math.max(vc, 1)) ** c.expoente * (0.25 / Math.max(f, 0.01));
  };
}

/** Casca de fornecimento: 1 + extra·min(1, espessura/ap). */
export function fatorCasca(espessura: number, extra: number) {
  return (ap: number) => (espessura <= 0 ? 1 : 1 + extra * Math.min(1, espessura / Math.max(ap, 0.01)));
}

export const CAVACO: Record<string, ResultadoCavaco> = {
  apc: {
    tipo: 'apc',
    rotulo: 'Contínuo, com aresta postiça',
    descricao:
      'Em velocidade de corte baixa, material da peça adere à aresta e forma a aresta postiça, que cresce e se desprende periodicamente.',
  },
  espesso: {
    tipo: 'espesso',
    rotulo: 'Espesso, quebra por sobrecarga',
    descricao: 'Avanço acima da janela da ferramenta: o cavaco é grosso e quebra com esforço elevado sobre a aresta.',
  },
  fita: {
    tipo: 'fita',
    rotulo: 'Fita longa (não quebra)',
    descricao: 'O cavaco é fino demais para a geometria da ferramenta. Material dúctil forma fita contínua, que se enrola e precisa ser retirada.',
  },
  curto: {
    tipo: 'curto',
    rotulo: 'Helicoidal curto (quebrado)',
    descricao: 'Avanço e profundidade dentro da janela da ferramenta: o cavaco se curva e quebra em segmentos curtos.',
  },
  fragmentado: {
    tipo: 'fragmentado',
    rotulo: 'Fragmentado (descontínuo)',
    descricao: 'O material rompe logo à frente da aresta e o cavaco sai em pequenos fragmentos, sem depender do quebra-cavaco.',
  },
};

/**
 * Classificador para materiais dúcteis: aresta postiça em vc baixa; depois, a janela da ferramenta
 * decide entre fita, curto e espesso. `ductilidade` > 1 desloca a janela para avanços maiores.
 */
export function classificadorDuctil(apc: (vc: number) => number, ductilidade: number) {
  return (c: CondicaoCavaco): ResultadoCavaco => {
    // Na furação, o cavaco sai pelos canais da broca; a aresta postiça afeta a parede, não a forma do cavaco.
    if (!c.furacao && apc(c.vc) > 0.5) return CAVACO.apc;
    const j = c.janelaQuebra;
    if (!j) return c.furacao && c.f >= 0.08 * ductilidade ? CAVACO.curto : CAVACO.fita;
    if (c.f > j.fMax) return CAVACO.espesso;
    if (c.f < j.fMin * ductilidade || c.ap < j.apMin) return CAVACO.fita;
    return CAVACO.curto;
  };
}
