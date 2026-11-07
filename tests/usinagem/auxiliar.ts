import { contextoDe, material, ferramenta } from '../../src/setores/usinagem/dados/catalogo';
import type { Broca, FerramentaTornear } from '../../src/setores/usinagem/modelo/tipos';
import { aplicarAcao, iniciarPartida, type Acao, type EstadoPartida, type Modo } from '../../src/setores/usinagem/jogo/partida';
import type { ParametrosPasse } from '../../src/setores/usinagem/modelo/tipos';

export const ENC = 'om01-eixo-sob-medida';
export const ctx = contextoDe(ENC);
export const aco = material('ac45-laminado');
export const md80 = ferramenta('md80-r08') as FerramentaTornear;
export const amb = { material: aco, ferramenta: md80, maquina: ctx.maquina };
export const ambFuro = (brocaId = 'hss-d10', materialId = 'ac45-laminado') => ({
  material: material(materialId),
  broca: ferramenta(brocaId) as Broca,
  maquina: ctx.maquina,
});

export const passe = (p: Partial<ParametrosPasse>): Acao => ({
  tipo: 'passe',
  params: { n: 1300, f: 0.25, ap: 1.5, L: 50, operacao: 'desbaste', ...p },
});

export function jogar(acoes: Acao[], modo: Modo = 'encomenda'): EstadoPartida {
  let e = iniciarPartida(modo, ENC);
  for (const a of acoes) {
    const r = aplicarAcao(e, a);
    if (!r.ok) throw new Error(`Ação rejeitada (${a.tipo}): ${r.erro}`);
    e = r.estado;
  }
  return e;
}

export function memoria() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
}

/**
 * Plano de referência: desbaste, medição, acabamento compensado (Ø programado 35,96)
 * e medição final.
 */
export const PLANO_BOM: Acao[] = [
  passe({ n: 1300, f: 0.25, ap: 1.5, L: 50, operacao: 'desbaste' }),
  { tipo: 'medir', alvo: 'B' },
  passe({ n: 1700, f: 0.15, ap: 0.52, L: 50, operacao: 'acabamento' }),
  { tipo: 'medir', alvo: 'B' },
];
