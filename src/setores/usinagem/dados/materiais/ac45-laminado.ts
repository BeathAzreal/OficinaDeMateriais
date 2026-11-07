import type { Material } from '../../modelo/tipos';
import { classificadorDuctil, fatorCasca, janelaApc, vidaTaylor } from './comum';

// Aço carbono médio teor, laminado a quente — designação fictícia do jogo.
// Todos os parâmetros de comportamento são SINTÉTICOS (ordem de grandeza plausível,
// sem validação experimental). Ver docs/MODELO.md, tabela de parâmetros.

const rugosidadeApc = janelaApc(45, 120, 2.5);

export const ac45Laminado: Material = {
  id: 'ac45-laminado',
  nome: 'Aço AC-45',
  familia: 'Aço carbono médio teor',
  designacao:
    'AC-45 — aço carbono não ligado com ≈ 0,45 % C (designação fictícia do jogo; família comparável à dos aços médio carbono, como o SAE 1045)',
  condicaoFornecimento: 'Laminado a quente',
  descricaoCondicao:
    'Barra redonda laminada a quente, sem tratamento térmico posterior. A superfície mantém a carepa (óxido de laminação), dura e abrasiva.',
  composicao: [
    { rotulo: 'Carbono', valor: '≈ 0,45 %', origem: 'sintetico', nota: 'Valor nominal do jogo' },
    { rotulo: 'Manganês', valor: '≈ 0,7 %', origem: 'sintetico', nota: 'Valor nominal do jogo' },
  ],
  propriedades: [
    { rotulo: 'Dureza', valor: '≈ 180 HB', origem: 'sintetico', nota: 'Ordem de grandeza; não entra diretamente em nenhuma equação do jogo' },
    { rotulo: 'Módulo de elasticidade E', valor: '210 GPa', origem: 'literatura-geral', nota: 'Valor típico de aços, usado na flexão da peça em balanço' },
    { rotulo: 'Energia específica de corte (Kienzle)', valor: 'kc1.1 = 1700 N/mm², mc = 0,25', origem: 'sintetico', nota: 'Alimenta só os indicadores de carga e a deflexão' },
    { rotulo: 'Ductilidade', valor: 'moderada (qualitativo)', origem: 'sintetico', nota: 'Cavaco contínuo e aresta postiça em vc baixa' },
    { rotulo: 'Carepa de laminação', valor: 'espessura ≈ 0,25 mm (sintético)', origem: 'sintetico', nota: 'Acelera o desgaste no passe que corta a superfície original' },
  ],
  microestrutura: {
    descricao: 'Ferrita proeutetoide (grãos claros) e perlita (colônias lamelares de ferrita + cementita).',
    esquema: { tipo: 'ferrita-perlita', fracaoPerlita: 0.58 },
    legenda: 'Perlita (lamelas escuras) · ferrita proeutetoide (clara)',
    calculo:
      'Regra da alavanca no equilíbrio: fração de perlita ≈ (0,45 − 0,022)/(0,76 − 0,022) ≈ 0,58. Depois da laminação, o resfriamento ao ar se afasta do equilíbrio, e a fração real pode ser diferente.',
  },
  interpretacao: [
    'A dureza sozinha não determina a usinabilidade. Neste aço, a ductilidade da ferrita favorece cavaco contínuo e aresta postiça, e a cementita da perlita aumenta o desgaste abrasivo.',
    'A carepa da laminação é mais abrasiva que o aço por baixo dela. Por isso o primeiro passe desgasta mais a aresta, principalmente se ficar dentro da carepa.',
  ],
  casca: {
    nome: 'Carepa de laminação',
    espessura: 0.25,
    descricao: 'Camada superficial de óxido e superfície descarbonetada (sintética, 0,25 mm).',
  },
  cores: { bruta: ['#5c626b', '#22262c'], usinada: ['#e6ebf1', '#5d6773'] },
  comportamento: {
    forca: { kc11: 1700, mc: 0.25 },
    classificarCavaco: classificadorDuctil(rugosidadeApc, 1),
    rugosidadeApc,
    vidaAresta: vidaTaylor({ 'metal-duro': { vcRef: 200, expoente: 4 }, 'aco-rapido': { vcRef: 30, expoente: 8 } }),
    fatorCasca: fatorCasca(0.25, 2),
    raMinimo: 0.4,
    raAtritoMax: 0.6,
    moduloElasticidade: 210000,
  },
};
