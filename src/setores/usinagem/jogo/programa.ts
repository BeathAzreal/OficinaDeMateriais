// Programa CNC didático: lista de blocos editada por formulário. A listagem em formato ISO
// é só ilustrativa (gerada a partir dos blocos); o jogador não digita código G.

import { ferramentas } from '../dados/catalogo';
import { comprimentoPonta } from '../modelo/furacao';
import type { ParametrosFuracao, ParametrosPasse } from '../modelo/tipos';
import type { Acao, EstadoPartida, ParametroControlavel } from './partida';
import { instanciaNaEstacao, pecaAtual } from './partida';

export interface BaseExperimento {
  numero: number; // operação-base no histórico
  variar: ParametroControlavel;
}

export type Bloco =
  | { id: string; tipo: 'tornear'; estacao: number; params: ParametrosPasse; base?: BaseExperimento }
  | { id: string; tipo: 'furar'; estacao: number; params: ParametrosFuracao; base?: BaseExperimento }
  | { id: string; tipo: 'parada'; comentario: string };

export interface Programa {
  nome: string;
  blocos: Bloco[];
  /** Próximo bloco a executar. */
  cursor: number;
}

export const programaVazio = (nome = 'O0001'): Programa => ({ nome, blocos: [], cursor: 0 });

let contador = 0;
export const novoId = () => `b${Date.now().toString(36)}${(contador++).toString(36)}`;

export const T = (estacao: number) => `T${String(estacao).padStart(2, '0')}`;

/** Parâmetros efetivos: no experimento controlado, só o parâmetro escolhido difere da operação-base. */
export function parametrosDoBloco(b: Bloco, e: EstadoPartida): Bloco {
  if (b.tipo === 'parada' || !b.base) return b;
  const base = e.passes[b.base.numero - 1];
  if (!base || base.tipo !== b.tipo) return b;
  const params = { ...base.params } as Record<string, unknown>;
  params[b.base.variar] = (b.params as unknown as Record<string, unknown>)[b.base.variar];
  return { ...b, params } as unknown as Bloco;
}

export function blocoParaAcao(b: Bloco, e: EstadoPartida): Acao | null {
  const ef = parametrosDoBloco(b, e);
  if (ef.tipo === 'parada') return null;
  const controle = b.tipo !== 'parada' && b.base
    ? {
        baseNumero: b.base.numero,
        alterado: b.base.variar,
        mantidos: (ef.tipo === 'tornear' ? ['n', 'f', 'ap', 'L', 'operacao'] : ['n', 'f', 'P', 'q']).filter(
          (k) => k !== b.base!.variar,
        ) as ParametroControlavel[],
      }
    : undefined;
  if (ef.tipo === 'tornear') return { tipo: 'passe', params: ef.params, estacao: ef.estacao, controle };
  return { tipo: 'furar', params: ef.params, estacao: ef.estacao, controle };
}

/**
 * Diâmetro de referência (X) antes de cada bloco, supondo que os blocos a partir do cursor
 * ainda vão ser executados na peça atual.
 */
export function referenciasDosBlocos(p: Programa, e: EstadoPartida): number[] {
  const pj = pecaAtual(e);
  const refs: number[] = [];
  let dref = pj.peca.diametroBruto;
  for (let i = 0; i < p.blocos.length; i++) {
    if (i === p.cursor) dref = pj.peca.dref;
    refs.push(dref);
    const b = parametrosDoBloco(p.blocos[i], e);
    if (b.tipo === 'tornear') dref = dref - 2 * b.params.ap;
  }
  return refs;
}

const x = (v: number) => v.toFixed(3);
const z = (v: number) => v.toFixed(3);

export interface LinhaIso {
  texto: string;
  bloco: number | null; // índice do bloco de origem
}

/** Listagem ilustrativa em formato ISO (X em diâmetro, Z negativo para dentro da peça). */
export function listagemIso(p: Programa, e: EstadoPartida): LinhaIso[] {
  const linhas: LinhaIso[] = [{ texto: `%`, bloco: null }, { texto: `${p.nome} (USINAGEM - PROGRAMA DIDATICO)`, bloco: null }];
  let n = 10;
  const add = (texto: string, bloco: number | null) => {
    linhas.push({ texto: `N${n} ${texto}`, bloco });
    n += 10;
  };
  add('G21 G18 G40 (MM, PLANO XZ, SEM COMPENSACAO DE RAIO)', null);
  const refs = referenciasDosBlocos(p, e);
  let tAtual = -1;
  p.blocos.forEach((original, i) => {
    const b = parametrosDoBloco(original, e);
    if (b.tipo === 'parada') {
      add(`M00 (${b.comentario.toUpperCase() || 'PARADA PROGRAMADA'})`, i);
      return;
    }
    const inst = instanciaNaEstacao(e, b.estacao);
    const nomeFerr = inst ? ferramentas[inst.ferramentaId].codigo.toUpperCase() : 'SEM FERRAMENTA';
    if (b.estacao !== tAtual) {
      add(`${T(b.estacao)}${String(b.estacao).padStart(2, '0')} (${nomeFerr})`, i);
      tAtual = b.estacao;
    }
    add(`G97 S${Math.round(b.params.n)} M03`, i);
    if (b.tipo === 'tornear') {
      const dref = refs[i];
      const dprog = dref - 2 * b.params.ap;
      add(`G00 X${x(dref + 2)} Z2.000`, i);
      add(`G00 X${x(dprog)} (AP ${b.params.ap.toFixed(2)} NO RAIO, ${b.params.operacao.toUpperCase()})`, i);
      add(`G01 Z-${z(b.params.L)} F${b.params.f.toFixed(2)}`, i);
      add(`G00 X${x(dref + 2)}`, i);
      add(`G00 Z2.000`, i);
    } else {
      const f = inst ? ferramentas[inst.ferramentaId] : null;
      const lp = f && f.tipo === 'broca' ? comprimentoPonta(f) : 0;
      add(`G00 X0.000 Z2.000`, i);
      if (b.params.q > 0) {
        add(`G83 Z-${z(b.params.P + lp)} Q${b.params.q.toFixed(3)} F${b.params.f.toFixed(2)} (PICA-PAU)`, i);
        add('G80', i);
      } else add(`G01 Z-${z(b.params.P + lp)} F${b.params.f.toFixed(2)}`, i);
      add(`G00 Z2.000`, i);
    }
  });
  add('M05', null);
  add('M30', null);
  linhas.push({ texto: '%', bloco: null });
  return linhas;
}

export function moverBloco(p: Programa, i: number, delta: number): Programa {
  const j = i + delta;
  if (j < 0 || j >= p.blocos.length) return p;
  const blocos = p.blocos.slice();
  [blocos[i], blocos[j]] = [blocos[j], blocos[i]];
  return { ...p, blocos };
}

export function removerBloco(p: Programa, i: number): Programa {
  const blocos = p.blocos.filter((_, k) => k !== i);
  return { ...p, blocos, cursor: Math.min(p.cursor > i ? p.cursor - 1 : p.cursor, blocos.length) };
}

export function inserirBloco(p: Programa, b: Bloco, posicao = p.blocos.length): Programa {
  const blocos = p.blocos.slice();
  blocos.splice(posicao, 0, b);
  return { ...p, blocos, cursor: p.cursor > posicao ? p.cursor + 1 : p.cursor };
}

/** Programa inicial de exemplo (editável) para cada modo. */
export function programaExemplo(modo: 'encomenda' | 'laboratorio'): Programa {
  const blocos: Bloco[] =
    modo === 'encomenda'
      ? [
          { id: 'ex1', tipo: 'tornear', estacao: 1, params: { n: 1200, f: 0.25, ap: 1.0, L: 50, operacao: 'desbaste' } },
          { id: 'ex2', tipo: 'parada', comentario: 'Medir antes de continuar' },
        ]
      : [
          { id: 'ex3', tipo: 'tornear', estacao: 1, params: { n: 1200, f: 0.25, ap: 1.0, L: 40, operacao: 'desbaste' } },
          { id: 'ex4', tipo: 'furar', estacao: 4, params: { n: 800, f: 0.15, P: 20, q: 0 } },
          { id: 'ex5', tipo: 'parada', comentario: 'Inspecionar' },
        ];
  return { nome: 'O0001', blocos, cursor: 0 };
}
