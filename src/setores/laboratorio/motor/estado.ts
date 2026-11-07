/**
 * Ações da partida: funções puras que recebem o estado e devolvem um novo estado (ou um erro).
 * Toda ação que consome recursos verifica o saldo antes.
 */
import type { CasoDefinicao, Limpeza, Lixamento, Polimento, Ataque } from '../casos/tipos';
import type {
  Aquisicao,
  AquisicaoDocumento,
  EstadoJogo,
  Evidencia,
  Modo,
  Relatorio,
  Resultado,
  Vinculo,
  Aba,
  Preparo,
} from './tipos';
import { CUSTOS, custoPerfil, custoPreparo, registrarGasto, verificarRecursos } from './recursos';
import { adquirirVisual, superficiePorId, type PedidoVisual } from './inspecao';
import {
  adquirirMicrografia,
  limitacoesPreparo,
  planejarCorte,
  descreverAmostra,
  NOMES_ATAQUE,
  NOMES_LIXAMENTO,
  NOMES_POLIMENTO,
  type PedidoCorte,
  type PedidoMicrografia,
} from './metalografia';
import { executarPerfil, type PedidoPerfil } from './microdureza';

export function relatorioVazio(): Relatorio {
  return {
    mecanismo: null,
    justificativaMecanismo: '',
    causa: null,
    justificativaCausa: '',
    fatores: [],
    evidencias: [],
    alternativas: {},
    limitacoes: [],
    limitacaoLivre: '',
    proximosEnsaios: [],
  };
}

export function novoJogo(caso: CasoDefinicao, modo: Modo): EstadoJogo {
  const hipoteses: EstadoJogo['hipoteses'] = {};
  for (const h of caso.publico.hipoteses) hipoteses[h.id] = { selecionada: false, apoiaria: '', enfraqueceria: '' };
  return {
    versao: 1,
    casoId: caso.id,
    modo,
    iniciadoEm: Date.now(),
    aba: 'bancada',
    tutorialPasso: 0,
    gastos: [],
    hipoteses,
    limpezas: {},
    amostras: [],
    preparos: [],
    aquisicoes: [],
    evidencias: [],
    relatorio: relatorioVazio(),
    concluido: false,
    contador: 0,
  };
}

function bloqueadoSeConcluido(estado: EstadoJogo): string | null {
  return estado.concluido ? 'A investigação já foi concluída. Reinicie para uma nova tentativa.' : null;
}

function proximoId(prefixo: string, existentes: { id: string }[]): string {
  let n = existentes.filter((x) => x.id.startsWith(prefixo)).length + 1;
  let id = `${prefixo}${String(n).padStart(2, '0')}`;
  while (existentes.some((x) => x.id === id)) {
    n++;
    id = `${prefixo}${String(n).padStart(2, '0')}`;
  }
  return id;
}

const limites = (caso: CasoDefinicao) => caso.publico.recursos;

// ---------------------------------------------------------------------------
// Navegação e tutorial
// ---------------------------------------------------------------------------

export function irPara(estado: EstadoJogo, aba: Aba): EstadoJogo {
  if (aba === 'devolutiva' && !estado.concluido) return estado;
  return { ...estado, aba };
}

export function definirTutorial(estado: EstadoJogo, passo: number | null): EstadoJogo {
  return { ...estado, tutorialPasso: passo };
}

// ---------------------------------------------------------------------------
// Documentos e hipóteses
// ---------------------------------------------------------------------------

export function solicitarDocumento(caso: CasoDefinicao, estado: EstadoJogo, documentoId: string): Resultado {
  const bloq = bloqueadoSeConcluido(estado);
  if (bloq) return { ok: false, erro: bloq };
  const doc = caso.publico.documentos.find((d) => d.id === documentoId);
  if (!doc) return { ok: false, erro: 'Documento inexistente.' };
  if (estado.aquisicoes.some((a) => a.tipo === 'documento' && a.documentoId === documentoId)) {
    return { ok: false, erro: 'Este documento já foi recebido; consulte-o no caderno.' };
  }
  const erro = verificarRecursos(estado, limites(caso), CUSTOS.documento);
  if (erro) return { ok: false, erro };
  const id = proximoId('DOC-', estado.aquisicoes);
  const aq: AquisicaoDocumento = {
    tipo: 'documento',
    id,
    criadaEm: Date.now(),
    rotulo: `${doc.titulo} (${doc.origem})`,
    documentoId: doc.id,
    achados: doc.fatos.map((f, i) => ({
      chave: `fato-${i}`,
      achadoId: f.achadoId,
      modo: 'campo',
      qualidade: 'nitida',
      observacao: f.texto,
      marcadores: [],
    })),
    encontrados: [],
    limitacoes: [
      {
        id: 'doc-declarado',
        severidade: 'info',
        texto: 'Documento registra o que foi declarado ou anotado, não o que foi medido na peça.',
        explicacao: 'Confronte documentos com evidências físicas sempre que possível.',
      },
    ],
    semente: 0,
  };
  const comGasto = registrarGasto(estado, `Solicitação: ${doc.titulo}`, CUSTOS.documento);
  return { ok: true, estado: { ...comGasto, aquisicoes: [...comGasto.aquisicoes, aq] }, novoId: id };
}

export function atualizarHipotese(
  estado: EstadoJogo,
  hipoteseId: string,
  mudanca: Partial<EstadoJogo['hipoteses'][string]>,
): EstadoJogo {
  const atual = estado.hipoteses[hipoteseId] ?? { selecionada: false, apoiaria: '', enfraqueceria: '' };
  return { ...estado, hipoteses: { ...estado.hipoteses, [hipoteseId]: { ...atual, ...mudanca } } };
}

// ---------------------------------------------------------------------------
// Inspeção visual
// ---------------------------------------------------------------------------

export function limparSuperficie(caso: CasoDefinicao, estado: EstadoJogo, superficieId: string, tipo: Exclude<Limpeza, 'como-recebida'>): Resultado {
  const bloq = bloqueadoSeConcluido(estado);
  if (bloq) return { ok: false, erro: bloq };
  const sup = superficiePorId(caso, superficieId);
  const atual = estado.limpezas[superficieId] ?? 'como-recebida';
  if (atual === 'agressiva') return { ok: false, erro: 'Esta superfície já foi escovada: o dano é permanente.' };
  if (atual === tipo) return { ok: false, erro: 'Esta superfície já recebeu essa limpeza.' };
  const custo = CUSTOS.limpeza[tipo];
  const erro = verificarRecursos(estado, limites(caso), custo);
  if (erro) return { ok: false, erro };
  const comGasto = registrarGasto(estado, `Limpeza ${tipo === 'suave' ? 'suave' : 'agressiva'}: ${sup.nome}`, custo);
  return { ok: true, estado: { ...comGasto, limpezas: { ...comGasto.limpezas, [superficieId]: tipo } } };
}

export function registrarVisual(caso: CasoDefinicao, estado: EstadoJogo, pedido: PedidoVisual): Resultado {
  const bloq = bloqueadoSeConcluido(estado);
  if (bloq) return { ok: false, erro: bloq };
  const custo = CUSTOS.visual[pedido.vista];
  const erro = verificarRecursos(estado, limites(caso), custo);
  if (erro) return { ok: false, erro };
  const id = proximoId('VIS-', estado.aquisicoes);
  const aq = adquirirVisual(caso, estado, pedido, id);
  const comGasto = registrarGasto(estado, `Registro visual ${id}`, custo);
  return { ok: true, estado: { ...comGasto, aquisicoes: [...comGasto.aquisicoes, aq] }, novoId: id };
}

// ---------------------------------------------------------------------------
// Metalografia
// ---------------------------------------------------------------------------

export function cortarAmostra(caso: CasoDefinicao, estado: EstadoJogo, pedido: PedidoCorte): Resultado {
  const bloq = bloqueadoSeConcluido(estado);
  if (bloq) return { ok: false, erro: bloq };
  const id = proximoId('AM-', estado.amostras);
  const amostra = planejarCorte(caso, estado, pedido, id);
  if (typeof amostra === 'string') return { ok: false, erro: amostra };
  const erro = verificarRecursos(estado, limites(caso), CUSTOS.corte);
  if (erro) return { ok: false, erro };
  const comGasto = registrarGasto(estado, `Corte e embutimento: ${descreverAmostra(amostra)}`, CUSTOS.corte);
  return { ok: true, estado: { ...comGasto, amostras: [...comGasto.amostras, amostra] }, novoId: id };
}

export function prepararAmostra(
  caso: CasoDefinicao,
  estado: EstadoJogo,
  pedido: { amostraId: string; lixamento: Lixamento; polimento: Polimento; ataque: Ataque },
): Resultado {
  const bloq = bloqueadoSeConcluido(estado);
  if (bloq) return { ok: false, erro: bloq };
  const amostra = estado.amostras.find((a) => a.id === pedido.amostraId);
  if (!amostra) return { ok: false, erro: 'Amostra inexistente.' };
  const custo = custoPreparo(pedido.lixamento, pedido.polimento, pedido.ataque);
  const erro = verificarRecursos(estado, limites(caso), custo);
  if (erro) return { ok: false, erro };
  const tentativa = estado.preparos.filter((p) => p.amostraId === amostra.id).length + 1;
  const preparo: Preparo = {
    id: `${amostra.id}/P${tentativa}`,
    amostraId: amostra.id,
    tentativa,
    lixamento: pedido.lixamento,
    polimento: pedido.polimento,
    ataque: pedido.ataque,
    limitacoes: limitacoesPreparo(pedido),
  };
  const comGasto = registrarGasto(
    estado,
    `Preparação ${preparo.id}: ${NOMES_LIXAMENTO[pedido.lixamento]}, ${NOMES_POLIMENTO[pedido.polimento]}, ${NOMES_ATAQUE[pedido.ataque]}`,
    custo,
  );
  return { ok: true, estado: { ...comGasto, preparos: [...comGasto.preparos, preparo] }, novoId: preparo.id };
}

export function registrarMicrografia(caso: CasoDefinicao, estado: EstadoJogo, pedido: PedidoMicrografia): Resultado {
  const bloq = bloqueadoSeConcluido(estado);
  if (bloq) return { ok: false, erro: bloq };
  const preparo = estado.preparos.find((p) => p.id === pedido.preparoId);
  if (!preparo) return { ok: false, erro: 'Preparação inexistente.' };
  const amostra = estado.amostras.find((a) => a.id === preparo.amostraId);
  if (!amostra) return { ok: false, erro: 'Amostra inexistente.' };
  const custo = CUSTOS.micrografia[pedido.ampliacao];
  const erro = verificarRecursos(estado, limites(caso), custo);
  if (erro) return { ok: false, erro };
  const id = proximoId('MG-', estado.aquisicoes);
  const aq = adquirirMicrografia(caso, amostra, preparo, pedido, id);
  if (typeof aq === 'string') return { ok: false, erro: aq };
  const comGasto = registrarGasto(estado, `Micrografia ${id} (${pedido.ampliacao}×)`, custo);
  return { ok: true, estado: { ...comGasto, aquisicoes: [...comGasto.aquisicoes, aq] }, novoId: id };
}

// ---------------------------------------------------------------------------
// Microdureza
// ---------------------------------------------------------------------------

export function registrarPerfil(caso: CasoDefinicao, estado: EstadoJogo, pedido: PedidoPerfil): Resultado {
  const bloq = bloqueadoSeConcluido(estado);
  if (bloq) return { ok: false, erro: bloq };
  const preparo = estado.preparos.find((p) => p.id === pedido.preparoId);
  if (!preparo) return { ok: false, erro: 'Preparação inexistente.' };
  const amostra = estado.amostras.find((a) => a.id === preparo.amostraId);
  if (!amostra) return { ok: false, erro: 'Amostra inexistente.' };
  if (pedido.pontos.length === 0) return { ok: false, erro: 'Defina ao menos um ponto.' };
  const anteriores = estado.aquisicoes.flatMap((a) => (a.tipo === 'microdureza' && a.preparoId === preparo.id ? a.pontos : []));
  const id = proximoId('HV-', estado.aquisicoes);
  const aq = executarPerfil(caso, amostra, preparo, pedido, anteriores, id);
  if (typeof aq === 'string') return { ok: false, erro: aq };
  const custo = custoPerfil(aq.pontos.length);
  const erro = verificarRecursos(estado, limites(caso), custo);
  if (erro) return { ok: false, erro };
  const comGasto = registrarGasto(estado, `Perfil de microdureza ${id} (${aq.pontos.length} pontos)`, custo);
  return { ok: true, estado: { ...comGasto, aquisicoes: [...comGasto.aquisicoes, aq] }, novoId: id };
}

// ---------------------------------------------------------------------------
// Achados encontrados e evidências
// ---------------------------------------------------------------------------

export function marcarEncontrado(estado: EstadoJogo, aquisicaoId: string, chave: string): EstadoJogo {
  return {
    ...estado,
    aquisicoes: estado.aquisicoes.map((a) =>
      a.id === aquisicaoId && !a.encontrados.includes(chave) ? ({ ...a, encontrados: [...a.encontrados, chave] } as Aquisicao) : a,
    ),
  };
}

/** Achados que o jogador já pode registrar numa aquisição (campo + locais encontrados). */
export function achadosDisponiveis(a: Aquisicao) {
  return a.achados.filter(
    (x) => (x.modo === 'campo' || a.encontrados.includes(x.chave)) && (!x.requer || a.encontrados.includes(x.requer)),
  );
}

export function registrarEvidencia(
  estado: EstadoJogo,
  dados: { aquisicaoId: string; chave: string; interpretacaoId?: string; nota: string; vinculos?: Record<string, Vinculo> },
): Resultado {
  const aq = estado.aquisicoes.find((a) => a.id === dados.aquisicaoId);
  if (!aq) return { ok: false, erro: 'Resultado inexistente.' };
  const ach = achadosDisponiveis(aq).find((x) => x.chave === dados.chave);
  if (!ach) return { ok: false, erro: 'Observação não disponível neste resultado.' };
  if (estado.evidencias.some((e) => e.aquisicaoId === aq.id && e.chave === ach.chave)) {
    return { ok: false, erro: 'Esta observação já está no caderno.' };
  }
  const n = estado.contador + 1;
  const ev: Evidencia = {
    id: proximoId('EV-', estado.evidencias),
    aquisicaoId: aq.id,
    chave: ach.chave,
    achadoId: ach.achadoId,
    observacao: ach.observacao,
    origem: `${aq.id} · ${aq.rotulo}`,
    qualidade: ach.qualidade,
    grupo: ach.grupo,
    interpretacaoId: dados.interpretacaoId,
    nota: dados.nota,
    vinculos: dados.vinculos ?? {},
    criadaEm: Date.now(),
  };
  return { ok: true, estado: { ...estado, contador: n, evidencias: [...estado.evidencias, ev] }, novoId: ev.id };
}

export function atualizarEvidencia(estado: EstadoJogo, id: string, mudanca: Partial<Pick<Evidencia, 'interpretacaoId' | 'nota' | 'vinculos'>>): EstadoJogo {
  return { ...estado, evidencias: estado.evidencias.map((e) => (e.id === id ? { ...e, ...mudanca } : e)) };
}

export function definirVinculo(estado: EstadoJogo, evidenciaId: string, hipoteseId: string, vinculo: Vinculo | null): EstadoJogo {
  return {
    ...estado,
    evidencias: estado.evidencias.map((e) => {
      if (e.id !== evidenciaId) return e;
      const v = { ...e.vinculos };
      if (vinculo) v[hipoteseId] = vinculo;
      else delete v[hipoteseId];
      return { ...e, vinculos: v };
    }),
  };
}

export function removerEvidencia(estado: EstadoJogo, id: string): EstadoJogo {
  return {
    ...estado,
    evidencias: estado.evidencias.filter((e) => e.id !== id),
    relatorio: { ...estado.relatorio, evidencias: estado.relatorio.evidencias.filter((x) => x !== id) },
  };
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

export function atualizarRelatorio(estado: EstadoJogo, mudanca: Partial<Relatorio>): EstadoJogo {
  if (estado.concluido) return estado;
  return { ...estado, relatorio: { ...estado.relatorio, ...mudanca } };
}

export function validarRelatorio(r: Relatorio): string[] {
  const faltas: string[] = [];
  if (!r.mecanismo) faltas.push('Escolha um mecanismo de falha (ou "dados insuficientes").');
  if (!r.causa) faltas.push('Escolha uma causa provável (ou "dados insuficientes").');
  return faltas;
}

export function concluir(estado: EstadoJogo): Resultado {
  const faltas = validarRelatorio(estado.relatorio);
  if (faltas.length) return { ok: false, erro: faltas.join(' ') };
  return { ok: true, estado: { ...estado, concluido: true, aba: 'devolutiva' } };
}

