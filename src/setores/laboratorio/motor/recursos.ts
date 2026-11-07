/**
 * Tabela de custos (fictícios) e consumo de orçamento/tempo.
 * Os valores são de jogo, escolhidos para criar escolhas; não são preços reais de laboratório.
 */
import type { Ampliacao, Ataque, Carga, Limpeza, Lixamento, Polimento } from '../casos/tipos';
import type { Custo, EstadoJogo, RegistroGasto } from './tipos';

export const CUSTOS = {
  documento: { reais: 0, horas: 0.5 },
  limpeza: {
    suave: { reais: 60, horas: 0.5 },
    agressiva: { reais: 30, horas: 0.25 },
  } as Record<Exclude<Limpeza, 'como-recebida'>, Custo>,
  visual: {
    geral: { reais: 20, horas: 0.25 },
    detalhe: { reais: 40, horas: 0.5 },
  },
  corte: { reais: 200, horas: 2 },
  lixamento: {
    'lixa-220': { reais: 20, horas: 0.5 },
    'lixa-600': { reais: 40, horas: 1 },
    'lixa-1200': { reais: 60, horas: 1.5 },
  } as Record<Lixamento, Custo>,
  polimento: {
    nenhum: { reais: 0, horas: 0 },
    'diamante-6': { reais: 60, horas: 1 },
    'diamante-6-1': { reais: 100, horas: 1.5 },
  } as Record<Polimento, Custo>,
  ataque: {
    nenhum: { reais: 0, horas: 0 },
    'nital-5s': { reais: 15, horas: 0.25 },
    'nital-30s': { reais: 15, horas: 0.25 },
  } as Record<Ataque, Custo>,
  micrografia: {
    10: { reais: 30, horas: 0.25 },
    100: { reais: 40, horas: 0.4 },
    500: { reais: 50, horas: 0.5 },
  } as Record<Ampliacao, Custo>,
  microdurezaPreparacao: { reais: 100, horas: 0.5 },
  porIndentacao: { reais: 6, horas: 0.05 },
} as const;

export const CARGA_KGF: Record<Carga, number> = { 'HV0.1': 0.1, 'HV0.5': 0.5, 'HV1': 1 };

export function somar(...custos: Custo[]): Custo {
  return custos.reduce((a, c) => ({ reais: a.reais + c.reais, horas: a.horas + c.horas }), { reais: 0, horas: 0 });
}

export function custoPreparo(l: Lixamento, p: Polimento, a: Ataque): Custo {
  return somar(CUSTOS.lixamento[l], CUSTOS.polimento[p], CUSTOS.ataque[a]);
}

export function custoPerfil(nPontos: number): Custo {
  return somar(CUSTOS.microdurezaPreparacao, {
    reais: CUSTOS.porIndentacao.reais * nPontos,
    horas: CUSTOS.porIndentacao.horas * nPontos,
  });
}

export function gastoTotal(estado: EstadoJogo): Custo {
  return somar(...estado.gastos.map((g) => g.custo));
}

export function saldo(estado: EstadoJogo, limites: { orcamento: number; tempoH: number }): Custo {
  const g = gastoTotal(estado);
  return { reais: limites.orcamento - g.reais, horas: limites.tempoH - g.horas };
}

/** Verifica se há recursos; devolve mensagem de erro ou null. */
export function verificarRecursos(
  estado: EstadoJogo,
  limites: { orcamento: number; tempoH: number },
  custo: Custo,
): string | null {
  const s = saldo(estado, limites);
  if (custo.reais > s.reais + 1e-9) {
    return `Orçamento insuficiente: esta etapa custa R$ ${formatarReais(custo.reais)} e restam R$ ${formatarReais(s.reais)}.`;
  }
  if (custo.horas > s.horas + 1e-9) {
    return `Tempo insuficiente: esta etapa leva ${formatarHoras(custo.horas)} e restam ${formatarHoras(s.horas)}.`;
  }
  return null;
}

/** Registra um gasto (não verifica saldo; use `verificarRecursos` antes). */
export function registrarGasto(estado: EstadoJogo, descricao: string, custo: Custo): EstadoJogo {
  const registro: RegistroGasto = {
    id: `G${estado.contador + 1}`,
    descricao,
    custo,
    instante: Date.now(),
  };
  return { ...estado, contador: estado.contador + 1, gastos: [...estado.gastos, registro] };
}

export function formatarReais(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatarHoras(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm} min`;
  return mm === 0 ? `${hh} h` : `${hh} h ${mm.toString().padStart(2, '0')} min`;
}
