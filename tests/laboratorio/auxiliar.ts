/** Utilitários de teste: roteiros de investigação executados direto no motor. */
import { juntaQueFalhou as caso } from '../../src/setores/laboratorio/casos/junta-que-falhou';
import * as E from '../../src/setores/laboratorio/motor/estado';
import type { EstadoJogo, Resultado } from '../../src/setores/laboratorio/motor/tipos';

export { caso };

export function ok(r: Resultado): EstadoJogo {
  if (!r.ok) throw new Error(r.erro);
  return r.estado;
}

export function ultimoId(r: Resultado): string {
  if (!r.ok || !r.novoId) throw new Error(r.ok ? 'sem id' : r.erro);
  return r.novoId;
}

/** Aplica uma ação e devolve [estado, id criado]. */
export function passo(r: Resultado): [EstadoJogo, string] {
  return [ok(r), ultimoId(r)];
}

export function encontrarTodos(estado: EstadoJogo, aqId: string): EstadoJogo {
  const aq = estado.aquisicoes.find((a) => a.id === aqId)!;
  let e = estado;
  for (const x of aq.achados) if (x.modo === 'local') e = E.marcarEncontrado(e, aqId, x.chave);
  return e;
}

/** Registra no caderno o achado `achadoId` da aquisição, com interpretação e vínculos. */
export function registrar(
  estado: EstadoJogo,
  aqId: string,
  achadoId: string,
  interpretacaoId: string | undefined,
  vinculos: Record<string, 'apoia' | 'enfraquece' | 'inconclusiva'>,
): [EstadoJogo, string] {
  const aq = estado.aquisicoes.find((a) => a.id === aqId)!;
  const ach = aq.achados.find((x) => x.achadoId === achadoId);
  if (!ach) throw new Error(`Achado ${achadoId} não está em ${aqId}: ${aq.achados.map((x) => x.achadoId).join(', ')}`);
  return passo(E.registrarEvidencia(estado, { aquisicaoId: aqId, chave: ach.chave, interpretacaoId, nota: '', vinculos }));
}

/**
 * Investigação completa e cuidadosa: documenta a fratura, solicita documentos, corta pela origem,
 * prepara bem, observa campos relevantes, faz um perfil adequado e escreve o relatório.
 */
export function investigacaoCompleta(): EstadoJogo {
  let e = E.novoJogo(caso, 'aprender');
  let id: string;
  const evs: string[] = [];
  const reg = (aq: string, ach: string, interp: string | undefined, v: Record<string, 'apoia' | 'enfraquece' | 'inconclusiva'>) => {
    let novo: string;
    [e, novo] = registrar(e, aq, ach, interp, v);
    evs.push(novo);
  };

  e = ok(E.solicitarDocumento(caso, e, 'registro-soldagem'));
  e = ok(E.solicitarDocumento(caso, e, 'historico-operacao'));
  const docSold = e.aquisicoes.find((a) => a.tipo === 'documento' && a.documentoId === 'registro-soldagem')!.id;
  const docOp = e.aquisicoes.find((a) => a.tipo === 'documento' && a.documentoId === 'historico-operacao')!.id;
  reg(docSold, 'doc-sem-preaquecimento', undefined, { 'fator-procedimento': 'apoia' });
  reg(docOp, 'doc-inspecao', undefined, { 'fator-inspecao': 'apoia' });
  reg(docOp, 'doc-lote-anterior', undefined, { 'causa-subdimensionamento': 'enfraquece' });

  // Fratura: limpeza suave, visão geral rasante, detalhes da origem com as duas luzes
  e = ok(E.limparSuperficie(caso, e, 'fratura-A', 'suave'));
  [e, id] = passo(E.registrarVisual(caso, e, { superficie: 'fratura-A', vista: 'geral', iluminacao: 'rasante' }));
  reg(id, 'vf-marcas-praia', 'marcas-praia', { 'mec-fadiga': 'apoia', 'mec-sobrecarga': 'enfraquece' });
  reg(id, 'vf-zona-final', 'final-ductil', { 'mec-fadiga': 'apoia', 'mec-fragil': 'enfraquece' });
  reg(id, 'vf-zona-lisa', 'propagacao', { 'mec-fadiga': 'apoia' });
  [e, id] = passo(E.registrarVisual(caso, e, { superficie: 'fratura-A', vista: 'detalhe', centro: { u: 22, v: 3 }, iluminacao: 'difusa' }));
  e = encontrarTodos(e, id);
  reg(id, 'vf-origem-escura', 'trinca-preexistente', { 'causa-trinca-fabricacao': 'apoia' });
  [e, id] = passo(E.registrarVisual(caso, e, { superficie: 'fratura-A', vista: 'detalhe', centro: { u: 22, v: 3 }, iluminacao: 'rasante' }));
  e = encontrarTodos(e, id);
  reg(id, 'vf-convergencia', undefined, { 'causa-descontinuidade-interna': 'enfraquece' });

  // Face do cordão
  e = ok(E.limparSuperficie(caso, e, 'face-cordao', 'suave'));
  [e, id] = passo(E.registrarVisual(caso, e, { superficie: 'face-cordao', vista: 'detalhe', centro: { u: -9, v: 22 }, iluminacao: 'rasante' }));
  e = encontrarTodos(e, id);
  reg(id, 'vc-mordedura', 'mordedura', { 'fator-geometria': 'apoia' });

  // Metalografia pela origem
  let am: string;
  [e, am] = passo(E.cortarAmostra(caso, e, { orientacao: 'transversal', x: 0, y: 22 }));
  let prep: string;
  [e, prep] = passo(E.prepararAmostra(caso, e, { amostraId: am, lixamento: 'lixa-1200', polimento: 'diamante-6-1', ataque: 'nital-5s' }));
  [e, id] = passo(E.registrarMicrografia(caso, e, { preparoId: prep, ampliacao: 10, centro: { u: -4, v: 6 } }));
  reg(id, 'mg-macro-junta', undefined, { 'causa-descontinuidade-interna': 'enfraquece' });
  [e, id] = passo(E.registrarMicrografia(caso, e, { preparoId: prep, ampliacao: 500, centro: { u: -9.0, v: 0.6 } }));
  reg(id, 'mg-zta-martensita', 'martensita-bainita', { 'causa-trinca-fabricacao': 'apoia' });
  [e, id] = passo(E.registrarMicrografia(caso, e, { preparoId: prep, ampliacao: 500, centro: { u: -9.36, v: 0.2 } }));
  e = encontrarTodos(e, id);
  reg(id, 'mg-trinca-sec-A', 'trinca', { 'causa-trinca-fabricacao': 'apoia' });
  [e, id] = passo(E.registrarMicrografia(caso, e, { preparoId: prep, ampliacao: 500, centro: { u: 8.95, v: 0.4 } }));
  reg(id, 'mg-trajeto-borda', 'intergranular', { 'causa-trinca-fabricacao': 'apoia' });
  [e, id] = passo(E.registrarMicrografia(caso, e, { preparoId: prep, ampliacao: 500, centro: { u: -18, v: 6 } }));
  reg(id, 'mg-mb-perlita', 'medio-c', { 'fator-material': 'apoia' });

  // Microdureza perto da face
  const pontos = [];
  for (let u = -14; u <= 2 + 1e-9; u += 0.25) pontos.push({ u: +u.toFixed(2), v: 0.5 });
  [e, id] = passo(E.registrarPerfil(caso, e, { preparoId: prep, carga: 'HV0.5', pontos }));
  reg(id, 'hv-pico-acabamento', 'zta-endurecida', { 'causa-trinca-fabricacao': 'apoia' });
  reg(id, 'hv-mb', 'acima-baixo-c', { 'fator-material': 'apoia' });

  e = E.atualizarRelatorio(e, {
    mecanismo: 'mec-fadiga',
    causa: 'causa-trinca-fabricacao',
    fatores: ['fator-material', 'fator-geometria', 'fator-procedimento', 'fator-inspecao'],
    evidencias: evs,
    alternativas: {
      'mec-sobrecarga': 'descartada',
      'mec-fragil': 'enfraquecida',
      'mec-corrosao': 'nao-avaliada',
      'causa-impacto': 'nao-avaliada',
      'causa-descontinuidade-interna': 'enfraquecida',
      'causa-subdimensionamento': 'enfraquecida',
      'fator-ambiente': 'nao-avaliada',
    },
    limitacoes: ['lim-quimica', 'lim-mo-martensita', 'lim-mev', 'lim-hidrogenio', 'lim-planos'],
    proximosEnsaios: ['ens-quimica', 'ens-mev', 'ens-end-irmas', 'ens-procedimento'],
  });
  return ok(E.concluir(e));
}
