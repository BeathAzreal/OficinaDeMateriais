// Cadastro central. Para adicionar material, ferramenta, máquina ou encomenda,
// crie o arquivo de dados e registre-o aqui (ver docs/NOVAS-ENCOMENDAS.md).

import type { Encomenda, Ferramenta, Maquina, Material } from '../modelo/tipos';
import { ac45Laminado } from './materiais/ac45-laminado';
import { ac10Trefilado, al61T6, ff25Fundido, ix304Solubilizado, lt360CorteLivre } from './materiais/outros';
import { brocas, ferramentasTornear } from './ferramentas/biblioteca';
import { tornoTd1 } from './maquinas/torno-td1';
import { om01EixoSobMedida } from './encomendas/om01-eixo-sob-medida';

export const listaMateriais: Material[] = [ac45Laminado, ac10Trefilado, al61T6, ff25Fundido, ix304Solubilizado, lt360CorteLivre];
export const materiais: Record<string, Material> = Object.fromEntries(listaMateriais.map((m) => [m.id, m]));
export const listaFerramentas: Ferramenta[] = [...ferramentasTornear, ...brocas];
export const ferramentas: Record<string, Ferramenta> = Object.fromEntries(listaFerramentas.map((f) => [f.id, f]));
export const maquinas: Record<string, Maquina> = { [tornoTd1.id]: tornoTd1 };
export const encomendas: Encomenda[] = [om01EixoSobMedida];

/** Configuração inicial do modo livre (pode ser alterada durante o jogo). */
export const LIVRE = {
  materialId: ac45Laminado.id,
  diametros: [25, 32, 40, 50],
  balancos: [40, 75, 100],
  diametro: 40,
  balanco: 75,
  comprimentoFixado: 35,
  torre: { 1: 'md80-r08', 2: 'md80-r04', 3: 'hss-bit-r04', 4: 'hss-d10', 5: 'md-d10', 6: 'hss-d6' } as Record<number, string>,
};

export interface Contexto {
  encomenda: Encomenda;
  maquina: Maquina;
}

export function contextoDe(encomendaId: string): Contexto {
  const encomenda = encomendas.find((e) => e.id === encomendaId);
  if (!encomenda) throw new Error(`Encomenda desconhecida: ${encomendaId}`);
  const maquina = maquinas[encomenda.maquinaId];
  if (!maquina || !materiais[encomenda.materialId]) throw new Error(`Encomenda ${encomendaId} referencia dados não cadastrados`);
  return { encomenda, maquina };
}

export function material(id: string): Material {
  const m = materiais[id];
  if (!m) throw new Error(`Material desconhecido: ${id}`);
  return m;
}

export function ferramenta(id: string): Ferramenta {
  const f = ferramentas[id];
  if (!f) throw new Error(`Ferramenta desconhecida: ${id}`);
  return f;
}
