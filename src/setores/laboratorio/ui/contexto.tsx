import { createContext, useContext } from 'react';
import type { CasoDefinicao } from '../casos/tipos';
import type { EstadoJogo, Resultado } from '../motor/tipos';

export interface Jogo {
  caso: CasoDefinicao;
  estado: EstadoJogo;
  /** Aplica uma ação; mostra o erro (se houver) e devolve o id criado. */
  executar: (acao: (e: EstadoJogo) => Resultado) => string | undefined | false;
  /** Aplica uma transformação que não pode falhar. */
  alterar: (f: (e: EstadoJogo) => EstadoJogo) => void;
  avisar: (texto: string, tipo?: 'erro' | 'ok') => void;
  selecionarResultado: (id: string | null) => void;
  resultadoSelecionado: string | null;
}

export const ContextoJogo = createContext<Jogo | null>(null);

export function useJogo(): Jogo {
  const j = useContext(ContextoJogo);
  if (!j) throw new Error('Contexto do jogo ausente');
  return j;
}
