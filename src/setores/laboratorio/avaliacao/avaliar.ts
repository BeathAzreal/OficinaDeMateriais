/**
 * Avaliação da investigação. Lê o gabarito do caso e o que o jogador obteve e registrou.
 * Não corrige texto livre: só campos estruturados, vínculos e o histórico de aquisições.
 */
import type { CasoDefinicao, GabaritoAchado, GrupoSuficiencia, Qualidade, Relevancia, RegraAmostragem } from '../casos/tipos';
import type { Aquisicao, EstadoJogo, Evidencia, Severidade } from '../motor/tipos';
import { achadosDisponiveis } from '../motor/estado';
import { ARTEFATOS } from '../motor/interpretacoes';
import { gastoTotal } from '../motor/recursos';
import { pontoNaPeca, zonaEm } from '../motor/geometria';

export const INSUFICIENTE = 'dados-insuficientes';

export interface Dimensao {
  id: 'coerencia' | 'amostragem' | 'preparacao' | 'limitacoes' | 'recursos';
  nome: string;
  peso: number;
  nota: number;
  positivos: string[];
  melhorar: string[];
}

export interface ResultadoAvaliacao {
  total: number;
  dimensoes: Dimensao[];
  /** Achados coletados (em qualquer aquisição, com qualidade útil). */
  coletados: string[];
  /** Avaliação de cada evidência citada/registrada. */
  porEvidencia: Record<string, { interpretacao: 'correta' | 'aceitavel' | 'incerta' | 'errada' | 'sem'; artefatoMalInterpretado: boolean; exagero: boolean }>;
}

/** Gabarito dos artefatos gerados pelo motor (comum a todos os casos). */
const GABARITO_ARTEFATOS: Record<string, GabaritoAchado> = {
  [ARTEFATOS.riscosLixamento.id]: {
    corretas: ['riscos'],
    relevancia: {},
    artefato: true,
    explicacao: 'Riscos retos e paralelos que atravessam zonas e grãos são resíduo do lixamento, não trincas.',
    comoObter: 'Aparece quando a preparação para antes da lixa fina ou o polimento é insuficiente.',
  },
  [ARTEFATOS.arrancamento.id]: {
    corretas: ['arrancamento'],
    relevancia: {},
    artefato: true,
    explicacao: 'Cavidades irregulares espalhadas por todas as zonas, inclusive no metal de base, são arrancamentos de preparação, não porosidade.',
    comoObter: 'Aparece quando se pula do lixamento grosso direto ao polimento.',
  },
  [ARTEFATOS.sobreataque.id]: {
    corretas: ['sobreataque'],
    relevancia: {},
    artefato: true,
    explicacao: 'Imagem escura e contornos espessos resultam de ataque prolongado.',
    comoObter: 'Aparece com ataque de ~30 s.',
  },
  [ARTEFATOS.riscosEscova.id]: {
    corretas: ['riscos-limpeza'],
    relevancia: {},
    artefato: true,
    explicacao: 'Riscos retilíneos da escova de aço, sem relação com a propagação da trinca.',
    comoObter: 'Aparece após limpeza agressiva da fratura.',
  },
};

export function gabaritoAchado(caso: CasoDefinicao, achadoId: string): GabaritoAchado | undefined {
  return caso.gabarito.achados[achadoId] ?? GABARITO_ARTEFATOS[achadoId];
}

const ORDEM_Q: Record<Qualidade, number> = { nitida: 2, tenue: 1, comprometida: 0 };

/** Melhor qualidade com que cada achado foi obtido (só achados disponíveis ao jogador). */
export function achadosColetados(estado: EstadoJogo): Map<string, Qualidade> {
  const m = new Map<string, Qualidade>();
  for (const a of estado.aquisicoes) {
    for (const x of achadosDisponiveis(a)) {
      const atual = m.get(x.achadoId);
      if (!atual || ORDEM_Q[x.qualidade] > ORDEM_Q[atual]) m.set(x.achadoId, x.qualidade);
    }
  }
  return m;
}

function suficiente(grupos: GrupoSuficiencia[], coletadosUteis: Set<string>): boolean {
  return grupos.every((g) => g.achados.filter((a) => coletadosUteis.has(a)).length >= g.minimo);
}

function citadasValidas(evs: Evidencia[], alvo: Set<string>, porEv: ResultadoAvaliacao['porEvidencia']): Evidencia[] {
  return evs.filter((e) => alvo.has(e.achadoId) && e.qualidade !== 'comprometida' && porEv[e.id]?.interpretacao !== 'errada');
}

function limitar(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function avaliarInterpretacao(caso: CasoDefinicao, e: Evidencia): ResultadoAvaliacao['porEvidencia'][string] {
  const gab = gabaritoAchado(caso, e.achadoId);
  if (!e.grupo || !gab) return { interpretacao: 'sem', artefatoMalInterpretado: false, exagero: false };
  if (!e.interpretacaoId) return { interpretacao: 'sem', artefatoMalInterpretado: !!gab.artefato, exagero: false };
  const exagero = !!gab.exageros?.includes(e.interpretacaoId);
  if (gab.corretas?.includes(e.interpretacaoId)) return { interpretacao: 'correta', artefatoMalInterpretado: false, exagero };
  if (gab.aceitaveis?.includes(e.interpretacaoId)) return { interpretacao: 'aceitavel', artefatoMalInterpretado: false, exagero };
  const incerta = e.interpretacaoId.startsWith('nao-');
  return {
    interpretacao: incerta ? 'incerta' : 'errada',
    artefatoMalInterpretado: !!gab.artefato && !incerta,
    exagero,
  };
}

// ---------------------------------------------------------------------------
// Amostragem: regras declarativas do gabarito
// ---------------------------------------------------------------------------

function faixaContem(f: [number, number], x: number): boolean {
  return x >= f[0] && x <= f[1];
}

function sobrepoe(a: [number, number], b: [number, number]): boolean {
  return a[0] <= b[1] && b[0] <= a[1];
}

export function regraSatisfeita(caso: CasoDefinicao, estado: EstadoJogo, regra: RegraAmostragem): boolean {
  const g = caso.verdade.geometria;
  const aqs = estado.aquisicoes;
  switch (regra.tipo) {
    case 'visual':
      return aqs.some(
        (a) =>
          a.tipo === 'visual' &&
          regra.superficies.includes(a.superficie) &&
          a.vista === regra.vista &&
          (!regra.u || sobrepoe(a.janela.u, regra.u)) &&
          (!regra.v || sobrepoe(a.janela.v, regra.v)) &&
          (!regra.limpezas || regra.limpezas.includes(a.limpeza)),
      );
    case 'corte':
      return estado.amostras.some(
        (a) =>
          a.orientacao === regra.orientacao &&
          a.parte === regra.parte &&
          faixaContem(regra.posicao, a.posicao) &&
          (regra.extensaoInclui === undefined || faixaContem(a.extensao, regra.extensaoInclui)),
      );
    case 'micrografia-zona':
      return aqs.some((a) => {
        if (a.tipo !== 'micrografia' || !regra.ampliacoes.includes(a.ampliacao)) return false;
        const prep = estado.preparos.find((p) => p.id === a.preparoId);
        const am = estado.amostras.find((x) => x.id === a.amostraId);
        if (!prep || !am || !regra.ataques.includes(prep.ataque)) return false;
        const p = pontoNaPeca(am, a.centro.u, a.centro.v);
        const z = zonaEm(g, p.x, p.y, p.z);
        return !!z && regra.zonas.includes(z);
      });
    case 'micrografia-caixa':
      return aqs.some((a) => {
        if (a.tipo !== 'micrografia' || !regra.ampliacoes.includes(a.ampliacao)) return false;
        const am = estado.amostras.find((x) => x.id === a.amostraId);
        if (!am) return false;
        const c =
          am.orientacao === 'transversal'
            ? { x: a.janela.u, y: [am.posicao, am.posicao] as [number, number], z: a.janela.v }
            : { x: [am.posicao, am.posicao] as [number, number], y: a.janela.u, z: a.janela.v };
        const k = regra.caixa;
        return (!k.x || sobrepoe(c.x, k.x)) && (!k.y || sobrepoe(c.y, k.y)) && (!k.z || sobrepoe(c.z, k.z));
      });
    case 'perfil-atravessa':
      return aqs.some((a) => a.tipo === 'microdureza' && !a.limitacoes.some((l) => l.id === 'hv-nao-atravessa' || l.id === 'hv-longitudinal'));
    case 'perfil-zona':
      return aqs.some((a) => {
        if (a.tipo !== 'microdureza') return false;
        const am = estado.amostras.find((x) => x.id === a.amostraId);
        if (!am) return false;
        return a.pontos.some((q) => {
          if (regra.zMax !== undefined && q.v > regra.zMax) return false;
          const p = pontoNaPeca(am, q.u, q.v);
          const z = zonaEm(g, p.x, p.y, p.z);
          return !!z && regra.zonas.includes(z);
        });
      });
    case 'documento':
      return aqs.some((a) => a.tipo === 'documento' && a.documentoId === regra.id);
    case 'limpeza':
      return regra.superficies.some((s) => estado.limpezas[s] === regra.limpeza);
    case 'corte-antes-de-documentar': {
      const corte = estado.amostras
        .filter((a) => a.parte === regra.parte && a.orientacao === 'transversal' && faixaContem(regra.posicao, a.posicao))
        .sort((a, b) => a.criadaEm - b.criadaEm)[0];
      if (!corte) return false;
      const documentou = aqs.some(
        (a) =>
          a.tipo === 'visual' &&
          a.vista === 'detalhe' &&
          regra.superficies.includes(a.superficie) &&
          sobrepoe(a.janela.u, regra.u) &&
          a.criadaEm <= corte.criadaEm,
      );
      return !documentou;
    }
  }
}

// ---------------------------------------------------------------------------
// Avaliação principal
// ---------------------------------------------------------------------------

const PONTOS_VINCULO: Record<Relevancia, Record<string, number>> = {
  apoia: { apoia: 1, inconclusiva: 0.3, enfraquece: -1 },
  enfraquece: { enfraquece: 1, inconclusiva: 0.3, apoia: -1 },
  'apoia-fraco': { apoia: 1, inconclusiva: 0.8, enfraquece: -1 },
  'enfraquece-fraco': { enfraquece: 1, inconclusiva: 0.8, apoia: -1 },
};

function severidadesDe(a: Aquisicao): Severidade[] {
  return a.limitacoes.map((l) => l.severidade);
}

export function avaliar(caso: CasoDefinicao, estado: EstadoJogo): ResultadoAvaliacao {
  const gab = caso.gabarito;
  const r = estado.relatorio;
  const nomeHip = (id: string) => caso.publico.hipoteses.find((h) => h.id === id)?.titulo ?? id;

  const coletados = achadosColetados(estado);
  const uteis = new Set([...coletados].filter(([, q]) => q !== 'comprometida').map(([id]) => id));

  const porEvidencia: ResultadoAvaliacao['porEvidencia'] = {};
  for (const e of estado.evidencias) porEvidencia[e.id] = avaliarInterpretacao(caso, e);
  const citadas = estado.evidencias.filter((e) => r.evidencias.includes(e.id));

  // ---------------- Coerência ----------------
  const coer: Dimensao = { id: 'coerencia', nome: 'Coerência entre conclusões e evidências', peso: 0.35, nota: 0, positivos: [], melhorar: [] };

  function notaConclusao(
    escolha: string | null,
    alvo: { correta: string; suficiencia: GrupoSuficiencia[] },
    rotulo: string,
  ): number {
    const chaves = new Set(alvo.suficiencia.flatMap((g) => g.achados));
    const sufic = suficiente(alvo.suficiencia, uteis);
    const boas = citadasValidas(citadas, chaves, porEvidencia);
    if (escolha === alvo.correta) {
      if (boas.length >= 2) {
        coer.positivos.push(`${rotulo}: conclusão sustentada por ${boas.length} evidências citadas.`);
        return 100;
      }
      if (boas.length === 1) {
        coer.positivos.push(`${rotulo}: conclusão sustentada por uma evidência citada.`);
        coer.melhorar.push(`${rotulo}: cite mais de uma evidência independente.`);
        return 85;
      }
      if (sufic) {
        coer.melhorar.push(`${rotulo}: você tinha os dados, mas não citou evidências que sustentem a conclusão.`);
        return 55;
      }
      coer.melhorar.push(`${rotulo}: a conclusão não se apoia em dados obtidos — parece palpite.`);
      return 25;
    }
    if (escolha === INSUFICIENTE) {
      if (!sufic) {
        coer.positivos.push(`${rotulo}: "dados insuficientes" é coerente com o que foi obtido.`);
        return 90;
      }
      coer.melhorar.push(`${rotulo}: os dados obtidos já permitiam uma conclusão.`);
      return 40;
    }
    if (escolha) {
      coer.melhorar.push(`${rotulo}: "${nomeHip(escolha)}" não é compatível com o conjunto de evidências do caso.`);
      return sufic ? 0 : 10;
    }
    coer.melhorar.push(`${rotulo}: não preenchido.`);
    return 0;
  }

  const notaMec = notaConclusao(r.mecanismo, gab.mecanismo, 'Mecanismo');
  const notaCausa = notaConclusao(r.causa, gab.causa, 'Causa provável');

  // fatores
  const verdadeiros = Object.entries(gab.fatores).filter(([, f]) => f.verdadeiro);
  let somaF = 0;
  for (const id of r.fatores) {
    const f = gab.fatores[id];
    if (!f) continue;
    if (f.verdadeiro) {
      const ok = suficiente(f.suficiencia, uteis);
      somaF += ok ? 1 : 0.5;
      if (ok) coer.positivos.push(`Fator "${nomeHip(id)}" identificado com dados que o sustentam.`);
      else coer.melhorar.push(`Fator "${nomeHip(id)}" é pertinente, mas você não obteve evidência dele.`);
    } else {
      somaF -= 0.75;
      coer.melhorar.push(`Fator "${nomeHip(id)}" não encontra apoio nas evidências.`);
    }
  }
  const faltando = verdadeiros.filter(([id, f]) => !r.fatores.includes(id) && suficiente(f.suficiencia, uteis));
  for (const [id] of faltando) coer.melhorar.push(`Seus dados sustentavam também o fator "${nomeHip(id)}".`);
  const notaFat = verdadeiros.length ? limitar((100 * somaF) / verdadeiros.length) : 100;

  // vínculos evidência ↔ hipótese
  let somaV = 0;
  let nV = 0;
  let vinculosComprometidos = 0;
  let vinculosArtefato = 0;
  for (const e of estado.evidencias) {
    const ga = gabaritoAchado(caso, e.achadoId);
    for (const [hip, v] of Object.entries(e.vinculos)) {
      nV++;
      const rel = ga?.relevancia[hip];
      if (ga?.artefato && v !== 'inconclusiva') {
        somaV -= 1;
        vinculosArtefato++;
        continue;
      }
      if (e.qualidade === 'comprometida' && v !== 'inconclusiva') {
        somaV -= 0.5;
        vinculosComprometidos++;
        continue;
      }
      if (!rel) somaV += v === 'inconclusiva' ? 0.6 : -0.5;
      else somaV += PONTOS_VINCULO[rel][v];
    }
  }
  const notaVinc = nV === 0 ? 20 : limitar(((somaV / nV + 1) / 2) * 100);
  if (nV === 0) coer.melhorar.push('Nenhuma evidência foi associada às hipóteses no caderno.');
  else if (notaVinc >= 70) coer.positivos.push('A maior parte das associações evidência–hipótese está coerente.');
  else coer.melhorar.push('Várias associações evidência–hipótese não correspondem ao que a evidência mostra.');

  // interpretações
  const comGrupo = estado.evidencias.filter((e) => e.grupo);
  let somaI = 0;
  for (const e of comGrupo) {
    const p = porEvidencia[e.id];
    somaI += p.interpretacao === 'correta' ? 1 : p.interpretacao === 'aceitavel' ? 0.6 : p.interpretacao === 'incerta' ? 0.4 : p.interpretacao === 'sem' ? 0.2 : -0.5;
  }
  const notaInterp = comGrupo.length ? limitar(((somaI / comGrupo.length + 0.5) / 1.5) * 100) : 30;

  // alternativas
  const escolhidas = new Set([r.mecanismo, r.causa, ...r.fatores].filter(Boolean) as string[]);
  let somaA = 0;
  let nA = 0;
  for (const h of caso.publico.hipoteses) {
    if (escolhidas.has(h.id)) continue;
    const g = gab.hipoteses[h.id];
    if (!g) continue;
    const st = r.alternativas[h.id] ?? 'nao-avaliada';
    const temDados = g.evidenciasDecisivas.some((a) => uteis.has(a));
    nA++;
    if (!g.verdadeira) {
      if (st === 'enfraquecida' || st === 'descartada') {
        somaA += temDados ? 1 : 0.3;
        if (!temDados) coer.melhorar.push(`"${h.titulo}" foi descartada sem os dados que a enfraquecem.`);
      } else if (st === 'nao-avaliada') somaA += temDados ? 0.4 : 0.8;
      else {
        somaA -= 1;
        coer.melhorar.push(`"${h.titulo}" foi marcada como apoiada, mas as evidências a enfraquecem.`);
      }
    } else if (st === 'apoiada') somaA += temDados ? 1 : 0.3;
    else if (st === 'nao-avaliada') somaA += temDados ? 0.2 : 0.5;
    else {
      somaA -= 1;
      coer.melhorar.push(`"${h.titulo}" foi descartada, mas há evidências a favor dela.`);
    }
  }
  const notaAlt = nA ? limitar(((somaA / nA + 1) / 2) * 100) : 50;

  coer.nota = limitar(0.28 * notaMec + 0.28 * notaCausa + 0.14 * notaFat + 0.12 * notaVinc + 0.08 * notaAlt + 0.1 * notaInterp);

  // ---------------- Amostragem ----------------
  const amost: Dimensao = { id: 'amostragem', nome: 'Qualidade da amostragem', peso: 0.2, nota: 0, positivos: [], melhorar: [] };
  let pesoTotal = 0;
  let pesoObtido = 0;
  for (const c of gab.amostragem) {
    const ok = regraSatisfeita(caso, estado, c.regra);
    if (c.penalidade) {
      if (ok) {
        pesoObtido -= c.peso;
        amost.melhorar.push(`Penalidade: ${c.descricao}.`);
      }
      continue;
    }
    pesoTotal += c.peso;
    if (ok) {
      pesoObtido += c.peso;
      amost.positivos.push(c.descricao);
    } else amost.melhorar.push(`Faltou: ${c.descricao.charAt(0).toLowerCase()}${c.descricao.slice(1)}.`);
  }
  amost.nota = limitar((100 * pesoObtido) / Math.max(1, pesoTotal));

  // ---------------- Preparação e parâmetros ----------------
  const prep: Dimensao = { id: 'preparacao', nome: 'Adequação da preparação e dos parâmetros', peso: 0.15, nota: 100, positivos: [], melhorar: [] };
  const usadas = new Set(estado.evidencias.map((e) => e.aquisicaoId));
  const ensaios = estado.aquisicoes.filter((a) => a.tipo === 'micrografia' || a.tipo === 'microdureza' || a.tipo === 'visual');
  let desconto = 0;
  for (const a of ensaios) {
    const sev = severidadesDe(a);
    const graves = sev.filter((s) => s === 'grave').length;
    const atencao = sev.filter((s) => s === 'atencao').length;
    if (usadas.has(a.id)) desconto += 15 * graves + 4 * atencao;
    else desconto += 4 * graves;
  }
  const micros = estado.aquisicoes.filter((a) => a.tipo === 'micrografia');
  const boaMicro = micros.some((a) => {
    const p = estado.preparos.find((x) => x.id === a.preparoId);
    return a.ampliacao !== 10 && p && p.polimento !== 'nenhum' && p.lixamento !== 'lixa-220' && p.ataque === 'nital-5s';
  });
  const perfis = estado.aquisicoes.filter((a) => a.tipo === 'microdureza');
  const bomPerfil = perfis.some((a) => !a.limitacoes.some((l) => l.severidade !== 'info'));
  if (boaMicro) prep.positivos.push('Ao menos uma micrografia com preparação adequada (lixamento completo, polimento e ataque leve).');
  else prep.melhorar.push('Nenhuma micrografia com preparação adequada para observar a microestrutura.');
  if (bomPerfil) prep.positivos.push('Ao menos um perfil de microdureza sem alertas de espaçamento, borda ou superfície.');
  else if (perfis.length) prep.melhorar.push('Todos os perfis de microdureza têm limitações de configuração.');
  else prep.melhorar.push('Nenhum perfil de microdureza foi feito.');
  const refez = estado.preparos.some((p) => p.tentativa > 1 && p.limitacoes.every((l) => l.severidade !== 'grave'));
  if (refez) prep.positivos.push('Uma amostra foi preparada novamente para corrigir problemas.');
  let notaPrep = 100 - desconto + (refez ? 5 : 0);
  if (!boaMicro) notaPrep = Math.min(notaPrep, 55);
  if (!bomPerfil) notaPrep = Math.min(notaPrep, 70);
  if (micros.length === 0 && perfis.length === 0) notaPrep = Math.min(notaPrep, 30);
  if (desconto > 0) prep.melhorar.push('Resultados com limitações graves ou de atenção foram usados como evidência ou desperdiçaram recursos.');
  prep.nota = limitar(notaPrep);

  // ---------------- Limitações ----------------
  const lim: Dimensao = { id: 'limitacoes', nome: 'Reconhecimento de limitações', peso: 0.15, nota: 0, positivos: [], melhorar: [] };
  let notaLim = 0;
  const certas = r.limitacoes.filter((l) => gab.limitacoesCorretas.includes(l));
  const erradas = r.limitacoes.filter((l) => gab.limitacoesIncorretas.includes(l));
  notaLim += Math.min(5, certas.length) * 11;
  notaLim -= erradas.length * 15;
  const textoOpcao = (id: string) => caso.publico.relatorio.limitacoes.find((o) => o.id === id)?.texto ?? id;
  const textoEnsaio = (id: string) => caso.publico.relatorio.proximosEnsaios.find((o) => o.id === id)?.texto ?? id;
  if (certas.length) lim.positivos.push(`${certas.length} limitação(ões) pertinente(s) reconhecida(s).`);
  for (const e of erradas) lim.melhorar.push(`Afirmação indevida: "${textoOpcao(e)}"`);
  const ensUteis = r.proximosEnsaios.filter((x) => gab.ensaiosUteis.includes(x));
  const ensRuins = r.proximosEnsaios.filter((x) => gab.ensaiosInadequados.includes(x));
  notaLim += Math.min(4, ensUteis.length) * 8;
  notaLim -= ensRuins.length * 8;
  if (ensUteis.length) lim.positivos.push(`${ensUteis.length} próximo(s) ensaio(s) pertinente(s).`);
  for (const e of ensRuins) lim.melhorar.push(`Ensaio pouco útil para a pergunta: "${textoEnsaio(e)}"`);
  if (gab.ensaiosUteis.includes('ens-quimica') && !r.proximosEnsaios.includes('ens-quimica') && uteis.has('mg-mb-perlita')) {
    lim.melhorar.push('A suspeita sobre o material pede confirmação química: recomende esse ensaio.');
  }
  const artefatosErrados = estado.evidencias.filter((e) => porEvidencia[e.id].artefatoMalInterpretado);
  const exageros = estado.evidencias.filter((e) => porEvidencia[e.id].exagero);
  notaLim -= artefatosErrados.length * 12 + exageros.length * 12 + vinculosComprometidos * 8 + vinculosArtefato * 6;
  for (const e of artefatosErrados) lim.melhorar.push(`${e.id}: um artefato de preparação foi interpretado como feição real.`);
  for (const e of exageros) lim.melhorar.push(`${e.id}: a interpretação exagera o que a dureza permite concluir.`);
  if (vinculosComprometidos) lim.melhorar.push('Dados comprometidos foram usados para apoiar ou enfraquecer hipóteses (use "inconclusiva").');
  const reconheceu = estado.evidencias.some(
    (e) =>
      (gabaritoAchado(caso, e.achadoId)?.artefato && porEvidencia[e.id].interpretacao === 'correta') ||
      (e.qualidade === 'comprometida' && Object.values(e.vinculos).every((v) => v === 'inconclusiva')),
  );
  if (reconheceu) {
    notaLim += 8;
    lim.positivos.push('Artefatos ou dados comprometidos foram identificados como tais.');
  }
  lim.nota = limitar(notaLim);

  // ---------------- Recursos ----------------
  const rec: Dimensao = { id: 'recursos', nome: 'Uso dos recursos', peso: 0.15, nota: 0, positivos: [], melhorar: [] };
  const chaves = Object.entries(gab.achados).filter(([, g]) => g.chave).map(([id]) => id);
  const cobertas = chaves.filter((c) => uteis.has(c));
  const cobertura = chaves.length ? cobertas.length / chaves.length : 1;
  const assinaturas = new Map<string, number>();
  for (const a of estado.aquisicoes) {
    let s = '';
    if (a.tipo === 'visual') s = `v|${a.superficie}|${a.vista}|${a.janela.u[0].toFixed(1)}|${a.janela.v[0].toFixed(1)}|${a.iluminacao}|${a.limpeza}`;
    else if (a.tipo === 'micrografia') s = `m|${a.preparoId}|${a.ampliacao}|${a.centro.u.toFixed(2)}|${a.centro.v.toFixed(2)}`;
    else continue;
    assinaturas.set(s, (assinaturas.get(s) ?? 0) + 1);
  }
  const duplicadas = [...assinaturas.values()].reduce((s, n) => s + Math.max(0, n - 1), 0);
  const desperdicio = ensaios.filter(
    (a) => severidadesDe(a).includes('grave') && !a.achados.some((x) => x.qualidade !== 'comprometida' && !gabaritoAchado(caso, x.achadoId)?.artefato),
  ).length;
  rec.nota = limitar(30 + 70 * cobertura - 5 * duplicadas - 4 * desperdicio);
  const gasto = gastoTotal(estado);
  rec.positivos.push(
    `${cobertas.length} de ${chaves.length} evidências-chave do caso obtidas, com R$ ${Math.round(gasto.reais)} e ${gasto.horas.toFixed(1).replace('.', ',')} h.`,
  );
  if (duplicadas) rec.melhorar.push(`${duplicadas} aquisição(ões) repetida(s) com exatamente as mesmas condições.`);
  if (desperdicio) rec.melhorar.push(`${desperdicio} aquisição(ões) sem informação útil por configuração inadequada.`);
  if (cobertura < 0.5) rec.melhorar.push('Menos da metade das evidências-chave foi obtida: economizar não compensa dados insuficientes.');

  const dimensoes = [coer, amost, prep, lim, rec];
  const total = limitar(dimensoes.reduce((s, d) => s + d.peso * d.nota, 0));
  return { total, dimensoes, coletados: [...coletados.keys()], porEvidencia };
}
