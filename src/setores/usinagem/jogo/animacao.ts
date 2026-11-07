// Relógio de apresentação. O resultado da operação já está calculado antes da animação;
// a velocidade de reprodução muda apenas quanto tempo real leva para mostrá-la.

import { DZ } from '../modelo/peca';
import type { NivelCarga } from '../modelo/tipos';
import { nivelCarga } from '../modelo/fenomenos';
import { duracaoOperacao, type RegistroFuracao, type RegistroOperacao, type RegistroPasse } from './partida';

/** Segundos reais para mostrar 1 min de tempo de corte do modelo na velocidade 1×. */
export const SEGUNDOS_POR_MINUTO = 20;
export const VELOCIDADES = [0.5, 1, 2, 4, 8] as const;

/** Avança o tempo simulado (min) dado um intervalo real (s) e a velocidade de reprodução. */
export function avancarRelogio(tSim: number, dtReal: number, velocidade: number, tFinal: number): number {
  return Math.min(tFinal, tSim + (dtReal * velocidade) / SEGUNDOS_POR_MINUTO);
}

export interface QuadroPasse {
  tSim: number; // min
  zFerramenta: number; // mm (negativo fora da peça)
  celulasCortadas: number; // células já alteradas pela ferramenta
  emContato: boolean;
  vb: number; // mm
  carga: number;
  nivel: NivelCarga;
  diametroPonta: number; // mm (torneamento: diâmetro onde a ponta está; furação: diâmetro da broca)
  concluido: boolean;
  entupimento: number; // furação: fator do cavaco no canal
}

/** Estado mostrado num instante de um passe de torneamento: função pura do tempo simulado. */
export function quadroDoPasse(r: RegistroPasse, tSim: number, aproximacao: number): QuadroPasse {
  const tc = r.previsao.tc;
  const t = Math.max(0, Math.min(tSim, tc));
  const z = -aproximacao + r.previsao.vf * t;
  const n = r.celulas.length;
  const cortadas = Math.max(0, Math.min(n, Math.floor(z / DZ + 1e-9)));
  const atual = cortadas > 0 ? r.celulas[Math.min(n - 1, cortadas - 1)] : null;
  const emContato = z >= 0 && atual !== null && atual.contato && cortadas <= n;
  return {
    tSim: t,
    zFerramenta: z,
    celulasCortadas: cortadas,
    emContato,
    vb: atual ? atual.vb : r.vbInicial,
    carga: emContato && atual ? atual.carga : 0,
    nivel: nivelCarga(emContato && atual ? atual.carga : 0),
    diametroPonta: atual ? atual.dDepois : r.previsao.dprog,
    concluido: t >= tc,
    entupimento: 1,
  };
}

/** Estado mostrado num instante de uma furação (com descargas de pica-pau). */
export function quadroDaFuracao(r: RegistroFuracao, tSim: number): QuadroPasse {
  const tFinal = r.tcEfetivo;
  const t = Math.max(0, Math.min(tSim, tFinal));
  let z = r.previsao.segmentos[0]?.z0 ?? 0;
  let corte = false;
  let maisFundo = 0;
  for (const s of r.previsao.segmentos) {
    if (t >= s.t1) {
      z = s.z1;
      if (s.corte) maisFundo = Math.max(maisFundo, s.z1);
      continue;
    }
    if (t >= s.t0) {
      z = s.z0 + ((t - s.t0) / Math.max(s.t1 - s.t0, 1e-12)) * (s.z1 - s.z0);
      corte = s.corte;
      if (s.corte) maisFundo = Math.max(maisFundo, z);
    }
    break;
  }
  if (r.quebrouEm !== null) maisFundo = Math.min(maisFundo, r.quebrouEm);
  const k = Math.max(0, Math.min(r.passos.length - 1, Math.round(z / DZ) - 1));
  const passo = r.passos[k];
  const emContato = corte && z > 0 && !!passo?.contato;
  return {
    tSim: t,
    zFerramenta: z,
    celulasCortadas: Math.max(0, Math.floor(maisFundo / DZ + 1e-9)),
    emContato,
    vb: passo ? passo.vb : r.vbInicial,
    carga: emContato ? passo.carga : 0,
    nivel: nivelCarga(emContato ? passo.carga : 0),
    diametroPonta: r.diametroFuro,
    concluido: t >= tFinal,
    entupimento: emContato ? passo.entupimento : 1,
  };
}

export function quadroDaOperacao(r: RegistroOperacao, tSim: number, aproximacao: number): QuadroPasse {
  return r.tipo === 'tornear' ? quadroDoPasse(r, tSim, aproximacao) : quadroDaFuracao(r, tSim);
}

/** Reproduz uma operação inteira com quadros de dt segundos (usado nos testes de consistência). */
export function reproduzirAnimacao(
  r: RegistroOperacao,
  velocidade: number,
  aproximacao: number,
  dtReal = 1 / 60,
): { quadros: number; final: QuadroPasse } {
  const tFinal = duracaoOperacao(r);
  let t = 0;
  let quadros = 0;
  while (t < tFinal && quadros < 1e7) {
    t = avancarRelogio(t, dtReal, velocidade, tFinal);
    quadros++;
  }
  return { quadros, final: quadroDaOperacao(r, t, aproximacao) };
}
