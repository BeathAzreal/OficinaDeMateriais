// Tempos, consumo de arestas, custos didáticos e estoque.

import { ferramentas } from '../dados/catalogo';
import type { EstadoAresta } from '../modelo/passe';
import type { EstadoPartida, Tempos } from './partida';

export const tempoTotal = (t: Tempos) => t.corte + t.naoProdutivo + t.limpeza + t.trocas + t.preparacao;

/** Consumo de aresta: fração de vida usada (máx. 1); aresta lascada conta inteira. */
export const consumoAresta = (a: EstadoAresta) => (a.lascada ? 1 : Math.min(1, a.dano));

export interface Custos {
  tarugos: number;
  maquina: number;
  arestas: number;
  total: number;
  consumoArestas: number; // soma das frações de vida consumidas (arestas e brocas)
}

export function calcularCustos(e: EstadoPartida): Custos {
  const c = e.ctx.encomenda.custos;
  const tarugos = e.pecas.length * c.tarugo;
  const maquina = tempoTotal(e.tempos) * c.minutoMaquina;
  const consumoArestas = e.arestas.reduce((s, a) => s + consumoAresta(a.estado), 0);
  const arestas = e.arestas.reduce((s, a) => s + consumoAresta(a.estado) * ferramentas[a.ferramentaId].custo, 0);
  return { tarugos, maquina, arestas, total: tarugos + maquina + arestas, consumoArestas };
}

export function estoqueRestante(e: EstadoPartida): { tarugos: number; arestas: number } | null {
  if (e.modo === 'laboratorio') return null;
  const m = e.ctx.encomenda.modoEncomenda;
  return { tarugos: m.tarugos - e.pecas.length, arestas: m.arestas - e.consumoEstoque };
}
