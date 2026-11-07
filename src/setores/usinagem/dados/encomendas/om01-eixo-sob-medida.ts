import type { Encomenda } from '../../modelo/tipos';

// Encomenda 1. Todos os requisitos são objetivos fictícios da missão,
// sem classes de ajuste nem requisitos normativos.
export const om01EixoSobMedida: Encomenda = {
  id: 'om01-eixo-sob-medida',
  codigo: 'OM-01',
  titulo: 'O eixo sob medida',
  cliente: 'Bancada de ensaios da oficina-escola (fictício)',
  resumo:
    'Tornear a ponta de um tarugo laminado de Ø 40 mm até Ø 36 (0/−0,05) mm, isto é, entre 35,95 e 36,00 mm, em 50 ± 0,5 mm de comprimento, com Ra estimada ≤ 1,6 µm.',
  contexto: [
    'A ponta torneada recebe um rolamento na bancada. Por isso o diâmetro e o acabamento importam, e o resto do tarugo pode continuar bruto.',
    'A tolerância é unilateral: o diâmetro nominal (36,00) é o limite superior. Programar exatamente o nominal não garante uma peça dentro da tolerância.',
    'Os requisitos são objetivos desta missão. Não correspondem a uma norma nem a uma classe de ajuste real.',
  ],
  materialId: 'ac45-laminado',
  maquinaId: 'torno-td1',
  ferramentasPermitidas: ['md80-r08', 'md80-r04', 'md80-r12', 'md35-r02', 'hss-bit-r04'],
  torreInicial: { 1: 'md80-r08' },
  tarugo: { diametro: 40, comprimentoTotal: 110, comprimentoFixado: 35 },
  fixacao: 'Placa universal de 3 castanhas, 35 mm fixados, 75 mm em balanço, sem contraponta (predefinida).',
  requisitos: {
    diametro: { nominal: 36.0, tolSup: 0, tolInf: -0.05 },
    comprimento: { nominal: 50, tol: 0.5 },
    ra: { max: 1.6 },
  },
  pontosMedicao: [
    { id: 'A', z: 5, descricao: 'Seção A — perto da face livre' },
    { id: 'B', z: 25, descricao: 'Seção B — meio da região usinada' },
    { id: 'C', z: 45, descricao: 'Seção C — perto do ressalto' },
    { id: 'R', z: 62, descricao: 'Seção R — região que deve permanecer bruta' },
  ],
  instrumentos: {
    micrometro: {
      resolucao: 0.01,
      incerteza: 0.01,
      descricao:
        'Micrômetro externo 25–50 mm. A leitura é o diâmetro do modelo arredondado à resolução de 0,01 mm. A incerteza didática de ±0,01 mm é declarada e não é sorteada.',
    },
    paquimetro: {
      resolucao: 0.05,
      descricao: 'Paquímetro para o comprimento usinado: posição do ressalto arredondada a 0,05 mm.',
    },
  },
  custos: { tarugo: 12, minutoMaquina: 1.5 },
  tempos: {
    naoProdutivoPorPasse: 0.4,
    trocaAresta: 1.5,
    preparacaoTarugo: 3.0,
    limpezaCavaco: 0.3,
    montagemFerramenta: 1.0,
  },
  modoEncomenda: { orcamento: 35, tarugos: 2, arestas: 2 },
};
