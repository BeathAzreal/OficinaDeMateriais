import type { Maquina } from '../../modelo/tipos';

// Torno CNC didático fictício. Rotação constante por bloco (G97): a vc resulta do diâmetro.
export const tornoTd1: Maquina = {
  id: 'torno-td1',
  nome: 'Torno CNC didático TD-1 (fictício)',
  rotacao: { min: 40, max: 3000 },
  avanco: { min: 0.02, max: 0.5, passo: 0.01 },
  profundidade: { min: 0, max: 4.0, passo: 0.01 },
  comprimentoPasso: 0.5,
  rigidezSistema: 15000, // N/mm (= 15 N/µm), sintético
  aproximacao: 2,
  folgaCastanhas: 3,
  diametroMinimo: 10,
  paredeMinima: 1.0,
  estacoes: 6,
  tempoDescarga: 0.04, // min por retração de pica-pau (sintético)
};
