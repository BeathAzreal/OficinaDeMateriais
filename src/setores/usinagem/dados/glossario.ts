// Explicações curtas usadas na interface (dados, separados dos componentes).

export interface Termo {
  id: string;
  termo: string;
  simbolo?: string;
  unidade?: string;
  texto: string;
}

export const glossario: Termo[] = [
  {
    id: 'vc',
    termo: 'Velocidade de corte',
    simbolo: 'vc',
    unidade: 'm/min',
    texto:
      'É a velocidade da superfície da peça passando pela aresta: vc = π·D·n/1000. Não é ajustada diretamente: resulta do diâmetro e da rotação. Com a mesma rotação, um diâmetro menor tem vc menor.',
  },
  {
    id: 'n',
    termo: 'Rotação do eixo-árvore',
    simbolo: 'n',
    unidade: 'rpm',
    texto: 'Número de voltas por minuto da placa e da peça. É o que se ajusta neste torno, que não tem velocidade de corte constante.',
  },
  {
    id: 'f',
    termo: 'Avanço por volta',
    simbolo: 'f',
    unidade: 'mm/volta',
    texto:
      'Quanto a ferramenta anda ao longo do eixo a cada volta da peça. Define a distância entre as marcas deixadas pela ponta e, junto com a rotação, a velocidade de avanço vf = f·n.',
  },
  {
    id: 'vf',
    termo: 'Velocidade de avanço',
    simbolo: 'vf',
    unidade: 'mm/min',
    texto: 'vf = f·n. O tempo de corte é o percurso dividido por vf.',
  },
  {
    id: 'ap',
    termo: 'Profundidade radial de corte',
    simbolo: 'ap',
    unidade: 'mm',
    texto:
      'Quanto a ferramenta penetra medido no raio. Como a peça gira, o mesmo ap é removido dos dois lados do eixo, e o diâmetro diminui 2·ap.',
  },
  {
    id: 'sobremetal',
    termo: 'Sobremetal',
    unidade: 'mm',
    texto:
      'Material que ainda precisa ser removido até a dimensão final. No planejamento, decide-se quanto sai no desbaste e quanto fica para o acabamento.',
  },
  {
    id: 'desbaste',
    termo: 'Desbaste e acabamento',
    texto:
      'São estratégias, não botões com efeito próprio. O desbaste remove a maior parte do sobremetal com ap e f maiores. O acabamento remove pouco material, com força menor e avanço escolhido para a rugosidade. O rótulo não altera o resultado: os parâmetros, sim.',
  },
  {
    id: 'tolerancia',
    termo: 'Tolerância dimensional',
    unidade: 'mm',
    texto:
      'Faixa admissível em torno da dimensão nominal. Em "Ø 36 (0/−0,05)", o nominal é 36,00 e os limites são 36,00 (superior) e 35,95 (inferior). O nominal é uma referência; a peça precisa estar entre os limites.',
  },
  {
    id: 'medicao',
    termo: 'Resolução e incerteza de medição',
    unidade: 'mm',
    texto:
      'O micrômetro mostra valores em passos de 0,01 mm (resolução). A incerteza didática de ±0,01 mm lembra que uma leitura no limite não garante a conformidade. Não há ruído sorteado: a mesma peça dá sempre a mesma leitura.',
  },
  {
    id: 'ra',
    termo: 'Rugosidade Ra',
    unidade: 'µm',
    texto:
      'Média aritmética dos desvios do perfil da superfície em relação à linha média. O jogo estima Ra somando a parcela geométrica do avanço a parcelas sintéticas de aresta postiça, desgaste, atrito e lascamento. É uma estimativa didática, não uma medição.',
  },
  {
    id: 'apc',
    termo: 'Aresta postiça',
    texto:
      'Material da peça que adere à aresta em velocidade de corte baixa, típico de aços dúcteis. Ela cresce e se desprende, piora o acabamento e muda a geometria efetiva da ferramenta.',
  },
  {
    id: 'vb',
    termo: 'Desgaste de flanco (VB)',
    unidade: 'mm',
    texto:
      'Largura da marca de desgaste na face de folga. Quanto maior a VB, mais a ponta recua (o diâmetro aumenta) e pior o acabamento. O jogo adota 0,30 mm como limite didático.',
  },
  {
    id: 'deflexao',
    termo: 'Deflexão',
    unidade: 'mm',
    texto:
      'A força de corte empurra a ferramenta e a peça em sentidos opostos. A placa, o carro e a própria peça em balanço cedem um pouco, e a ponta corta menos do que o programado.',
  },
  {
    id: 'carepa',
    termo: 'Carepa de laminação',
    texto: 'Óxido formado na superfície durante a laminação a quente. É mais duro e abrasivo que o aço por baixo e acelera o desgaste no primeiro passe.',
  },
  {
    id: 'quebracavaco',
    termo: 'Quebra-cavaco',
    texto:
      'Geometria na face de saída do inserto que curva o cavaco até ele quebrar. Só funciona dentro de uma janela de avanço e profundidade. Fora dela, aços dúcteis formam fita longa.',
  },
];
