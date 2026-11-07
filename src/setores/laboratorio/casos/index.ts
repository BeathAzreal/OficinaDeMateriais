/** Registro de casos disponíveis. Para cadastrar um novo caso, veja docs/NOVOS-CASOS.md. */
import type { CasoDefinicao } from './tipos';
import { juntaQueFalhou } from './junta-que-falhou';

export const CASOS: CasoDefinicao[] = [juntaQueFalhou];

export function casoPorId(id: string): CasoDefinicao | undefined {
  return CASOS.find((c) => c.id === id);
}
