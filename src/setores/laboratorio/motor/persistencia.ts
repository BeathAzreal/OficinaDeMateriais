/** Salvamento do progresso no navegador (localStorage). */
import type { EstadoJogo } from './tipos';

const CHAVE = 'laboratorio-de-falhas:v1';

interface Salvo {
  atual: string | null;
  partidas: Record<string, EstadoJogo>;
}

function ler(): Salvo {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return { atual: null, partidas: {} };
    const dado = JSON.parse(bruto) as Salvo;
    if (!dado || typeof dado !== 'object' || !dado.partidas) return { atual: null, partidas: {} };
    return dado;
  } catch {
    return { atual: null, partidas: {} };
  }
}

function escrever(s: Salvo): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(s));
  } catch {
    // armazenamento indisponível (modo privado, cota): o jogo segue sem salvar
  }
}

export function carregarPartida(): EstadoJogo | null {
  const s = ler();
  if (!s.atual) return null;
  const e = s.partidas[s.atual];
  return e && e.versao === 1 ? e : null;
}

export function salvarPartida(estado: EstadoJogo): void {
  const s = ler();
  s.partidas[estado.casoId] = estado;
  s.atual = estado.casoId;
  escrever(s);
}

export function apagarPartida(casoId: string): void {
  const s = ler();
  delete s.partidas[casoId];
  if (s.atual === casoId) s.atual = null;
  escrever(s);
}
