/**
 * Estação de microdureza Vickers: modelo de medição sintético.
 *
 * HV medido = HV verdadeiro (média na área da marca) × variação de fase × vieses (espaçamento, borda)
 *             × ruído de leitura (determinístico pela posição e pela preparação).
 * Diagonal: d = √(1,8544 · F / HV), com F em kgf e d em mm.
 */
import type { CasoDefinicao, Carga } from '../casos/tipos';
import type { AchadoVisivel, Amostra, AquisicaoMicrodureza, Indentacao, Limitacao, Preparo } from './tipos';
import { meiaLarguraFusao, pontoNaPeca, pontoNaSecao, zonaEm } from './geometria';
import { hashValores, normalPadrao } from './rng';
import { CARGA_KGF } from './recursos';
import { nivelRiscos } from './metalografia';

/** Regras práticas usadas pelo jogo (revisar com o professor; não substituem a norma aplicável). */
export const DISTANCIA_MIN_DIAGONAIS = 3;
export const DISTANCIA_BORDA_DIAGONAIS = 2.5;
export const MAX_PONTOS = 80;

const RUIDO_BASE: Record<Carga, number> = { 'HV0.1': 0.04, 'HV0.5': 0.02, HV1: 0.015 };

export function diagonalMm(hv: number, carga: Carga): number {
  return Math.sqrt((1.8544 * CARGA_KGF[carga]) / hv);
}

const ZONAS_FERRITA_PERLITA = new Set(['mb', 'zta-ic', 'zta-gf']);

/** Dureza "verdadeira" suavizada na área de uma marca de diagonal d (mm). */
export function durezaVerdadeira(caso: CasoDefinicao, a: Amostra, u: number, v: number, d = 0.05): number | null {
  const g = caso.verdade.geometria;
  // média sobre a área da marca (meia diagonal) e uma transição curta entre zonas
  const du = Math.max(0.04, d / 2);
  let soma = 0;
  let n = 0;
  for (const ou of [-du, 0, du]) {
    for (const ov of [-0.05, 0, 0.05]) {
      const p = pontoNaPeca(a, u + ou, v + ov);
      const z = zonaEm(g, p.x, p.y, p.z);
      if (!z) continue;
      soma += caso.verdade.zonas[z].dureza;
      n++;
    }
  }
  return n ? soma / n : null;
}

/** Diagonais esperadas para orientar a escolha de espaçamento (antes de medir). */
export function diagonaisReferencia(carga: Carga): { mole: number; dura: number } {
  return { mole: diagonalMm(200, carga), dura: diagonalMm(450, carga) };
}

/** Gera pontos igualmente espaçados numa linha horizontal (v constante). */
export function gerarTrajeto(inicio: number, fim: number, espacamento: number, v: number): { u: number; v: number }[] {
  const pts: { u: number; v: number }[] = [];
  if (espacamento <= 0) return pts;
  const passo = inicio <= fim ? espacamento : -espacamento;
  const n = Math.floor(Math.abs(fim - inicio) / espacamento + 1e-9);
  for (let i = 0; i <= n && pts.length < MAX_PONTOS; i++) pts.push({ u: +(inicio + i * passo).toFixed(4), v });
  return pts;
}

function distanciaBorda(caso: CasoDefinicao, a: Amostra, u: number, v: number, raio: number): boolean {
  for (let k = 0; k < 12; k++) {
    const ang = (k / 12) * 2 * Math.PI;
    if (!pontoNaSecao(caso, a, u + raio * Math.cos(ang), v + raio * Math.sin(ang))) return true;
  }
  return false;
}

export interface PedidoPerfil {
  preparoId: string;
  carga: Carga;
  pontos: { u: number; v: number }[];
}

/**
 * Executa o perfil. `marcasAnteriores` são indentações já feitas na mesma preparação
 * (contam para a verificação de espaçamento).
 */
export function executarPerfil(
  caso: CasoDefinicao,
  amostra: Amostra,
  preparo: Preparo,
  pedido: PedidoPerfil,
  marcasAnteriores: Indentacao[],
  id: string,
): AquisicaoMicrodureza | string {
  const g = caso.verdade.geometria;
  const validos = pedido.pontos.filter((p) => pontoNaSecao(caso, amostra, p.u, p.v));
  const fora = pedido.pontos.length - validos.length;
  if (validos.length === 0) return 'Nenhum ponto está sobre a amostra.';

  const ordenados = [...validos].sort((a, b) => a.u - b.u || a.v - b.v);
  const riscos = nivelRiscos(preparo);
  let sigma = RUIDO_BASE[pedido.carga];
  if (preparo.polimento === 'nenhum') sigma += 0.06;
  else if (riscos >= 1) sigma += 0.02;
  if (preparo.ataque === 'nital-30s') sigma += 0.03;

  const feitas: Indentacao[] = [];
  let nEspaco = 0;
  let nSobreposicao = 0;
  let nBorda = 0;
  for (const p of ordenados) {
    const h0 = durezaVerdadeira(caso, amostra, p.u, p.v, diagonalMm(300, pedido.carga));
    if (h0 === null) continue;
    const ponto3d = pontoNaPeca(amostra, p.u, p.v);
    const zona = zonaEm(g, ponto3d.x, ponto3d.y, ponto3d.z);
    const d0 = diagonalMm(h0, pedido.carga);
    const alertas: string[] = [];
    let vies = 0;

    // fase atingida (ferrita × perlita) — maior com cargas baixas
    let fase = 0;
    if (zona && ZONAS_FERRITA_PERLITA.has(zona)) {
      fase = caso.verdade.variacaoFase[pedido.carga] * normalPadrao('fase', amostra.id, p.u, p.v) * 0.8;
    }

    // vizinhas (na mesma preparação, incluindo perfis anteriores)
    const vizinhas = [...marcasAnteriores, ...feitas];
    let menor = Infinity;
    for (const q of vizinhas) menor = Math.min(menor, Math.hypot(q.u - p.u, q.v - p.v));
    const razao = menor / d0;
    if (razao < 1.2) {
      vies += 0.15;
      alertas.push('hv-sobreposicao');
      nSobreposicao++;
    } else if (razao < DISTANCIA_MIN_DIAGONAIS) {
      vies += 0.07 * ((DISTANCIA_MIN_DIAGONAIS - razao) / (DISTANCIA_MIN_DIAGONAIS - 1.2)) + 0.02;
      alertas.push('hv-espacamento');
      nEspaco++;
    }
    if (distanciaBorda(caso, amostra, p.u, p.v, DISTANCIA_BORDA_DIAGONAIS * d0)) {
      vies -= 0.1;
      alertas.push('hv-borda');
      nBorda++;
    }
    const ruido = sigma * normalPadrao('leitura', preparo.id, pedido.carga, p.u, p.v);
    const hv = Math.round(h0 * (1 + fase) * (1 + vies) * (1 + ruido));
    feitas.push({ u: p.u, v: p.v, hv, diagonal: diagonalMm(hv, pedido.carga), alertas });
  }

  const limitacoes = limitacoesPerfil(caso, amostra, preparo, pedido.carga, feitas, { fora, nEspaco, nSobreposicao, nBorda });
  const achados = leiturasPerfil(caso, amostra, preparo, pedido.carga, feitas);

  return {
    tipo: 'microdureza',
    id,
    criadaEm: Date.now(),
    rotulo: `${preparo.id} · ${pedido.carga.replace('.', ',')} · ${feitas.length} indentações`,
    amostraId: amostra.id,
    preparoId: preparo.id,
    carga: pedido.carga,
    pontos: feitas,
    achados,
    encontrados: [],
    limitacoes,
    semente: hashValores(preparo.id, pedido.carga, feitas.length),
  };
}

function limitacoesPerfil(
  caso: CasoDefinicao,
  a: Amostra,
  p: Preparo,
  carga: Carga,
  pts: Indentacao[],
  n: { fora: number; nEspaco: number; nSobreposicao: number; nBorda: number },
): Limitacao[] {
  const g = caso.verdade.geometria;
  const lim: Limitacao[] = [];
  if (n.nSobreposicao > 0) {
    lim.push({
      id: 'hv-sobreposicao',
      severidade: 'grave',
      texto: `${n.nSobreposicao} indentação(ões) praticamente sobre outra marca: valores inválidos.`,
      explicacao: 'Uma marca sobre a região deformada de outra mede material encruado. Descarte esses pontos.',
    });
  }
  if (n.nEspaco > 0) {
    lim.push({
      id: 'hv-espacamento',
      severidade: 'atencao',
      texto: `${n.nEspaco} indentação(ões) a menos de ${DISTANCIA_MIN_DIAGONAIS} diagonais de uma vizinha: valores podem estar elevados pelo encruamento ao redor da marca anterior.`,
      explicacao:
        'Ao redor de cada marca o material fica deformado. Aumente o espaçamento ou reduza a carga (marcas menores permitem pontos mais próximos).',
    });
  }
  if (n.nBorda > 0) {
    lim.push({
      id: 'hv-borda',
      severidade: 'atencao',
      texto: `${n.nBorda} indentação(ões) a menos de ${DISTANCIA_BORDA_DIAGONAIS} diagonais de uma borda: valores podem estar reduzidos por falta de suporte.`,
      explicacao: 'Perto de bordas (superfície, fratura, fim da amostra) o material escoa para fora e a marca fica maior.',
    });
  }
  if (n.fora > 0) {
    lim.push({
      id: 'hv-fora',
      severidade: 'info',
      texto: `${n.fora} ponto(s) fora da amostra foram ignorados (sem custo).`,
      explicacao: 'Pontos sobre a resina de embutimento não são medidos.',
    });
  }
  if (p.polimento === 'nenhum') {
    lim.push({
      id: 'hv-superficie',
      severidade: 'grave',
      texto: 'Superfície apenas lixada: diagonais mal definidas e dispersão elevada.',
      explicacao: 'A leitura das diagonais exige superfície polida. Prepare novamente a amostra.',
    });
  } else if (nivelRiscos(p) >= 1) {
    lim.push({
      id: 'hv-riscos',
      severidade: 'atencao',
      texto: 'Riscos residuais atrapalham a leitura das diagonais: dispersão maior.',
      explicacao: 'Use a sequência completa de lixas e polimento fino.',
    });
  }
  if (p.ataque === 'nital-30s') {
    lim.push({
      id: 'hv-sobreataque',
      severidade: 'atencao',
      texto: 'Superfície muito atacada: vértices das marcas difíceis de localizar.',
      explicacao: 'Para microdureza, um ataque leve basta para localizar as zonas.',
    });
  }
  if (p.ataque === 'nenhum') {
    lim.push({
      id: 'hv-sem-ataque',
      severidade: 'info',
      texto: 'Sem ataque, a posição das indentações em relação às zonas da junta não pode ser verificada.',
      explicacao: 'Um ataque leve revela linha de fusão e ZTA, permitindo relacionar cada valor com a região medida.',
    });
  }
  if (a.orientacao === 'longitudinal') {
    lim.push({
      id: 'hv-longitudinal',
      severidade: 'atencao',
      texto: 'Trajeto num corte longitudinal ao cordão: não compara metal de base, ZTA e zona fundida.',
      explicacao: 'Perfis de junta soldada são feitos em cortes transversais, atravessando todas as zonas.',
    });
  } else {
    const perto = pts.some((q) => Math.abs(q.u) < meiaLarguraFusao(g, Math.max(0, q.v)));
    const longe = pts.some((q) => Math.abs(q.u) > 12);
    if (!perto || !longe) {
      lim.push({
        id: 'hv-nao-atravessa',
        severidade: 'atencao',
        texto: 'O trajeto não vai do metal de base (> 12 mm do eixo) até a zona fundida: a comparação entre zonas fica incompleta.',
        explicacao: 'Um perfil de junta deve atravessar metal de base, ZTA e zona fundida.',
      });
    }
    const naFaixa = pts.some((q) => {
      const p3 = pontoNaPeca(a, q.u, q.v);
      const z = zonaEm(g, p3.x, p3.y, p3.z);
      return z === 'zta-gg-acab' || z === 'zta-gg-rev';
    });
    if (!naFaixa) {
      lim.push({
        id: 'hv-faixa-fusao',
        severidade: 'atencao',
        texto:
          p.ataque === 'nenhum'
            ? 'Nenhuma indentação caiu a menos de ~0,6 mm da linha de fusão; sem ataque, isso não pode ser conferido na imagem.'
            : 'Nenhuma indentação caiu na faixa estreita e escura de grãos grosseiros vizinha à linha de fusão (visível com ataque).',
        explicacao: 'Regiões estreitas podem ficar entre duas marcas. Use espaçamento menor perto da linha de fusão ou acrescente pontos ali.',
      });
    }
  }
  if (carga === 'HV0.1' && pts.some((q) => Math.abs(q.u) > 12)) {
    lim.push({
      id: 'hv-carga-baixa',
      severidade: 'info',
      texto: 'Com HV0,1 as marcas têm o tamanho de grãos e colônias de perlita: no metal de base a dispersão reflete a fase atingida.',
      explicacao: 'Cargas maiores fazem a média sobre várias fases, mas exigem maior espaçamento.',
    });
  }
  if (pts.length < 5) {
    lim.push({
      id: 'hv-poucos-pontos',
      severidade: 'atencao',
      texto: 'Poucos pontos: o perfil não descreve a variação ao longo da junta.',
      explicacao: 'Um perfil útil tem pontos suficientes em cada zona.',
    });
  }
  return lim;
}

function fmt(n: number, casas = 2): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Leituras registráveis como evidência (o achado associado vem da verdade, não é exibido). */
function leiturasPerfil(caso: CasoDefinicao, a: Amostra, p: Preparo, carga: Carga, pts: Indentacao[]): AchadoVisivel[] {
  const g = caso.verdade.geometria;
  const out: AchadoVisivel[] = [];
  if (pts.length === 0) return out;
  const cargaTxt = carga.replace('.', ',');
  const grave = p.polimento === 'nenhum';

  const max = pts.reduce((m, q) => (q.hv > m.hv ? q : m), pts[0]);
  const p3 = pontoNaPeca(a, max.u, max.v);
  const zona = zonaEm(g, p3.x, p3.y, p3.z) ?? 'mb';
  const achMax = caso.verdade.achadosDureza.find(
    (d) =>
      d.leitura === 'maximo' &&
      d.zonas.includes(zona) &&
      (d.hvMin === undefined || max.hv >= d.hvMin) &&
      (d.hvMax === undefined || max.hv < d.hvMax),
  );
  if (achMax) {
    out.push({
      chave: 'leitura-maximo',
      achadoId: achMax.id,
      modo: 'campo',
      qualidade: grave ? 'comprometida' : max.alertas.length ? 'tenue' : 'nitida',
      observacao: `Máximo medido: ${max.hv} ${cargaTxt} em ${a.orientacao === 'transversal' ? 'x' : 'y'} = ${fmt(max.u)} mm, z = ${fmt(max.v)} mm${
        max.alertas.length ? ' (ponto com alerta)' : ''
      }.`,
      grupo: achMax.grupo,
      marcadores: [],
    });
  }

  if (a.orientacao === 'transversal') {
    const longe = pts.filter((q) => Math.abs(q.u) > 12);
    if (longe.length >= 2) {
      const zonas = longe.map((q) => {
        const r = pontoNaPeca(a, q.u, q.v);
        return zonaEm(g, r.x, r.y, r.z);
      });
      const ach = caso.verdade.achadosDureza.find((d) => d.leitura === 'media-afastada' && zonas.every((z) => z && d.zonas.includes(z)));
      if (ach) {
        const media = longe.reduce((s, q) => s + q.hv, 0) / longe.length;
        const min = Math.min(...longe.map((q) => q.hv));
        const mx = Math.max(...longe.map((q) => q.hv));
        const comAlerta = longe.filter((q) => q.alertas.length).length;
        out.push({
          chave: 'leitura-media-mb',
          achadoId: ach.id,
          modo: 'campo',
          qualidade: grave ? 'comprometida' : comAlerta > longe.length / 2 ? 'tenue' : 'nitida',
          observacao: `Média de ${longe.length} pontos a mais de 12 mm do eixo da solda: ${Math.round(media)} ${cargaTxt} (de ${min} a ${mx}).`,
          grupo: ach.grupo,
          marcadores: [],
        });
      }
    }
  }
  return out;
}
