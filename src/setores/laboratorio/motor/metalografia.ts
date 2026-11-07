/**
 * Estação de metalografia: corte, preparação e aquisição de micrografias.
 * O modelo de preparação gera artefatos e limitações específicas; a microestrutura vem da verdade do caso.
 */
import type {
  Ampliacao,
  Ataque,
  CasoDefinicao,
  Faixa,
  Forma3D,
  Lixamento,
  Orientacao,
  Polimento,
  Qualidade,
} from '../casos/tipos';
import type { AchadoVisivel, Amostra, AquisicaoMicrografia, EstadoJogo, Limitacao, Preparo } from './tipos';
import { faixasSobrepoem, parteEm, pontoNaPeca, pontoNaSecao, retanguloFatia, xFraturaFace, zonaEm } from './geometria';
import { hashValores } from './rng';
import { ARTEFATOS } from './interpretacoes';

/** Campo de visão (mm) por ampliação, para uma imagem 640 × 400 px. */
export const CAMPO_MM: Record<Ampliacao, { u: number; v: number }> = {
  10: { u: 25.6, v: 16 },
  100: { u: 1.28, v: 0.8 },
  500: { u: 0.256, v: 0.16 },
};

export const MEIA_FATIA = 4;
export const MEIO_COMPRIMENTO_AMOSTRA = 20;

export const NOMES_LIXAMENTO: Record<Lixamento, string> = {
  'lixa-220': 'até lixa #220',
  'lixa-600': '#220 → #600',
  'lixa-1200': '#220 → #600 → #1200',
};
export const NOMES_POLIMENTO: Record<Polimento, string> = {
  nenhum: 'sem polimento',
  'diamante-6': 'pasta de diamante 6 µm',
  'diamante-6-1': 'diamante 6 µm → 1 µm',
};
export const NOMES_ATAQUE: Record<Ataque, string> = {
  nenhum: 'sem ataque',
  'nital-5s': 'Nital 2% ~5 s',
  'nital-30s': 'Nital 2% ~30 s',
};

// ---------------------------------------------------------------------------
// Corte
// ---------------------------------------------------------------------------

export interface PedidoCorte {
  orientacao: Orientacao;
  x: number;
  y: number;
}

/** Calcula a amostra resultante de um pedido de corte, ou um erro explicável. */
export function planejarCorte(caso: CasoDefinicao, estado: EstadoJogo, pedido: PedidoCorte, id: string): Amostra | string {
  const g = caso.verdade.geometria;
  const parte = parteEm(g, pedido.x, Math.min(Math.max(pedido.y, 0.01), g.largura - 0.01), 0);
  if (!parte) return 'Escolha um ponto sobre a peça.';
  let amostra: Amostra;
  if (pedido.orientacao === 'transversal') {
    const posicao = Math.min(Math.max(pedido.y, MEIA_FATIA), g.largura - MEIA_FATIA);
    let ext: Faixa = [pedido.x - MEIO_COMPRIMENTO_AMOSTRA, pedido.x + MEIO_COMPRIMENTO_AMOSTRA];
    const limite = g.comprimento / 2;
    ext = [Math.max(ext[0], -limite), Math.min(ext[1], limite)];
    if (parte === 'A') ext[1] = Math.min(ext[1], xFraturaFace(g) + 0.2);
    else ext[0] = Math.max(ext[0], g.fratura.xPlano - 0.2);
    if (ext[1] - ext[0] < 8) return 'A amostra ficaria curta demais nesta posição.';
    amostra = { id, orientacao: 'transversal', parte, posicao, extensao: ext, meiaFatia: MEIA_FATIA, criadaEm: Date.now() };
  } else {
    if (pedido.x > g.fratura.xPlano - MEIA_FATIA - 0.5 && pedido.x < xFraturaFace(g) + MEIA_FATIA + 0.5) {
      return 'Um corte longitudinal tão perto da fratura atravessaria as duas partes. Escolha uma posição mais afastada.';
    }
    const y0 = Math.max(0, Math.min(pedido.y - MEIO_COMPRIMENTO_AMOSTRA, g.largura - 2 * MEIO_COMPRIMENTO_AMOSTRA));
    amostra = {
      id,
      orientacao: 'longitudinal',
      parte,
      posicao: pedido.x,
      extensao: [y0, Math.min(g.largura, y0 + 2 * MEIO_COMPRIMENTO_AMOSTRA)],
      meiaFatia: MEIA_FATIA,
      criadaEm: Date.now(),
    };
  }
  const nova = retanguloFatia(amostra);
  for (const a of estado.amostras) {
    const r = retanguloFatia(a);
    if (faixasSobrepoem(nova.x, r.x) && faixasSobrepoem(nova.y, r.y)) {
      return `Material já removido nesta região pela amostra ${a.id}.`;
    }
  }
  return amostra;
}

export function descreverAmostra(a: Amostra): string {
  const f = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return a.orientacao === 'transversal'
    ? `${a.id} · transversal à junta em y = ${f(a.posicao)} mm · parte ${a.parte} · x de ${f(a.extensao[0])} a ${f(a.extensao[1])} mm`
    : `${a.id} · longitudinal ao cordão em x = ${f(a.posicao)} mm · parte ${a.parte} · y de ${f(a.extensao[0])} a ${f(a.extensao[1])} mm`;
}

// ---------------------------------------------------------------------------
// Preparação
// ---------------------------------------------------------------------------

const NIVEL_RISCOS: Record<Lixamento, Record<Polimento, number>> = {
  'lixa-220': { nenhum: 3, 'diamante-6': 1.5, 'diamante-6-1': 1.0 },
  'lixa-600': { nenhum: 2.5, 'diamante-6': 1.0, 'diamante-6-1': 0.3 },
  'lixa-1200': { nenhum: 2, 'diamante-6': 0.6, 'diamante-6-1': 0 },
};

/** Nível de riscos residuais (0 = nenhum). */
export function nivelRiscos(p: Pick<Preparo, 'lixamento' | 'polimento'>): number {
  return NIVEL_RISCOS[p.lixamento][p.polimento];
}

/** Abaixo deste nível os riscos não aparecem na ampliação. */
const LIMIAR_RISCOS: Record<Ampliacao, number> = { 10: 2.5, 100: 1.0, 500: 0.25 };

/** Quanto os riscos excedem o limiar de visibilidade na ampliação (≤ 0: invisíveis). */
export function excessoRiscos(p: Pick<Preparo, 'lixamento' | 'polimento'>, amp: Ampliacao): number {
  const n = nivelRiscos(p);
  return n <= 0 ? -1 : n - LIMIAR_RISCOS[amp];
}

export function temArrancamento(p: Pick<Preparo, 'lixamento' | 'polimento'>): boolean {
  return p.lixamento === 'lixa-220' && p.polimento !== 'nenhum';
}

export function limitacoesPreparo(p: Pick<Preparo, 'lixamento' | 'polimento' | 'ataque'>): Limitacao[] {
  const lim: Limitacao[] = [];
  const n = nivelRiscos(p);
  if (p.polimento === 'nenhum') {
    lim.push({
      id: 'mg-riscos',
      severidade: 'grave',
      texto: `Superfície sem polimento (${NOMES_LIXAMENTO[p.lixamento]}): riscos encobrem a microestrutura a 100× e 500× e podem imitar trincas finas.`,
      explicacao: 'A macrografia tolera superfícies lixadas; a micrografia exige polimento para remover os riscos da última lixa.',
    });
  } else if (n >= 1) {
    lim.push({
      id: 'mg-riscos-residuais',
      severidade: 'atencao',
      texto: 'Riscos residuais visíveis em 100×/500×: a microestrutura fica parcialmente encoberta.',
      explicacao: 'O polimento não removeu os riscos de uma lixa grossa. Use a sequência completa de lixas e polimento até 1 µm.',
    });
  } else if (n > 0) {
    lim.push({
      id: 'mg-riscos-finos',
      severidade: 'info',
      texto: 'Riscos finos podem aparecer a 500×.',
      explicacao: 'Não impedem a leitura da microestrutura, mas não devem ser confundidos com trincas.',
    });
  }
  if (temArrancamento(p)) {
    lim.push({
      id: 'mg-arrancamento',
      severidade: 'atencao',
      texto: 'Etapas de lixamento puladas (#220 direto ao polimento): camada deformada e arrancamentos de partículas.',
      explicacao: 'Saltos grandes de abrasivo deixam deformação e cavidades de preparação, que podem ser confundidas com porosidade.',
    });
  }
  if (p.ataque === 'nenhum') {
    lim.push({
      id: 'mg-sem-ataque',
      severidade: 'info',
      texto: 'Sem ataque: a microestrutura não é revelada; trincas, poros e inclusões aparecem com bom contraste.',
      explicacao: 'Examinar primeiro sem ataque é útil para procurar descontinuidades; depois, ataque para ver as fases.',
    });
  }
  if (p.ataque === 'nital-30s') {
    lim.push({
      id: 'mg-sobreataque',
      severidade: 'grave',
      texto: 'Ataque prolongado: contraste excessivo, constituintes pouco distinguíveis e trincas finas mascaradas.',
      explicacao: 'Tempo de ataque longo escurece tudo e alarga contornos. Repolir e atacar por menos tempo.',
    });
  }
  return lim;
}

export function descreverPreparo(p: Preparo): string {
  return `${p.id} · ${NOMES_LIXAMENTO[p.lixamento]} · ${NOMES_POLIMENTO[p.polimento]} · ${NOMES_ATAQUE[p.ataque]}`;
}

// ---------------------------------------------------------------------------
// Micrografia
// ---------------------------------------------------------------------------

export function janelaCampo(centro: { u: number; v: number }, amp: Ampliacao): { u: Faixa; v: Faixa } {
  const c = CAMPO_MM[amp];
  return { u: [centro.u - c.u / 2, centro.u + c.u / 2], v: [centro.v - c.v / 2, centro.v + c.v / 2] };
}

/** Traço 2D de uma forma no plano da amostra (círculos ou polilinha), ou null se não cruza o plano. */
export type Traco = { tipo: 'circulos'; circulos: { u: number; v: number; r: number }[] } | { tipo: 'linha'; pontos: [number, number][]; largura: number };

export function tracoNoPlano(forma: Forma3D, a: Amostra): Traco | null {
  if (forma.tipo === 'esferas') {
    const circulos: { u: number; v: number; r: number }[] = [];
    for (const e of forma.esferas) {
      const d = a.orientacao === 'transversal' ? a.posicao - e.y : a.posicao - e.x;
      if (Math.abs(d) >= e.r) continue;
      const r = Math.sqrt(e.r * e.r - d * d);
      circulos.push(a.orientacao === 'transversal' ? { u: e.x, v: e.z, r } : { u: e.y, v: e.z, r });
    }
    return circulos.length ? { tipo: 'circulos', circulos } : null;
  }
  const t = a.orientacao === 'transversal' ? forma.transversal : forma.longitudinal;
  if (!t) return null;
  const faixa = a.orientacao === 'transversal' ? (t as { y: Faixa }).y : (t as { x: Faixa }).x;
  if (a.posicao < faixa[0] || a.posicao > faixa[1]) return null;
  return { tipo: 'linha', pontos: t.pontos, largura: forma.largura };
}

function tracoNaJanela(t: Traco, j: { u: Faixa; v: Faixa }): Traco | null {
  if (t.tipo === 'circulos') {
    const c = t.circulos.filter((x) => x.u + x.r > j.u[0] && x.u - x.r < j.u[1] && x.v + x.r > j.v[0] && x.v - x.r < j.v[1]);
    return c.length ? { tipo: 'circulos', circulos: c } : null;
  }
  const dentro = t.pontos.some(([u, v]) => u >= j.u[0] && u <= j.u[1] && v >= j.v[0] && v <= j.v[1]);
  return dentro ? t : null;
}

function rebaixar(q: Qualidade, niveis: number): Qualidade {
  const ordem: Qualidade[] = ['nitida', 'tenue', 'comprometida'];
  return ordem[Math.min(2, ordem.indexOf(q) + niveis)];
}

/** Faixa 3D coberta por uma janela do plano da amostra. */
function caixaDaJanela(a: Amostra, j: { u: Faixa; v: Faixa }): { x: Faixa; y: Faixa; z: Faixa } {
  return a.orientacao === 'transversal'
    ? { x: j.u, y: [a.posicao, a.posicao], z: j.v }
    : { x: [a.posicao, a.posicao], y: j.u, z: j.v };
}

function cruzaCaixa(c: { x: Faixa; y: Faixa; z: Faixa }, caixa: { x?: Faixa; y?: Faixa; z?: Faixa }): boolean {
  const ok = (a: Faixa, b?: Faixa) => !b || (a[0] <= b[1] && b[0] <= a[1]);
  return ok(c.x, caixa.x) && ok(c.y, caixa.y) && ok(c.z, caixa.z);
}

export interface PedidoMicrografia {
  preparoId: string;
  ampliacao: Ampliacao;
  centro: { u: number; v: number };
}

/** Fração do campo que cai dentro da amostra (amostragem em grade). */
export function fracaoNaAmostra(caso: CasoDefinicao, a: Amostra, j: { u: Faixa; v: Faixa }): number {
  let dentro = 0;
  const n = 12;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      const u = j.u[0] + ((j.u[1] - j.u[0]) * (i + 0.5)) / n;
      const v = j.v[0] + ((j.v[1] - j.v[0]) * (k + 0.5)) / n;
      if (pontoNaSecao(caso, a, u, v)) dentro++;
    }
  }
  return dentro / (n * n);
}

export function adquirirMicrografia(
  caso: CasoDefinicao,
  amostra: Amostra,
  preparo: Preparo,
  pedido: PedidoMicrografia,
  id: string,
): AquisicaoMicrografia | string {
  const g = caso.verdade.geometria;
  const amp = pedido.ampliacao;
  const janela = janelaCampo(pedido.centro, amp);
  const fracao = fracaoNaAmostra(caso, amostra, janela);
  if (amp !== 10 && !pontoNaSecao(caso, amostra, pedido.centro.u, pedido.centro.v)) {
    return 'O centro do campo está fora da amostra (na resina de embutimento). Escolha um ponto sobre a seção.';
  }
  if (fracao === 0) return 'O campo não contém a amostra.';

  const centro3d = pontoNaPeca(amostra, pedido.centro.u, pedido.centro.v);
  const zonaCentro = zonaEm(g, centro3d.x, centro3d.y, centro3d.z);
  const caixa = caixaDaJanela(amostra, janela);
  const excesso = excessoRiscos(preparo, amp);
  const achados: AchadoVisivel[] = [];

  for (const a of caso.verdade.achadosMetalografia) {
    if (a.orientacoes && !a.orientacoes.includes(amostra.orientacao)) continue;
    const regra = a.regras.find((r) => r.ampliacoes.includes(amp) && r.ataques.includes(preparo.ataque));
    if (!regra) continue;
    let qualidade = regra.qualidade;
    let marcadores: AchadoVisivel['marcadores'] = [];
    let desenho: AchadoVisivel['forma'];
    if (a.modo === 'campo') {
      if (a.zonas && (!zonaCentro || !a.zonas.includes(zonaCentro))) continue;
      if (a.caixa && !cruzaCaixa(caixa, a.caixa)) continue;
      if (excesso >= 1) qualidade = 'comprometida';
      else if (excesso >= 0.4) qualidade = rebaixar(qualidade, 1);
    } else {
      const forma = a.formaId ? caso.verdade.formas[a.formaId] : undefined;
      if (!forma) continue;
      const t0 = tracoNoPlano(forma, amostra);
      const t = t0 && tracoNaJanela(t0, janela);
      if (!t) continue;
      desenho = t.tipo === 'circulos' ? 'circulos' : 'linha';
      marcadores =
        t.tipo === 'circulos'
          ? t.circulos.map((c) => ({ u: c.u, v: c.v, raio: c.r }))
          : t.pontos.map(([u, v]) => ({ u, v, raio: 0.03 }));
      if (a.linhaFina && excesso > 0) qualidade = rebaixar(qualidade, 1);
    }
    achados.push({
      chave: a.id,
      achadoId: a.id,
      modo: a.modo,
      qualidade,
      observacao: a.observacao,
      grupo: a.grupo,
      marcadores,
      forma: desenho,
      requer: a.requer,
    });
  }

  // Artefatos de preparação
  if (excesso > 0) {
    achados.push({
      chave: ARTEFATOS.riscosLixamento.id,
      achadoId: ARTEFATOS.riscosLixamento.id,
      modo: 'campo',
      qualidade: excesso >= 0.4 ? 'nitida' : 'tenue',
      observacao: ARTEFATOS.riscosLixamento.observacao,
      grupo: ARTEFATOS.riscosLixamento.grupo,
      marcadores: [],
    });
  }
  if (temArrancamento(preparo) && amp !== 10) {
    achados.push({
      chave: ARTEFATOS.arrancamento.id,
      achadoId: ARTEFATOS.arrancamento.id,
      modo: 'campo',
      qualidade: 'nitida',
      observacao: ARTEFATOS.arrancamento.observacao,
      grupo: ARTEFATOS.arrancamento.grupo,
      marcadores: [],
    });
  }
  if (preparo.ataque === 'nital-30s') {
    achados.push({
      chave: ARTEFATOS.sobreataque.id,
      achadoId: ARTEFATOS.sobreataque.id,
      modo: 'campo',
      qualidade: 'nitida',
      observacao: ARTEFATOS.sobreataque.observacao,
      grupo: ARTEFATOS.sobreataque.grupo,
      marcadores: [],
    });
  }

  const limitacoes = limitacoesPreparo(preparo).filter((l) => {
    if (l.id === 'mg-riscos' || l.id === 'mg-riscos-residuais' || l.id === 'mg-riscos-finos') return excesso > 0;
    if (l.id === 'mg-arrancamento') return amp !== 10;
    return true;
  });
  if (amp === 10) {
    limitacoes.push({
      id: 'mg-macro',
      severidade: 'info',
      texto: 'A 10× veem-se a forma do cordão, as zonas (com ataque) e cavidades maiores; constituintes exigem 100× ou mais.',
      explicacao: 'A macrografia orienta onde posicionar os campos de maior ampliação.',
    });
  }
  if (amostra.orientacao === 'longitudinal') {
    limitacoes.push({
      id: 'mg-longitudinal',
      severidade: 'info',
      texto: 'Corte longitudinal ao cordão: metal de base, ZTA e zona fundida não aparecem lado a lado.',
      explicacao: 'Para comparar as zonas da junta, use um corte transversal.',
    });
  }
  if (fracao < 0.98) {
    limitacoes.push({
      id: 'mg-borda-campo',
      severidade: 'info',
      texto: 'Parte do campo cai fora da amostra (resina de embutimento).',
      explicacao: 'Bordas ajudam a localizar a superfície ou a fratura, mas reduzem a área útil do campo.',
    });
  }

  const f = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return {
    tipo: 'micrografia',
    id,
    criadaEm: Date.now(),
    rotulo: `${preparo.id} · ${amp}× · centro em ${amostra.orientacao === 'transversal' ? 'x' : 'y'} = ${f(pedido.centro.u)} mm, z = ${f(pedido.centro.v)} mm`,
    amostraId: amostra.id,
    preparoId: preparo.id,
    ampliacao: amp,
    centro: pedido.centro,
    janela,
    achados,
    encontrados: [],
    limitacoes,
    semente: hashValores(preparo.id, amp, pedido.centro.u, pedido.centro.v),
  };
}
