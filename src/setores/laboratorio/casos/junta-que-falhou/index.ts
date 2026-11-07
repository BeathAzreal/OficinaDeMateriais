import type { CasoDefinicao } from '../tipos';
import { publico } from './ficha';
import { verdade } from './verdade';
import { gabarito } from './gabarito';

export const juntaQueFalhou: CasoDefinicao = {
  id: 'junta-que-falhou',
  versao: 1,
  publico,
  verdade,
  gabarito,
};
