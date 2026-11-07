// Comparação entre duas operações, explicitando o que impede atribuir o resultado a um único fator.

import { ferramentas, materiais } from '../dados/catalogo';
import type { RegistroFuracao, RegistroOperacao, RegistroPasse } from './partida';

export interface DiferencaParametro {
  campo: string;
  a: string;
  b: string;
}

export interface Confusor {
  texto: string;
}

export interface Comparacao {
  parametrosDiferentes: DiferencaParametro[];
  confusores: Confusor[];
  atribuivel: boolean;
  comparavel: boolean;
  conclusao: string;
  linhas: { rotulo: string; a: string; b: string; unidade: string }[];
}

const f2 = (v: number, c = 2) => v.toFixed(c).replace('.', ',');

function diametroEntrada(r: RegistroPasse): number {
  const cs = r.celulas;
  if (!cs.length) return r.previsao.dref;
  return cs.reduce((s, c) => s + c.dAntes, 0) / cs.length;
}

export function raMedia(r: RegistroPasse): number | null {
  const cs = r.celulas.filter((c) => c.ra);
  if (!cs.length) return null;
  return cs.reduce((s, c) => s + c.ra!.total, 0) / cs.length;
}

function diametroSaidaMedio(r: RegistroPasse): number {
  const cs = r.celulas.filter((c) => c.contato);
  if (!cs.length) return diametroEntrada(r);
  return cs.reduce((s, c) => s + c.dDepois, 0) / cs.length;
}

function furoEntrada(r: RegistroFuracao): number {
  return r.pecaAntes.furo[0];
}

export function compararPasses(a: RegistroOperacao, b: RegistroOperacao): Comparacao {
  if (a.tipo !== b.tipo) {
    return {
      parametrosDiferentes: [],
      confusores: [],
      atribuivel: false,
      comparavel: false,
      conclusao: 'Torneamento e furação são operações diferentes: os resultados não são comparáveis.',
      linhas: [],
    };
  }
  const parametrosDiferentes: DiferencaParametro[] = [];
  const pa = a.params as unknown as Record<string, number | string>;
  const pb = b.params as unknown as Record<string, number | string>;
  const campos: [string, string, number][] =
    a.tipo === 'tornear'
      ? [['n', 'Rotação n', 0], ['f', 'Avanço f', 2], ['ap', 'Profundidade ap', 2], ['L', 'Comprimento L', 1]]
      : [['n', 'Rotação n', 0], ['f', 'Avanço f', 2], ['P', 'Profundidade P', 1], ['q', 'Pica-pau q', 1]];
  for (const [k, rot, casas] of campos) {
    if (Math.abs((pa[k] as number) - (pb[k] as number)) > 1e-9)
      parametrosDiferentes.push({ campo: rot, a: f2(pa[k] as number, casas), b: f2(pb[k] as number, casas) });
  }
  if (a.tipo === 'tornear' && b.tipo === 'tornear' && a.params.operacao !== b.params.operacao)
    parametrosDiferentes.push({ campo: 'Rótulo da operação', a: a.params.operacao, b: b.params.operacao });
  if (a.ferramentaId !== b.ferramentaId)
    parametrosDiferentes.push({ campo: 'Ferramenta', a: ferramentas[a.ferramentaId].codigo, b: ferramentas[b.ferramentaId].codigo });
  if (a.materialId !== b.materialId)
    parametrosDiferentes.push({ campo: 'Material', a: materiais[a.materialId].nome, b: materiais[b.materialId].nome });

  const confusores: Confusor[] = [];
  if (a.pecaAntes.balanco !== b.pecaAntes.balanco)
    confusores.push({ texto: `O balanço da peça mudou (${a.pecaAntes.balanco} → ${b.pecaAntes.balanco} mm), o que muda a flexão.` });
  if (Math.abs(a.vbInicial - b.vbInicial) > 0.005)
    confusores.push({ texto: `A ferramenta começou com desgaste diferente (VB ≈ ${f2(a.vbInicial)} → ${f2(b.vbInicial)} mm).` });
  if (a.arestaAntes.lascada !== b.arestaAntes.lascada)
    confusores.push({ texto: 'Uma das ferramentas já estava lascada no início.' });
  if (Math.abs(a.arestaAntes.recuoReferencia - b.arestaAntes.recuoReferencia) > 0.002)
    confusores.push({ texto: 'O tangenciamento foi feito com arestas em estados diferentes.' });

  let linhas: Comparacao['linhas'];
  if (a.tipo === 'tornear' && b.tipo === 'tornear') {
    const dA = diametroEntrada(a);
    const dB = diametroEntrada(b);
    if (Math.abs(dA - dB) > 0.01)
      confusores.push({ texto: `O diâmetro de entrada mudou (Ø ${f2(dA)} → Ø ${f2(dB)} mm). Com a mesma rotação, isso já muda a velocidade de corte.` });
    const vcDif = Math.abs(a.vcModelo - b.vcModelo) / Math.max(a.vcModelo, 1);
    if (vcDif > 0.01 && Math.abs(a.params.n - b.params.n) < 1e-9)
      confusores.push({ texto: `A vc no diâmetro usinado mudou (${Math.round(a.vcModelo)} → ${Math.round(b.vcModelo)} m/min) com a mesma rotação, porque o diâmetro é outro.` });
    if (a.cortouCasca !== b.cortouCasca)
      confusores.push({ texto: 'Só um dos passes cortou a casca da superfície original, o que muda o desgaste.' });
    if (Math.abs(a.pecaAntes.furo[0] - b.pecaAntes.furo[0]) > 0.01)
      confusores.push({ texto: 'Só uma das peças tinha furo, o que muda a rigidez da seção.' });
    const raA = raMedia(a);
    const raB = raMedia(b);
    linhas = [
      { rotulo: 'vc no Ø usinado', a: f2(a.vcModelo, 0), b: f2(b.vcModelo, 0), unidade: 'm/min' },
      { rotulo: 'vf', a: f2(a.previsao.vf, 0), b: f2(b.previsao.vf, 0), unidade: 'mm/min' },
      { rotulo: 'Tempo de corte', a: f2(a.previsao.tc, 3), b: f2(b.previsao.tc, 3), unidade: 'min' },
      { rotulo: 'Ø de entrada médio', a: f2(dA, 3), b: f2(dB, 3), unidade: 'mm' },
      { rotulo: 'Ø programado', a: f2(a.previsao.dprog, 3), b: f2(b.previsao.dprog, 3), unidade: 'mm' },
      { rotulo: 'Ø obtido médio (modelo)', a: f2(diametroSaidaMedio(a), 3), b: f2(diametroSaidaMedio(b), 3), unidade: 'mm' },
      { rotulo: 'Ra estimada média', a: raA === null ? '—' : f2(raA, 1), b: raB === null ? '—' : f2(raB, 1), unidade: 'µm' },
      { rotulo: 'VB início → fim', a: `${f2(a.vbInicial, 3)} → ${f2(a.vbFinal, 3)}`, b: `${f2(b.vbInicial, 3)} → ${f2(b.vbFinal, 3)}`, unidade: 'mm' },
      { rotulo: 'Carga máxima (qualitativa)', a: a.nivelCargaMax, b: b.nivelCargaMax, unidade: '' },
      { rotulo: 'Cavaco', a: a.cavaco.rotulo, b: b.cavaco.rotulo, unidade: '' },
      { rotulo: 'Volume removido', a: f2(a.volume / 1000, 2), b: f2(b.volume / 1000, 2), unidade: 'cm³' },
    ];
  } else {
    const fa = a as RegistroFuracao;
    const fb = b as RegistroFuracao;
    if (Math.abs(furoEntrada(fa) - furoEntrada(fb)) > 0.01)
      confusores.push({ texto: `O pré-furo era diferente (Ø ${f2(furoEntrada(fa))} → Ø ${f2(furoEntrada(fb))} mm), o que muda a força de avanço.` });
    linhas = [
      { rotulo: 'vc na periferia', a: f2(fa.vcModelo, 0), b: f2(fb.vcModelo, 0), unidade: 'm/min' },
      { rotulo: 'vf', a: f2(fa.previsao.vf, 0), b: f2(fb.previsao.vf, 0), unidade: 'mm/min' },
      { rotulo: 'Tempo (avanço + descargas)', a: f2(fa.previsao.tc, 3), b: f2(fb.previsao.tc, 3), unidade: 'min' },
      { rotulo: 'Descargas (pica-pau)', a: String(fa.previsao.descargas), b: String(fb.previsao.descargas), unidade: '' },
      { rotulo: 'Ø do furo na entrada (modelo)', a: f2(fa.diametroFuro, 3), b: f2(fb.diametroFuro, 3), unidade: 'mm' },
      { rotulo: 'Ra estimada da parede', a: f2(fa.raFuro, 1), b: f2(fb.raFuro, 1), unidade: 'µm' },
      { rotulo: 'VB início → fim', a: `${f2(fa.vbInicial, 3)} → ${f2(fa.vbFinal, 3)}`, b: `${f2(fb.vbInicial, 3)} → ${f2(fb.vbFinal, 3)}`, unidade: 'mm' },
      { rotulo: 'Carga máxima (qualitativa)', a: fa.nivelCargaMax, b: fb.nivelCargaMax, unidade: '' },
      { rotulo: 'Entupimento máximo', a: `×${f2(fa.entupimentoMax, 1)}`, b: `×${f2(fb.entupimentoMax, 1)}`, unidade: '' },
      { rotulo: 'Cavaco', a: fa.cavaco.rotulo, b: fb.cavaco.rotulo, unidade: '' },
      { rotulo: 'Broca quebrou?', a: fa.quebrouEm === null ? 'não' : `sim, z ${f2(fa.quebrouEm, 1)}`, b: fb.quebrouEm === null ? 'não' : `sim, z ${f2(fb.quebrouEm, 1)}`, unidade: '' },
    ];
  }

  const atribuivel = parametrosDiferentes.length === 1 && confusores.length === 0;
  let conclusao: string;
  if (parametrosDiferentes.length === 0 && confusores.length === 0)
    conclusao = 'Condições e parâmetros iguais: o modelo é determinístico, então os resultados devem coincidir.';
  else if (atribuivel)
    conclusao = `Só ${parametrosDiferentes[0].campo.toLowerCase()} mudou e as condições de entrada eram equivalentes. Dentro deste modelo, a diferença é atribuível a esse fator.`;
  else if (parametrosDiferentes.length > 1)
    conclusao = `Mudaram ${parametrosDiferentes.length} fatores ao mesmo tempo${confusores.length ? ', e as condições de entrada também eram diferentes' : ''}. Não dá para atribuir a diferença a um único fator.`;
  else
    conclusao =
      'As condições de entrada eram diferentes, então a diferença não pode ser atribuída só ao fator alterado. No modo livre, use “Condições equivalentes” para repetir a operação-base.';

  return { parametrosDiferentes, confusores, atribuivel, comparavel: true, conclusao, linhas };
}
