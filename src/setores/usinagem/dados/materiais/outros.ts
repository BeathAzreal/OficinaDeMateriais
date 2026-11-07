// Materiais do modo livre. Designações fictícias, comparáveis a famílias reais.
// TODOS os parâmetros de comportamento são SINTÉTICOS: mostram tendências qualitativas
// conhecidas (aresta postiça, cavaco, abrasividade, rigidez), sem validação experimental.

import type { Material } from '../../modelo/tipos';
import { CAVACO, classificadorDuctil, fatorCasca, janelaApc, vidaTaylor } from './comum';

const apcAc10 = janelaApc(60, 160, 3.0);
export const ac10Trefilado: Material = {
  id: 'ac10-trefilado',
  nome: 'Aço AC-10',
  familia: 'Aço baixo carbono',
  designacao: 'AC-10 — aço baixo carbono, ≈ 0,10 % C (fictício; comparável a aços como o SAE 1010)',
  condicaoFornecimento: 'Trefilado (estirado a frio)',
  descricaoCondicao: 'Barra calibrada a frio, superfície lisa e sem carepa, levemente encruada.',
  composicao: [{ rotulo: 'Carbono', valor: '≈ 0,10 %', origem: 'sintetico' }],
  propriedades: [
    { rotulo: 'Dureza', valor: '≈ 130 HB', origem: 'sintetico', nota: 'Mais macio que o AC-45, mas isso não facilita o acabamento' },
    { rotulo: 'Módulo de elasticidade E', valor: '210 GPa', origem: 'literatura-geral' },
    { rotulo: 'Kienzle', valor: 'kc1.1 = 1500 N/mm², mc = 0,26', origem: 'sintetico' },
    { rotulo: 'Ductilidade', valor: 'alta (qualitativo)', origem: 'sintetico', nota: 'Cavaco em fita e aresta postiça em faixa larga de vc' },
  ],
  microestrutura: {
    descricao: 'Quase só ferrita (grãos claros) com pouca perlita; grãos alongados pela trefilação.',
    esquema: { tipo: 'ferrita-perlita', fracaoPerlita: 0.11 },
    legenda: 'Ferrita (clara) predominante · pouca perlita (lamelar)',
    calculo: 'Regra da alavanca no equilíbrio: perlita ≈ (0,10 − 0,022)/(0,76 − 0,022) ≈ 0,11.',
  },
  interpretacao: [
    'Mais macio não quer dizer mais fácil: a ferrita dúctil "empasta", forma aresta postiça até velocidades maiores e cavaco em fita difícil de quebrar.',
    'Sem carepa, o primeiro passe não sofre o desgaste extra da superfície laminada.',
  ],
  cores: { bruta: ['#9aa3ad', '#4a525c'], usinada: ['#eef2f6', '#66707c'] },
  comportamento: {
    forca: { kc11: 1500, mc: 0.26 },
    classificarCavaco: classificadorDuctil(apcAc10, 1.5),
    rugosidadeApc: apcAc10,
    vidaAresta: vidaTaylor({ 'metal-duro': { vcRef: 250, expoente: 4 }, 'aco-rapido': { vcRef: 38, expoente: 8 } }),
    fatorCasca: () => 1,
    raMinimo: 0.6,
    raAtritoMax: 0.8,
    moduloElasticidade: 210000,
  },
};

const apcAl = janelaApc(80, 250, 1.5);
export const al61T6: Material = {
  id: 'al61-t6',
  nome: 'Alumínio AL-61',
  familia: 'Liga de alumínio Al-Mg-Si',
  designacao: 'AL-61 — liga Al-Mg-Si (fictícia; família comparável à 6061)',
  condicaoFornecimento: 'Solubilizada e envelhecida artificialmente (T6)',
  descricaoCondicao: 'Barra extrudada e tratada termicamente. A superfície tem só uma camada fina de óxido, sem efeito no modelo.',
  composicao: [
    { rotulo: 'Magnésio', valor: '≈ 1 %', origem: 'sintetico' },
    { rotulo: 'Silício', valor: '≈ 0,6 %', origem: 'sintetico' },
  ],
  propriedades: [
    { rotulo: 'Dureza', valor: '≈ 95 HB', origem: 'sintetico' },
    { rotulo: 'Módulo de elasticidade E', valor: '69 GPa', origem: 'literatura-geral', nota: 'Cerca de 1/3 do aço: a peça em balanço flete bem mais' },
    { rotulo: 'Kienzle', valor: 'kc1.1 = 800 N/mm², mc = 0,23', origem: 'sintetico' },
    { rotulo: 'Afinidade com a ferramenta', valor: 'alta (qualitativo)', origem: 'sintetico', nota: 'Adesão em vc baixa' },
  ],
  microestrutura: {
    descricao: 'Matriz de alumínio (grãos) com precipitados finos de Mg₂Si formados no envelhecimento (pontos, fora de escala).',
    esquema: { tipo: 'monofasico', corGrao: '#c9d3dd', maclas: false, particulas: { cor: '#4b5563', densidade: 0.5 } },
    legenda: 'Grãos de alumínio · precipitados (pontos, ampliados)',
  },
  interpretacao: [
    'Força de corte baixa e vida de ferramenta longa permitem vc altas. O limite costuma ser a rotação máxima do torno.',
    'O E baixo faz a mesma força passiva gerar mais deflexão que no aço.',
    'Em vc baixa, o alumínio adere à aresta. Por isso subir a vc melhora o acabamento.',
  ],
  cores: { bruta: ['#c3ccd6', '#7d8894'], usinada: ['#f4f7fa', '#8a96a3'] },
  comportamento: {
    forca: { kc11: 800, mc: 0.23 },
    classificarCavaco: classificadorDuctil(apcAl, 1.3),
    rugosidadeApc: apcAl,
    vidaAresta: vidaTaylor({ 'metal-duro': { vcRef: 1200, expoente: 4 }, 'aco-rapido': { vcRef: 250, expoente: 8 } }),
    fatorCasca: () => 1,
    raMinimo: 0.3,
    raAtritoMax: 0.5,
    moduloElasticidade: 69000,
  },
};

export const ff25Fundido: Material = {
  id: 'ff25-fundido',
  nome: 'Ferro fundido FF-25',
  familia: 'Ferro fundido cinzento',
  designacao: 'FF-25 — ferro fundido cinzento perlítico (fictício; família comparável à FC-250)',
  condicaoFornecimento: 'Bruto de fundição',
  descricaoCondicao: 'Barra fundida em molde de areia. A superfície tem pele de fundição com areia aderida, muito abrasiva.',
  composicao: [
    { rotulo: 'Carbono', valor: '≈ 3,3 %', origem: 'sintetico' },
    { rotulo: 'Silício', valor: '≈ 2 %', origem: 'sintetico' },
  ],
  propriedades: [
    { rotulo: 'Dureza', valor: '≈ 200 HB', origem: 'sintetico' },
    { rotulo: 'Módulo de elasticidade E', valor: '110 GPa', origem: 'literatura-geral', nota: 'Ferros cinzentos têm E menor que o aço; o valor varia com a grafita' },
    { rotulo: 'Kienzle', valor: 'kc1.1 = 1100 N/mm², mc = 0,28', origem: 'sintetico' },
    { rotulo: 'Pele de fundição', valor: 'espessura ≈ 0,5 mm (sintético)', origem: 'sintetico' },
  ],
  microestrutura: {
    descricao: 'Matriz perlítica com lamelas de grafita (veios escuros) distribuídas ao acaso.',
    esquema: { tipo: 'grafita-lamelar' },
    legenda: 'Grafita lamelar (veios pretos) · matriz perlítica',
  },
  interpretacao: [
    'As lamelas de grafita interrompem a matriz. O cavaco se rompe em fragmentos, e não há aresta postiça.',
    'A grafita arrancada deixa microcavidades, e por isso o piso de rugosidade é maior que no aço.',
    'Com dureza parecida com a do AC-45, o comportamento é muito diferente: mais um exemplo de que a dureza não determina a usinabilidade sozinha.',
  ],
  casca: { nome: 'Pele de fundição', espessura: 0.5, descricao: 'Camada com areia aderida e microestrutura alterada (sintética, 0,5 mm).' },
  cores: { bruta: ['#4b4440', '#1f1c1a'], usinada: ['#c4c7cb', '#4e5258'] },
  comportamento: {
    forca: { kc11: 1100, mc: 0.28 },
    classificarCavaco: () => CAVACO.fragmentado,
    rugosidadeApc: () => 0,
    vidaAresta: vidaTaylor({ 'metal-duro': { vcRef: 150, expoente: 4 }, 'aco-rapido': { vcRef: 22, expoente: 8 } }),
    fatorCasca: fatorCasca(0.5, 3),
    raMinimo: 0.9,
    raAtritoMax: 0.4,
    moduloElasticidade: 110000,
  },
};

const apcIx = janelaApc(30, 90, 2.0);
export const ix304Solubilizado: Material = {
  id: 'ix304-solubilizado',
  nome: 'Inox IX-304',
  familia: 'Aço inoxidável austenítico',
  designacao: 'IX-304 — aço inoxidável austenítico Cr-Ni (fictício; família comparável ao AISI 304)',
  condicaoFornecimento: 'Solubilizado e decapado',
  descricaoCondicao: 'Barra recozida para solubilização e decapada. Não há carepa, mas o material encrua muito na deformação.',
  composicao: [
    { rotulo: 'Cromo', valor: '≈ 18 %', origem: 'sintetico' },
    { rotulo: 'Níquel', valor: '≈ 8 %', origem: 'sintetico' },
  ],
  propriedades: [
    { rotulo: 'Dureza', valor: '≈ 170 HB', origem: 'sintetico', nota: 'Parecida com a do AC-45, mas a usinabilidade é bem pior' },
    { rotulo: 'Módulo de elasticidade E', valor: '193 GPa', origem: 'literatura-geral' },
    { rotulo: 'Kienzle', valor: 'kc1.1 = 2100 N/mm², mc = 0,21', origem: 'sintetico' },
    { rotulo: 'Encruamento', valor: 'alto (qualitativo)', origem: 'sintetico', nota: 'Passes muito rasos cortam a camada encruada' },
    { rotulo: 'Condutividade térmica', valor: 'baixa (qualitativo)', origem: 'sintetico', nota: 'O calor fica na aresta: vida cai rápido com vc' },
  ],
  microestrutura: {
    descricao: 'Grãos de austenita equiaxiais com maclas de recozimento (faixas paralelas dentro dos grãos).',
    esquema: { tipo: 'monofasico', corGrao: '#d5dbe2', maclas: true },
    legenda: 'Grãos de austenita com maclas',
  },
  interpretacao: [
    'O encruamento faz o passe seguinte cortar material endurecido. Por isso, profundidades muito pequenas são piores aqui que no aço carbono.',
    'Com baixa condutividade térmica, o calor se concentra na aresta: a vida cai mais rápido quando a vc aumenta.',
    'A dureza é parecida com a do AC-45, mas a força, o cavaco em fita e o desgaste são bem diferentes.',
  ],
  cores: { bruta: ['#a7adb4', '#5a6068'], usinada: ['#f0f3f6', '#6f7884'] },
  comportamento: {
    forca: { kc11: 2100, mc: 0.21 },
    classificarCavaco: classificadorDuctil(apcIx, 1.4),
    rugosidadeApc: apcIx,
    vidaAresta: vidaTaylor({ 'metal-duro': { vcRef: 140, expoente: 3.5 }, 'aco-rapido': { vcRef: 18, expoente: 8 } }),
    fatorCasca: () => 1,
    raMinimo: 0.5,
    raAtritoMax: 1.5,
    moduloElasticidade: 193000,
  },
};

export const lt360CorteLivre: Material = {
  id: 'lt360-corte-livre',
  nome: 'Latão LT-360',
  familia: 'Latão de corte livre',
  designacao: 'LT-360 — latão Cu-Zn com chumbo para corte livre (fictício; família comparável ao C36000)',
  condicaoFornecimento: 'Extrudado e trefilado',
  descricaoCondicao: 'Barra calibrada, superfície lisa. As partículas de chumbo ajudam a quebrar o cavaco.',
  composicao: [
    { rotulo: 'Cobre', valor: '≈ 61 %', origem: 'sintetico' },
    { rotulo: 'Chumbo', valor: '≈ 3 %', origem: 'sintetico' },
  ],
  propriedades: [
    { rotulo: 'Dureza', valor: '≈ 90 HB', origem: 'sintetico' },
    { rotulo: 'Módulo de elasticidade E', valor: '100 GPa', origem: 'literatura-geral' },
    { rotulo: 'Kienzle', valor: 'kc1.1 = 780 N/mm², mc = 0,18', origem: 'sintetico' },
  ],
  microestrutura: {
    descricao: 'Grãos de latão α/β com partículas de chumbo dispersas (pontos escuros), insolúveis na matriz.',
    esquema: { tipo: 'monofasico', corGrao: '#d9c27a', maclas: true, particulas: { cor: '#2a2f36', densidade: 0.8 } },
    legenda: 'Grãos de latão · partículas de chumbo (pontos)',
  },
  interpretacao: [
    'As partículas de chumbo funcionam como quebra-cavaco interno: o cavaco sai fragmentado mesmo sem geometria especial.',
    'Não forma aresta postiça no modelo. O acabamento depende quase só do avanço e do raio de ponta.',
  ],
  cores: { bruta: ['#c8a95a', '#6b5626'], usinada: ['#f3e2a6', '#8c7434'] },
  comportamento: {
    forca: { kc11: 780, mc: 0.18 },
    classificarCavaco: () => CAVACO.fragmentado,
    rugosidadeApc: () => 0,
    vidaAresta: vidaTaylor({ 'metal-duro': { vcRef: 600, expoente: 4 }, 'aco-rapido': { vcRef: 120, expoente: 8 } }),
    fatorCasca: () => 1,
    raMinimo: 0.3,
    raAtritoMax: 0.4,
    moduloElasticidade: 100000,
  },
};
