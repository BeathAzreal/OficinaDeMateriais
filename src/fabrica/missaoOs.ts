import { DIAMETROS_ARAME_MM, type Missao } from '../missoes/catalogo'
import { INFO_JUNTA } from '../modelo/juntas'
import { PECA } from '../modelo/parametros'

/*
 * O que faz: a missão de soldagem da OS-01 (emenda do braço tensor novo).
 * Fica fora do catálogo da História: só se joga pela ordem de serviço.
 * Onde mexer: requisitos e textos da emenda. A peça do jogo tem 150 mm de
 * junta; a barra real (80 × 12 mm) é representada por uma chapa de 6 mm
 * em V, que é o que a bancada do MIG/MAG simula.
 */
export const MISSAO_OS01_EMENDA: Missao = {
  id: 'os01-emenda-braco',
  versao: 1,
  titulo: 'OS-01 · Emenda do braço tensor',
  setor: 'Indústria',
  contexto:
    'Braço tensor novo da peneira vibratória. O laboratório mostrou que o braço anterior trincou no pé da solda, ' +
    'numa ZTA endurecida, a partir de uma mordedura no reinício do cordão. Agora a emenda é feita com o procedimento corrigido.',
  finalidade: 'Emenda que trabalha em flexão alternada (fadiga): pé do cordão suave, sem mordedura e sem reinício brusco.',
  material: 'aco-medio-carbono',
  condicaoFornecimento:
    'Aço SAE 1045 conferido pelo certificado e pela marcação da corrida. Bordas chanfradas a 30° (V de 60°), face de raiz de 1 mm, ' +
    'tinta e óleo removidos. A peça custa a esquentar: o começo do passe sai frio se a peça estiver fria (pré-aquecimento).',
  geometria: { comprimentoMm: PECA.comprimentoMm, larguraChapaMm: PECA.larguraChapaMm, espessuraMm: 6, aberturaMm: 1, junta: 'v' },
  montagem: { rolagemGraus: INFO_JUNTA.v.rolagemInicialGraus, giroGraus: 0, fixa: false },
  processo: 'MIG/MAG',
  equipamentos: [
    'Fonte de tensão constante (tensão de 14 a 30 V, alimentação de 1 a 15 m/min)',
    'Tocha MIG/MAG com bico e regulador de gás',
    'Polaridade fixa: corrente contínua, eletrodo positivo (CC+)',
  ],
  junta: 'Junta de topo com chanfro em V (60°)',
  tipoSolda: 'Solda em chanfro em V, por um lado, com o V cheio',
  posicao: 'Plana (a peça está num posicionador)',
  trecho: { inicioMm: 10, fimMm: 140 },
  requisitos: { larguraMinMm: 7.5, larguraMaxMm: 10, reforcoMaxMm: 2.5, alinhamentoMm: 1.5 },
  consumiveis: { diametrosMm: DIAMETROS_ARAME_MM, gases: ['ar-co2', 'co2'] },
  tentativas: { aprendiz: 6, profissional: 4 },
  integridadeMinima: { aprendiz: 0.85, profissional: 0.92 },
  aberturasPlanejadas: 2,
  desafio:
    'Encher o V sem morder a borda: reforço baixo e pé suave (fadiga). Evite parar e reabrir o arco no meio; se precisar, retome sobre o cordão já feito.',
}
