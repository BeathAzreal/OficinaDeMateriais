// Persistência no navegador: só configurações e registro de ações de cada modo.

import { encomendas, ferramentas, materiais } from '../dados/catalogo';
import type { Acao, Modo } from './partida';
import { programaExemplo, type Bloco, type Programa } from './programa';

export const CHAVE = 'usinagem:v1';
/** Chave usada antes da troca de nome; lida uma vez para não perder progresso. */
export const CHAVE_ANTIGA = 'oficina-de-materiais:v1';

export interface Configuracoes {
  modo: Modo;
  velocidade: number;
  tutorialVisto: boolean;
}

export interface PartidaSalva {
  encomendaId: string;
  acoes: Acao[];
  programa: Programa;
}

export interface Salvo {
  versao: 1;
  configuracoes: Configuracoes;
  partidas: Record<Modo, PartidaSalva>;
}

export interface Armazenamento {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export function salvoPadrao(): Salvo {
  const id = encomendas[0].id;
  return {
    versao: 1,
    configuracoes: { modo: 'encomenda', velocidade: 1, tutorialVisto: false },
    partidas: {
      encomenda: { encomendaId: id, acoes: [], programa: programaExemplo('encomenda') },
      laboratorio: { encomendaId: id, acoes: [], programa: programaExemplo('laboratorio') },
    },
  };
}

const TIPOS = new Set([
  'passe',
  'furar',
  'trocarAresta',
  'montarFerramenta',
  'novoTarugo',
  'prepararEquivalente',
  'medir',
  'entregar',
  'responder',
]);

const numeros = (p: Record<string, unknown> | undefined, ks: string[]) => !!p && ks.every((k) => typeof p[k] === 'number');

function acaoValida(a: unknown): a is Acao {
  if (!a || typeof a !== 'object') return false;
  const o = a as Record<string, unknown>;
  const t = o.tipo;
  if (typeof t !== 'string' || !TIPOS.has(t)) return false;
  const p = o.params as Record<string, unknown> | undefined;
  if (t === 'passe') return numeros(p, ['n', 'f', 'ap', 'L']) && (p!.operacao === 'desbaste' || p!.operacao === 'acabamento');
  if (t === 'furar') return numeros(p, ['n', 'f', 'P', 'q']) && typeof o.estacao === 'number';
  if (t === 'montarFerramenta') return typeof o.estacao === 'number' && typeof o.ferramentaId === 'string' && !!ferramentas[o.ferramentaId as string];
  if (t === 'novoTarugo') return o.materialId === undefined || !!materiais[o.materialId as string];
  return true;
}

function blocoValido(b: unknown): b is Bloco {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  if (typeof o.id !== 'string') return false;
  const p = o.params as Record<string, unknown> | undefined;
  if (o.tipo === 'parada') return typeof o.comentario === 'string';
  if (o.tipo === 'tornear') return typeof o.estacao === 'number' && numeros(p, ['n', 'f', 'ap', 'L']);
  if (o.tipo === 'furar') return typeof o.estacao === 'number' && numeros(p, ['n', 'f', 'P', 'q']);
  return false;
}

function programaValido(p: unknown, padrao: Programa): Programa {
  if (!p || typeof p !== 'object') return padrao;
  const o = p as Partial<Programa>;
  if (!Array.isArray(o.blocos)) return padrao;
  const blocos = o.blocos.filter(blocoValido);
  const cursor = typeof o.cursor === 'number' ? Math.max(0, Math.min(blocos.length, Math.floor(o.cursor))) : 0;
  return { nome: typeof o.nome === 'string' ? o.nome : padrao.nome, blocos, cursor };
}

function partidaValida(p: unknown, padrao: PartidaSalva): PartidaSalva {
  if (!p || typeof p !== 'object') return padrao;
  const { encomendaId, acoes, programa } = p as Partial<PartidaSalva>;
  if (typeof encomendaId !== 'string' || !encomendas.some((e) => e.id === encomendaId)) return padrao;
  if (!Array.isArray(acoes)) return padrao;
  return { encomendaId, acoes: acoes.filter(acaoValida), programa: programaValido(programa, padrao.programa) };
}

export function carregar(arm: Armazenamento | null): Salvo {
  const padrao = salvoPadrao();
  if (!arm) return padrao;
  try {
    const bruto = arm.getItem(CHAVE) ?? arm.getItem(CHAVE_ANTIGA);
    if (!bruto) return padrao;
    const obj = JSON.parse(bruto) as Partial<Salvo>;
    if (obj.versao !== 1) return padrao;
    const c = obj.configuracoes ?? padrao.configuracoes;
    return {
      versao: 1,
      configuracoes: {
        modo: c.modo === 'laboratorio' ? 'laboratorio' : 'encomenda',
        velocidade: typeof c.velocidade === 'number' && c.velocidade > 0 ? c.velocidade : 1,
        tutorialVisto: c.tutorialVisto === true,
      },
      partidas: {
        encomenda: partidaValida(obj.partidas?.encomenda, padrao.partidas.encomenda),
        laboratorio: partidaValida(obj.partidas?.laboratorio, padrao.partidas.laboratorio),
      },
    };
  } catch {
    return padrao;
  }
}

export function salvar(arm: Armazenamento | null, s: Salvo): boolean {
  if (!arm) return false;
  try {
    arm.setItem(CHAVE, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

/** Reinicia só a partida do modo indicado, preservando configurações e o outro modo. */
export function reiniciarModo(s: Salvo, modo: Modo): Salvo {
  const atual = s.partidas[modo];
  return { ...s, partidas: { ...s.partidas, [modo]: { ...atual, acoes: [], programa: { ...atual.programa, cursor: 0 } } } };
}

export function armazenamentoDoNavegador(): Armazenamento | null {
  try {
    const ls = window.localStorage;
    const teste = '__oficina_teste__';
    ls.setItem(teste, '1');
    ls.removeItem(teste);
    return ls;
  } catch {
    return null;
  }
}
