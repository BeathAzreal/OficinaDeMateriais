// Biblioteca de ferramentas fictícias. Geometria declarada; limites, janelas de cavaco,
// sobremedidas e custos são SINTÉTICOS (ver docs/MODELO.md).

import type { Broca, FerramentaTornear } from '../../modelo/tipos';

const OBS_INSERTO = 'Os valores rε e α entram nas equações: rε na rugosidade geométrica, α no recuo da ponta por desgaste.';

export const md80R08: FerramentaTornear = {
  tipo: 'tornear',
  id: 'md80-r08',
  codigo: 'MD-80 R0,8',
  nome: 'Inserto MD-80 R0,8 (fictício)',
  classe: 'metal-duro',
  descricaoClasse: 'Metal duro revestido (o revestimento não é modelado)',
  geometria: [
    { rotulo: 'Forma', valor: 'rômbica 80°', origem: 'exato' },
    { rotulo: 'Raio de ponta rε', valor: '0,8 mm', origem: 'exato' },
    { rotulo: 'Ângulo de posição κr', valor: '95°', origem: 'exato' },
    { rotulo: 'Ângulo de saída γ', valor: '+6° (com quebra-cavaco)', origem: 'exato' },
    { rotulo: 'Ângulo de folga α', valor: '7°', origem: 'exato' },
    { rotulo: 'Janela do quebra-cavaco', valor: 'f 0,12–0,40 mm/volta; ap 0,5–3,0 mm', origem: 'sintetico' },
    { rotulo: 'Profundidade máxima', valor: '3,0 mm', origem: 'sintetico' },
  ],
  raioPonta: 0.8,
  anguloPosicao: 95,
  anguloFolga: 7,
  anguloPonta: 80,
  apMax: 3.0,
  quebraCavaco: { fMin: 0.12, fMax: 0.4, apMin: 0.5, apMax: 3.0 },
  forcaLimite: 2400,
  vbLimite: 0.3,
  custo: 6,
  observacoes: ['Uso geral: desbaste médio e acabamento.', OBS_INSERTO],
};

export const md80R04: FerramentaTornear = {
  ...md80R08,
  id: 'md80-r04',
  codigo: 'MD-80 R0,4',
  nome: 'Inserto MD-80 R0,4 (fictício)',
  geometria: [
    { rotulo: 'Forma', valor: 'rômbica 80°', origem: 'exato' },
    { rotulo: 'Raio de ponta rε', valor: '0,4 mm', origem: 'exato' },
    { rotulo: 'Ângulo de posição κr', valor: '95°', origem: 'exato' },
    { rotulo: 'Ângulo de saída γ', valor: '+10° (quebra-cavaco de acabamento)', origem: 'exato' },
    { rotulo: 'Ângulo de folga α', valor: '7°', origem: 'exato' },
    { rotulo: 'Janela do quebra-cavaco', valor: 'f 0,08–0,25 mm/volta; ap 0,3–2,0 mm', origem: 'sintetico' },
    { rotulo: 'Profundidade máxima', valor: '2,0 mm', origem: 'sintetico' },
  ],
  raioPonta: 0.4,
  apMax: 2.0,
  quebraCavaco: { fMin: 0.08, fMax: 0.25, apMin: 0.3, apMax: 2.0 },
  forcaLimite: 1700,
  observacoes: [
    'Raio menor: com o mesmo f, a parcela geométrica da Ra dobra (f²/32rε). A força passiva é menor quando ap é pequeno.',
    OBS_INSERTO,
  ],
};

export const md80R12: FerramentaTornear = {
  ...md80R08,
  id: 'md80-r12',
  codigo: 'MD-80 R1,2',
  nome: 'Inserto MD-80 R1,2 desbaste (fictício)',
  geometria: [
    { rotulo: 'Forma', valor: 'rômbica 80°', origem: 'exato' },
    { rotulo: 'Raio de ponta rε', valor: '1,2 mm', origem: 'exato' },
    { rotulo: 'Ângulo de posição κr', valor: '95°', origem: 'exato' },
    { rotulo: 'Ângulo de saída γ', valor: '+4° (quebra-cavaco de desbaste)', origem: 'exato' },
    { rotulo: 'Ângulo de folga α', valor: '7°', origem: 'exato' },
    { rotulo: 'Janela do quebra-cavaco', valor: 'f 0,20–0,50 mm/volta; ap 1,0–4,0 mm', origem: 'sintetico' },
    { rotulo: 'Profundidade máxima', valor: '4,0 mm', origem: 'sintetico' },
  ],
  raioPonta: 1.2,
  apMax: 4.0,
  quebraCavaco: { fMin: 0.2, fMax: 0.5, apMin: 1.0, apMax: 4.0 },
  forcaLimite: 3200,
  custo: 7,
  observacoes: ['Aresta robusta para remover muito material por passe. Com pouca ap, o cavaco não quebra.', OBS_INSERTO],
};

export const md35R02: FerramentaTornear = {
  ...md80R08,
  id: 'md35-r02',
  codigo: 'MD-35 R0,2',
  nome: 'Inserto MD-35 R0,2 acabamento fino (fictício)',
  geometria: [
    { rotulo: 'Forma', valor: 'rômbica 35°', origem: 'exato' },
    { rotulo: 'Raio de ponta rε', valor: '0,2 mm', origem: 'exato' },
    { rotulo: 'Ângulo de posição κr', valor: '93°', origem: 'exato' },
    { rotulo: 'Ângulo de saída γ', valor: '+12°', origem: 'exato' },
    { rotulo: 'Ângulo de folga α', valor: '7°', origem: 'exato' },
    { rotulo: 'Janela do quebra-cavaco', valor: 'f 0,05–0,15 mm/volta; ap 0,2–1,5 mm', origem: 'sintetico' },
    { rotulo: 'Profundidade máxima', valor: '1,5 mm', origem: 'sintetico' },
  ],
  raioPonta: 0.2,
  anguloPosicao: 93,
  anguloPonta: 35,
  apMax: 1.5,
  quebraCavaco: { fMin: 0.05, fMax: 0.15, apMin: 0.2, apMax: 1.5 },
  forcaLimite: 900,
  custo: 8,
  observacoes: ['Ponta fina e frágil: lasca com cargas que o MD-80 suporta. O raio pequeno exige f pequeno para a Ra.', OBS_INSERTO],
};

export const hssBitR04: FerramentaTornear = {
  tipo: 'tornear',
  id: 'hss-bit-r04',
  codigo: 'HSS bit R0,4',
  nome: 'Bit de aço rápido afiado R0,4 (fictício)',
  classe: 'aco-rapido',
  descricaoClasse: 'Aço rápido (HSS), afiado no esmeril, sem quebra-cavaco',
  geometria: [
    { rotulo: 'Forma', valor: 'bit retangular afiado, ponta 80°', origem: 'exato' },
    { rotulo: 'Raio de ponta rε', valor: '0,4 mm', origem: 'exato' },
    { rotulo: 'Ângulo de posição κr', valor: '90°', origem: 'exato' },
    { rotulo: 'Ângulo de saída γ', valor: '+12°', origem: 'exato' },
    { rotulo: 'Ângulo de folga α', valor: '8°', origem: 'exato' },
    { rotulo: 'Quebra-cavaco', valor: 'nenhum', origem: 'exato' },
    { rotulo: 'Profundidade máxima', valor: '3,0 mm', origem: 'sintetico' },
  ],
  raioPonta: 0.4,
  anguloPosicao: 90,
  anguloFolga: 8,
  anguloPonta: 80,
  apMax: 3.0,
  quebraCavaco: null,
  forcaLimite: 1500,
  vbLimite: 0.3,
  custo: 2,
  observacoes: [
    'O aço rápido perde dureza com o calor: a vida cai muito mais depressa com a vc do que no metal duro (expoente de Taylor maior no modelo).',
    'Sem quebra-cavaco, materiais dúcteis formam fita em praticamente qualquer condição.',
  ],
};

function geometriaBroca(d: number, ponta: number, util: number, classe: string, janela: string): Broca['geometria'] {
  return [
    { rotulo: 'Diâmetro', valor: `${String(d).replace('.', ',')} mm`, origem: 'exato' },
    { rotulo: 'Ângulo de ponta σ', valor: `${ponta}°`, origem: 'exato' },
    { rotulo: 'Comprimento útil de canal', valor: `${util} mm`, origem: 'exato' },
    { rotulo: 'Material', valor: classe, origem: 'exato' },
    { rotulo: 'Janela de cavaco (f)', valor: janela, origem: 'sintetico' },
  ];
}

const OBS_BROCA = 'A broca fica parada na torre e a peça gira. A ponta cônica avança além da profundidade do diâmetro pleno.';

export const hssD6: Broca = {
  tipo: 'broca',
  id: 'hss-d6',
  codigo: 'Broca HSS Ø6',
  nome: 'Broca helicoidal HSS Ø6 (fictícia)',
  classe: 'aco-rapido',
  descricaoClasse: 'Aço rápido, haste cilíndrica',
  geometria: geometriaBroca(6, 118, 57, 'aço rápido', '0,06–0,15 mm/volta'),
  diametro: 6,
  anguloPonta: 118,
  comprimentoUtil: 57,
  torqueLimite: 4.5,
  forcaAvancoLimite: 2200,
  sobremedida: 0.06,
  raBase: 3.2,
  janelaCavaco: { fMin: 0.06, fMax: 0.15 },
  vbLimite: 0.3,
  custo: 3,
  observacoes: ['Diâmetro pequeno: resistência à torção ∝ d³. Avanço alto ou cavaco acumulado em furo fundo quebram a broca.', OBS_BROCA],
};

export const hssD10: Broca = {
  ...hssD6,
  id: 'hss-d10',
  codigo: 'Broca HSS Ø10',
  nome: 'Broca helicoidal HSS Ø10 (fictícia)',
  geometria: geometriaBroca(10, 118, 87, 'aço rápido', '0,10–0,25 mm/volta'),
  diametro: 10,
  comprimentoUtil: 87,
  torqueLimite: 20,
  forcaAvancoLimite: 4500,
  sobremedida: 0.08,
  janelaCavaco: { fMin: 0.1, fMax: 0.25 },
  custo: 5,
  observacoes: ['Broca de uso geral.', OBS_BROCA],
};

export const hssD16: Broca = {
  ...hssD6,
  id: 'hss-d16',
  codigo: 'Broca HSS Ø16',
  nome: 'Broca helicoidal HSS Ø16 (fictícia)',
  geometria: geometriaBroca(16, 118, 120, 'aço rápido', '0,15–0,35 mm/volta'),
  diametro: 16,
  comprimentoUtil: 120,
  torqueLimite: 80,
  forcaAvancoLimite: 9000,
  sobremedida: 0.1,
  raBase: 3.6,
  janelaCavaco: { fMin: 0.15, fMax: 0.35 },
  custo: 9,
  observacoes: [
    'Em furo maciço, o gume transversal (centro da broca) gera boa parte da força de avanço. Com um pré-furo, essa parcela desaparece.',
    OBS_BROCA,
  ],
};

export const mdD10: Broca = {
  ...hssD6,
  id: 'md-d10',
  codigo: 'Broca MD Ø10',
  nome: 'Broca inteiriça de metal duro Ø10 (fictícia)',
  classe: 'metal-duro',
  descricaoClasse: 'Metal duro inteiriço, revestida, ponta 140°',
  geometria: geometriaBroca(10, 140, 50, 'metal duro', '0,12–0,30 mm/volta'),
  diametro: 10,
  anguloPonta: 140,
  comprimentoUtil: 50,
  torqueLimite: 28,
  forcaAvancoLimite: 5500,
  sobremedida: 0.02,
  raBase: 1.6,
  janelaCavaco: { fMin: 0.12, fMax: 0.3 },
  custo: 25,
  observacoes: [
    'Aceita vc bem maior que a HSS e faz furo mais preciso, mas custa caro e tem canal curto.',
    OBS_BROCA,
  ],
};

export const ferramentasTornear: FerramentaTornear[] = [md80R08, md80R04, md80R12, md35R02, hssBitR04];
export const brocas: Broca[] = [hssD6, hssD10, hssD16, mdD10];
