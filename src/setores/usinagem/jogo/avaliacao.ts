// Avaliação técnica e econômica da entrega e análise baseada nas ações reais do jogador.
// Tudo aqui é regra fixa sobre o histórico; não há interpretação de texto livre.

import { faixaRa, vbDeDano } from '../modelo/fenomenos';
import {
  avaliarDiametro,
  inicioRegiaoBruta,
  lerComprimentoUsinado,
  lerDiametro,
  leitura,
  limitesDiametro,
  regiaoFuncional,
  type AvaliacaoDiametro,
} from '../modelo/medicao';
import { celulaEm, celulasAte, extremosEntre } from '../modelo/peca';
import type { ComponentesRa } from '../modelo/tipos';
import { ehTorneamento, materialDaPeca, type EstadoPartida, type PecaJogo, type RegistroPasse, type Tempos } from './partida';
import { ferramentas } from '../dados/catalogo';
import { calcularCustos, consumoAresta, tempoTotal, type Custos } from './recursos';

export type Nivel = 'atende' | 'parcial' | 'nao-atende' | 'pendente' | 'informativo';

export interface Criterio {
  id: string;
  titulo: string;
  nivel: Nivel;
  texto: string[];
}

export interface OpcaoPergunta {
  id: string;
  texto: string;
}

export interface Pergunta {
  id: string;
  enunciado: string;
  contexto: string;
  opcoes: OpcaoPergunta[];
  correta: string;
  feedback: Record<string, string>;
  explicacao: string;
}

export interface DecomposicaoDiametro {
  z: number;
  passe: number;
  nominal: number;
  verdadeiro: number;
  leitura: number;
  programacao: number; // Dprog − nominal
  deflexao: number; // 2δ
  desgaste: number; // 2·recuo
  arredondamento: number; // leitura − verdadeiro
}

export interface RelatorioEntrega {
  pecaNumero: number;
  modo: EstadoPartida['modo'];
  pontos: { id: string; z: number; aval: AvaliacaoDiametro }[];
  perfil: { min: AvaliacaoDiametro; max: AvaliacaoDiametro; z0: number; z1: number };
  comprimento: { leitura: number; conforme: boolean };
  regiaoBruta: { conforme: boolean };
  superficie: {
    raMax: number | null;
    faixa: [number, number] | null;
    zPior: number | null;
    passeOrigem: number | null;
    componentes: ComponentesRa | null;
    conforme: boolean;
    margemPequena: boolean;
    regiaoBrutaNaFuncional: boolean;
  };
  decomposicao: DecomposicaoDiametro | null;
  tempos: Tempos;
  tempoTotal: number;
  custos: Custos;
  orcamento: number | null;
  arestas: { numero: number; vb: number; consumo: number; lascada: boolean }[];
  volumeRemovido: number; // mm³ na peça entregue
  conformeDimensoes: boolean;
  conformeGeral: boolean;
  criterios: Criterio[];
  fatores: string[];
  pergunta: Pergunta;
  resposta?: string;
}

const mm = (v: number, casas = 2) => v.toFixed(casas).replace('.', ',');
const sinal = (v: number, casas = 3) => (v >= 0 ? '+' : '−') + mm(Math.abs(v), casas);
const um = (v: number) => mm(v, 1);

/** Componentes de Ra que o jogador pode reconhecer (o piso sintético entra junto com a geométrica). */
const NOMES_RA: Record<string, string> = {
  geometrica: 'marcas do avanço (geométrica, f²/32rε, com piso)',
  apc: 'aresta postiça (vc baixa)',
  desgaste: 'desgaste de flanco da aresta',
  atrito: 'profundidade efetiva pequena demais (atrito/recalque)',
  lascamento: 'aresta lascada',
};

function maiorParcelaRa(c: ComponentesRa): keyof typeof NOMES_RA {
  const parcelas: [keyof typeof NOMES_RA, number][] = [
    ['geometrica', c.geometrica + c.piso],
    ['apc', c.apc],
    ['desgaste', c.desgaste],
    ['atrito', c.atrito],
    ['lascamento', c.lascamento],
  ];
  parcelas.sort((a, b) => b[1] - a[1]);
  return parcelas[0][0];
}

function passePorNumero(e: EstadoPartida, n: number): RegistroPasse | undefined {
  const r = e.passes[n - 1];
  return ehTorneamento(r) ? r : undefined;
}

export function decomporDiametro(e: EstadoPartida, pj: PecaJogo, z: number): DecomposicaoDiametro | null {
  const enc = e.ctx.encomenda;
  const i = celulaEm(pj.peca, z);
  const origem = pj.peca.origem[i];
  if (origem < 1) return null;
  const reg = passePorNumero(e, origem);
  if (!reg) return null;
  const c = reg.celulas[i];
  const verdadeiro = pj.peca.diametros[i];
  const nominal = enc.requisitos.diametro.nominal;
  const l = lerDiametro(pj.peca, z, enc);
  return {
    z,
    passe: origem,
    nominal,
    verdadeiro,
    leitura: l,
    programacao: reg.previsao.dprog - nominal,
    deflexao: 2 * c.deflexao,
    desgaste: 2 * c.recuo,
    arredondamento: l - verdadeiro,
  };
}

// ---------------------------------------------------------------- pergunta estruturada

function perguntaRefugo(e: EstadoPartida, pj: PecaJogo): Pergunta | null {
  const enc = e.ctx.encomenda;
  // Passe que transformou a peça em refugo.
  const reg = pj.passes
    .map((n) => passePorNumero(e, n))
    .find((r): r is RegistroPasse => !!r && r.refugoApos.length > 0);
  if (!reg) return null;
  const opcoes: OpcaoPergunta[] = [
    { id: 'ap-diametral', texto: 'A profundidade radial foi programada como se fosse a redução do diâmetro.' },
    { id: 'sobremetal', texto: 'A soma das profundidades dos passes ultrapassou o sobremetal radial disponível.' },
    { id: 'comprimento', texto: 'O comprimento do passe ultrapassou a região que devia ser usinada.' },
    { id: 'deflexao', texto: 'A deflexão da peça puxou a ferramenta para dentro do material.' },
    { id: 'desgaste', texto: 'O desgaste da aresta fez a ferramenta cortar mais fundo.' },
  ];
  const nominal = enc.requisitos.diametro.nominal;
  const tipo = reg.refugoApos[0].tipo;
  const ap = reg.params.ap;
  const dref = reg.previsao.dref;
  let correta: string;
  if (tipo === 'regiao-bruta-usinada') correta = 'comprimento';
  else {
    // Sobremetal radial que ainda podia ser removido sem passar do limite inferior.
    const permitido = (dref - limitesDiametro(enc).min) / 2;
    // Corte bem maior que o permitido (≥ 1,4×) é o padrão de quem digitou a redução diametral.
    correta = permitido > 0 && ap >= 1.4 * permitido ? 'ap-diametral' : 'sobremetal';
  }
  const explicacao =
    correta === 'comprimento'
      ? `No passe ${reg.numero}, L = ${mm(reg.params.L, 1)} mm passou do limite de ${mm(inicioRegiaoBruta(enc), 1)} mm. A região além do ressalto devia permanecer bruta, e o material removido ali não volta.`
      : correta === 'ap-diametral'
        ? `No passe ${reg.numero}, a referência era Ø ${mm(dref)} mm e ap = ${mm(ap)} mm. O diâmetro programado ficou ${mm(dref)} − 2 × ${mm(ap)} = ${mm(reg.previsao.dprog)} mm. Uma redução de ${mm(dref - nominal)} mm no diâmetro pede ap = ${mm((dref - nominal) / 2)} mm, porque a ferramenta corta dos dois lados do eixo de rotação.`
        : `No passe ${reg.numero}, a referência era Ø ${mm(dref)} mm e ap = ${mm(ap)} mm levou o diâmetro programado a ${mm(reg.previsao.dprog)} mm. Isso fica abaixo de ${mm(limitesDiametro(enc).min)} mm, o limite inferior. O sobremetal radial que restava era ${mm((dref - nominal) / 2)} mm.`;
  const comum =
    ' A deflexão e o desgaste afastam a ponta da peça (deixam o diâmetro maior), então não explicam um diâmetro pequeno demais.';
  const feedback: Record<string, string> = {};
  for (const o of opcoes) {
    feedback[o.id] =
      o.id === correta
        ? 'Correto. ' + explicacao
        : o.id === 'deflexao' || o.id === 'desgaste'
          ? 'Não é a causa principal.' + comum + ' ' + explicacao
          : 'Não é a causa principal. ' + explicacao;
  }
  return {
    id: 'causa-refugo',
    enunciado: `Qual foi a principal causa do refugo do tarugo ${pj.numero}?`,
    contexto: reg.refugoApos.map((m) => m.texto).join(' '),
    opcoes,
    correta,
    feedback,
    explicacao,
  };
}

function perguntaRa(c: ComponentesRa, ra: number, passe: RegistroPasse, atende: boolean, limite: number): Pergunta {
  const correta = maiorParcelaRa(c);
  const opcoes: OpcaoPergunta[] = [
    { id: 'geometrica', texto: 'O avanço por volta, comparado ao raio de ponta (marcas geométricas).' },
    { id: 'apc', texto: 'A aresta postiça formada em velocidade de corte baixa.' },
    { id: 'desgaste', texto: 'O desgaste de flanco acumulado na aresta.' },
    { id: 'atrito', texto: 'A profundidade efetiva muito pequena, que faz a aresta atritar em vez de cortar.' },
    { id: 'lascamento', texto: 'Um lascamento da aresta.' },
    { id: 'dureza', texto: 'A dureza do material, que impede um bom acabamento.' },
  ];
  const valores = `Decomposição da Ra estimada (≈ ${um(ra)} µm) no passe ${passe.numero}: marcas do avanço ${um(c.geometrica + c.piso)}, aresta postiça ${um(c.apc)}, desgaste ${um(c.desgaste)}, atrito ${um(c.atrito)}, lascamento ${um(c.lascamento)} µm. Esse passe usou f = ${mm(passe.params.f)} mm/volta e vc ≈ ${Math.round(passe.vcModelo)} m/min no diâmetro usinado.`;
  const explicacao = `${valores} A maior parcela foi: ${NOMES_RA[correta]}.`;
  const feedback: Record<string, string> = {};
  for (const o of opcoes) {
    if (o.id === correta) feedback[o.id] = 'Correto. ' + explicacao;
    else if (o.id === 'dureza')
      feedback[o.id] =
        'No modelo, a dureza não entra na rugosidade. O material atua pela aresta postiça (ductilidade), pelo piso de rugosidade e pelo desgaste. Na prática a dureza também não determina sozinha o acabamento. ' +
        explicacao;
    else feedback[o.id] = 'Não foi a maior parcela. ' + explicacao;
  }
  return {
    id: 'causa-ra',
    enunciado: atende
      ? `A Ra estimada da superfície entregue foi ≈ ${um(ra)} µm (limite ${um(limite)} µm). Qual parcela pesou mais?`
      : `A Ra estimada (≈ ${um(ra)} µm) passou do limite de ${um(limite)} µm. Qual foi a principal causa?`,
    contexto: 'A resposta é conferida com a decomposição do modelo didático, não com medição real.',
    opcoes,
    correta,
    feedback,
    explicacao,
  };
}

function perguntaDiametro(d: DecomposicaoDiametro, pontoId: string, dentro: boolean): Pergunta {
  // Pergunta sobre a diferença entre o obtido (lido) e o programado: aí está a física do corte.
  const programado = d.nominal + d.programacao;
  const diferenca = d.leitura - programado;
  const parcelas: [string, number][] = [
    ['deflexao', d.deflexao],
    ['desgaste', d.desgaste],
    ['medicao', d.arredondamento],
  ];
  const correta = parcelas.slice().sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0][0];
  const opcoes: OpcaoPergunta[] = [
    { id: 'programacao', texto: 'Um erro de conta no diâmetro programado.' },
    { id: 'deflexao', texto: 'A força passiva afastou a ponta (flexibilidade do sistema e flexão da peça).' },
    { id: 'desgaste', texto: 'O desgaste de flanco recuou a ponta da ferramenta.' },
    { id: 'medicao', texto: 'O arredondamento da leitura do micrômetro.' },
    { id: 'termica', texto: 'A dilatação térmica da peça durante o corte.' },
  ];
  const situacao = dentro
    ? 'A peça ficou dentro da tolerância.'
    : `Com o nominal como limite superior, essa diferença tirou a peça da tolerância${Math.abs(d.programacao) < 0.005 ? ': programar exatamente o nominal não deixa margem' : ''}.`;
  const explicacao = `Na seção ${pontoId}, o passe ${d.passe} foi programado para Ø ${mm(programado, 3)} mm, e o micrômetro leu Ø ${mm(d.leitura)} mm (${sinal(diferenca, 2)} mm). Decomposição do modelo, no diâmetro: deflexão ${sinal(d.deflexao)} mm, recuo por desgaste ${sinal(d.desgaste)} mm, arredondamento da leitura ${sinal(d.arredondamento)} mm. ${situacao}`;
  const feedback: Record<string, string> = {};
  for (const o of opcoes) {
    if (o.id === correta) feedback[o.id] = 'Correto. ' + explicacao;
    else if (o.id === 'termica')
      feedback[o.id] =
        'A dilatação térmica existe, mas este protótipo não a modela (veja as limitações). Por isso ela não pode ser a causa calculada aqui. ' +
        explicacao;
    else if (o.id === 'programacao')
      feedback[o.id] =
        'A diferença perguntada já desconta o diâmetro programado: a conta Dref − 2·ap foi aplicada exatamente. ' + explicacao;
    else feedback[o.id] = 'Não foi a maior parcela. ' + explicacao;
  }
  return {
    id: 'causa-diametro',
    enunciado: `Na seção ${pontoId}, o diâmetro lido ficou ${sinal(diferenca, 2)} mm em relação ao programado. Qual foi a principal causa?`,
    contexto: 'As parcelas vêm do modelo didático e somam o diâmetro verdadeiro da peça simulada.',
    opcoes,
    correta,
    feedback,
    explicacao,
  };
}

// ---------------------------------------------------------------- relatório

export function avaliarEntrega(e: EstadoPartida, pj: PecaJogo): RelatorioEntrega {
  const { encomenda: enc } = e.ctx;
  const peca = pj.peca;
  const req = enc.requisitos;
  const pontos = enc.pontosMedicao
    .filter((p) => p.z < req.comprimento.nominal)
    .map((p) => ({ id: p.id, z: p.z, aval: avaliarDiametro(lerDiametro(peca, p.z, enc), enc) }));
  const [z0, z1] = regiaoFuncional(enc);
  const ext = extremosEntre(peca, z0, z1);
  const res = enc.instrumentos.micrometro.resolucao;
  const perfil = {
    min: avaliarDiametro(leitura(ext.min, res), enc),
    max: avaliarDiametro(leitura(ext.max, res), enc),
    z0,
    z1,
  };
  const comprimentoLido = lerComprimentoUsinado(peca, enc);
  const comprimento = {
    leitura: comprimentoLido,
    conforme: Math.abs(comprimentoLido - req.comprimento.nominal) <= req.comprimento.tol + 1e-9,
  };
  const regiaoBruta = { conforme: !pj.motivosRefugo.some((m) => m.tipo === 'regiao-bruta-usinada') };
  const conformeDimensoes =
    perfil.min.status === 'conforme' &&
    perfil.max.status === 'conforme' &&
    pontos.every((p) => p.aval.status === 'conforme') &&
    comprimento.conforme &&
    regiaoBruta.conforme;

  // Superfície: pior Ra estimada na região funcional.
  let raMax: number | null = null;
  let zPior: number | null = null;
  let regiaoBrutaNaFuncional = false;
  const nFunc = celulasAte(peca, z1);
  for (let i = 0; i < nFunc; i++) {
    if (peca.origem[i] === -1) {
      regiaoBrutaNaFuncional = true;
      continue;
    }
    if (raMax === null || peca.ra[i] > raMax) {
      raMax = peca.ra[i];
      zPior = (i + 0.5) * 0.1;
    }
  }
  const passeOrigem = zPior !== null ? peca.origem[celulaEm(peca, zPior)] : null;
  const regOrigem = passeOrigem ? passePorNumero(e, passeOrigem) : undefined;
  const componentes = regOrigem && zPior !== null ? regOrigem.celulas[celulaEm(peca, zPior)].ra : null;
  const conformeRa = raMax !== null && !regiaoBrutaNaFuncional && raMax <= req.ra.max + 1e-9;
  const faixa = raMax !== null ? faixaRa(raMax) : null;
  const superficie = {
    raMax,
    faixa,
    zPior,
    passeOrigem,
    componentes,
    conforme: conformeRa,
    margemPequena: faixa !== null && faixa[0] <= req.ra.max && faixa[1] >= req.ra.max,
    regiaoBrutaNaFuncional,
  };

  // Decomposição do diâmetro no ponto de maior desvio absoluto.
  const piorPonto = pontos.slice().sort((a, b) => Math.abs(b.aval.desvio) - Math.abs(a.aval.desvio))[0];
  const decomposicao = piorPonto ? decomporDiametro(e, pj, piorPonto.z) : null;

  const custos = calcularCustos(e);
  const orcamento = e.modo === 'encomenda' ? enc.modoEncomenda.orcamento : null;
  const passesPeca = pj.passes.map((n) => passePorNumero(e, n)).filter((r): r is RegistroPasse => !!r);
  const ultimo = passesPeca[passesPeca.length - 1];
  const volumeRemovido = passesPeca.reduce((s, r) => s + r.volume, 0);
  const conformeGeral = conformeDimensoes && conformeRa && pj.estado !== 'refugo';

  // ------------------------------------------------ critérios
  const criterios: Criterio[] = [];
  const falhas: string[] = [];
  if (!pontos.every((p) => p.aval.status === 'conforme') || perfil.min.status !== 'conforme' || perfil.max.status !== 'conforme')
    falhas.push(
      `Diâmetro: perfil entre Ø ${mm(perfil.min.leitura)} e Ø ${mm(perfil.max.leitura)} mm; tolerância de ${mm(limitesDiametro(enc).min)} a ${mm(limitesDiametro(enc).max)} mm.`,
    );
  if (!comprimento.conforme)
    falhas.push(`Comprimento usinado: ${mm(comprimento.leitura)} mm; pedido ${mm(req.comprimento.nominal, 1)} ± ${mm(req.comprimento.tol, 1)} mm.`);
  if (!regiaoBruta.conforme) falhas.push('A região que devia permanecer bruta foi usinada.');
  if (!conformeRa)
    falhas.push(
      regiaoBrutaNaFuncional
        ? 'Parte da região funcional continua com a superfície original (carepa).'
        : `Ra estimada ≈ ${um(raMax ?? 0)} µm, acima do limite de ${um(req.ra.max)} µm.`,
    );
  criterios.push({
    id: 'especificacoes',
    titulo: 'Cumprimento das especificações',
    nivel: falhas.length === 0 ? 'atende' : 'nao-atende',
    texto: falhas.length
      ? falhas
      : [
          `Diâmetro na região funcional entre Ø ${mm(perfil.min.leitura)} e Ø ${mm(perfil.max.leitura)} mm, comprimento ${mm(comprimento.leitura)} mm e Ra estimada ≈ ${um(raMax ?? 0)} µm.`,
        ],
  });

  // Planejamento do sobremetal.
  const refugosAnteriores = e.pecas.filter((p) => p.numero !== pj.numero && p.estado === 'refugo');
  const planTexto: string[] = [];
  let planNivel: Nivel = 'atende';
  const seq = passesPeca.map((r) => `${r.params.operacao === 'desbaste' ? 'D' : 'A'} ap ${mm(r.params.ap)}`).join(' → ');
  planTexto.push(`Sequência na peça ${pj.numero}: ${seq} (sobremetal radial inicial ${mm((enc.tarugo.diametro - req.diametro.nominal) / 2)} mm).`);
  if (pj.estado === 'refugo') {
    planNivel = 'nao-atende';
    planTexto.push('A peça entregue é refugo, porque a soma das profundidades passou do sobremetal disponível ou o passe saiu da região.');
  } else if (decomposicao && ultimo) {
    const larguraTol = req.diametro.tolSup - req.diametro.tolInf;
    if (decomposicao.deflexao > larguraTol / 2) {
      planNivel = 'parcial';
      planTexto.push(
        `O passe que gerou a superfície da seção ${piorPonto.id} removeu ${mm(ultimo.apEfetivaMax)} mm no raio. A força passiva deixou ${sinal(decomposicao.deflexao)} mm de deflexão no diâmetro, mais da metade da largura da tolerância (${mm(larguraTol)} mm).`,
      );
    }
    if (componentes && componentes.atrito > 0) {
      planNivel = 'parcial';
      planTexto.push(
        `O sobremetal do último passe ficou abaixo do necessário para cortar de forma estável (atrito acrescentou ≈ ${um(componentes.atrito)} µm à Ra).`,
      );
    }
    if (planNivel === 'atende')
      planTexto.push(
        `O passe final removeu ${mm(ultimo.apEfetivaMax)} mm no raio, com deflexão de ${sinal(decomposicao.deflexao)} mm no diâmetro e sem atrito por profundidade insuficiente.`,
      );
  }
  if (refugosAnteriores.length) {
    if (planNivel === 'atende') planNivel = 'parcial';
    planTexto.push(`Tarugos refugados antes desta peça: ${refugosAnteriores.map((p) => p.numero).join(', ')}.`);
  }
  criterios.push({ id: 'sobremetal', titulo: 'Planejamento do sobremetal', nivel: planNivel, texto: planTexto });

  // Decisões baseadas em medição.
  const medPeca = e.medicoes.filter((m) => m.pecaNumero === pj.numero && m.alvo !== 'comprimento');
  const ultimoNumero = ultimo?.numero ?? 0;
  const medIntermediaria = medPeca.filter((m) => m.aposPasse >= 1 && m.aposPasse < ultimoNumero);
  const medFinal = medPeca.filter((m) => m.aposPasse === ultimoNumero);
  const evidTexto: string[] = [];
  let evidNivel: Nivel;
  if (medIntermediaria.length) {
    evidNivel = 'atende';
    const m = medIntermediaria[medIntermediaria.length - 1];
    evidTexto.push(`Você mediu ${m.rotulo} = ${mm(m.valor)} mm após o passe ${m.aposPasse}, antes de programar o passe final.`);
    if (ultimo) {
      const comp = ultimo.previsao.dprog - req.diametro.nominal;
      evidTexto.push(
        Math.abs(comp) >= 0.005
          ? `O passe final foi programado para Ø ${mm(ultimo.previsao.dprog, 3)} mm (${sinal(comp)} mm do nominal), uma compensação deliberada.`
          : `O passe final foi programado exatamente no nominal (Ø ${mm(ultimo.previsao.dprog, 3)} mm), sem compensar a deflexão nem o desgaste.`,
      );
    }
  } else if (medFinal.length) {
    evidNivel = 'parcial';
    evidTexto.push('Você mediu só depois do último passe. Nesse momento não dava mais para corrigir o diâmetro com o resultado.');
  } else {
    evidNivel = 'nao-atende';
    evidTexto.push('A peça foi entregue sem nenhuma medição de diâmetro.');
  }
  criterios.push({ id: 'evidencias', titulo: 'Escolhas justificadas por medições', nivel: evidNivel, texto: evidTexto });

  // Recursos.
  const recTexto: string[] = [
    `Tempo total ${mm(tempoTotal(e.tempos))} min, sendo ${mm(e.tempos.corte)} min em avanço de corte. Custo didático ${mm(custos.total, 1)} u.c. (tarugos ${mm(custos.tarugos, 1)}, máquina ${mm(custos.maquina, 1)}, arestas ${mm(custos.arestas, 1)}).`,
    `Material removido na peça entregue: ${mm(volumeRemovido / 1000, 1)} cm³ em ${passesPeca.length} passe(s). Tarugos usados: ${e.pecas.length}. Consumo de arestas: ${mm(custos.consumoArestas * 100, 0)} % de uma aresta.`,
  ];
  let recNivel: Nivel = 'informativo';
  if (orcamento !== null) {
    recNivel = custos.total <= orcamento ? 'atende' : custos.total <= orcamento * 1.2 ? 'parcial' : 'nao-atende';
    recTexto.unshift(`Orçamento: ${mm(orcamento, 1)} u.c.; gasto ${mm(custos.total, 1)} u.c.`);
  } else recTexto.unshift('Laboratório: sem orçamento. Os custos aparecem para comparação.');
  criterios.push({ id: 'recursos', titulo: 'Uso dos recursos', nivel: recNivel, texto: recTexto });

  // ------------------------------------------------ fatores principais (explicações com números reais)
  const fatores: string[] = [];
  if (decomposicao) {
    fatores.push(
      `Diâmetro (seção ${piorPonto.id}): Ø verdadeiro do modelo ${mm(decomposicao.verdadeiro, 3)} mm = nominal ${mm(decomposicao.nominal)} ${sinal(decomposicao.programacao)} (programação) ${sinal(decomposicao.deflexao)} (deflexão) ${sinal(decomposicao.desgaste)} (recuo por desgaste). O micrômetro leu ${mm(decomposicao.leitura)} mm.`,
    );
  }
  if (componentes && raMax !== null) {
    fatores.push(
      `Superfície: a pior Ra estimada (≈ ${um(raMax)} µm, faixa didática ${um(faixa![0])}–${um(faixa![1])} µm) fica em z ≈ ${mm(zPior!, 1)} mm, no passe ${passeOrigem}. A maior parcela é ${NOMES_RA[maiorParcelaRa(componentes)]}.`,
    );
  }
  for (const r of passesPeca) {
    if (r.cortouCasca) {
      const fator = materialDaPeca(pj).comportamento.fatorCasca(r.apEfetivaMax);
      fatores.push(
        `Carepa: o passe ${r.numero} cortou a superfície laminada com ap ≈ ${mm(r.apEfetivaMax)} mm. Ali o desgaste foi multiplicado por ≈ ${mm(fator, 1)}${r.apEfetivaMax <= 0.25 ? ' porque a aresta trabalhou inteira dentro da carepa' : ''}.`,
      );
    }
    if (r.lascouEm !== null)
      fatores.push(`Lascamento: no passe ${r.numero}, a carga crítica (ap ${mm(r.params.ap)} mm, f ${mm(r.params.f)} mm/volta) lascou a aresta em z ≈ ${mm(r.lascouEm, 1)} mm.`);
    if (r.vidaReferencia < 3)
      fatores.push(
        `Velocidade de corte: no passe ${r.numero}, vc ≈ ${Math.round(r.vcModelo)} m/min reduziu a vida de referência da aresta para ≈ ${mm(r.vidaReferencia, 1)} min (curva sintética).`,
      );
  }
  const fitas = passesPeca.filter((r) => r.cavaco.tipo === 'fita');
  if (fitas.length)
    fatores.push(
      `Cavaco: ${fitas.length} passe(s) formaram fita longa (${fitas.map((r) => r.numero).join(', ')}). Cada um somou ${mm(enc.tempos.limpezaCavaco, 1)} min de parada para retirar o cavaco.`,
    );
  fatores.push(
    `Tempo: ${passesPeca.length} passe(s) somaram ${mm(passesPeca.reduce((s, r) => s + r.previsao.tc, 0))} min de avanço e ${mm(passesPeca.length * enc.tempos.naoProdutivoPorPasse, 1)} min de retorno e ajuste. Cada passe a mais custa tempo não produtivo.`,
  );

  // ------------------------------------------------ pergunta
  let pergunta: Pergunta | null = perguntaRefugo(e, pj);
  if (!pergunta && componentes && raMax !== null && !conformeRa && regOrigem)
    pergunta = perguntaRa(componentes, raMax, regOrigem, false, req.ra.max);
  const diferencaProgramado = decomposicao ? Math.abs(decomposicao.leitura - decomposicao.nominal - decomposicao.programacao) : 0;
  if (!pergunta && decomposicao && piorPonto && (piorPonto.aval.status !== 'conforme' || diferencaProgramado >= 0.01 - 1e-9))
    pergunta = perguntaDiametro(decomposicao, piorPonto.id, piorPonto.aval.status === 'conforme');
  if (!pergunta && componentes && raMax !== null && regOrigem)
    pergunta = perguntaRa(componentes, raMax, regOrigem, conformeRa, req.ra.max);
  if (!pergunta && decomposicao && piorPonto) pergunta = perguntaDiametro(decomposicao, piorPonto.id, piorPonto.aval.status === 'conforme');
  if (!pergunta) {
    pergunta = {
      id: 'sem-dados',
      enunciado: 'A região funcional não foi usinada. O que impede avaliar o diâmetro?',
      contexto: 'Nenhum passe gerou superfície na região funcional.',
      opcoes: [
        { id: 'bruta', texto: 'A superfície continua bruta, então ainda não existe resultado de usinagem.' },
        { id: 'medicao', texto: 'O micrômetro não mede superfícies brutas.' },
      ],
      correta: 'bruta',
      feedback: {
        bruta: 'Correto. Sem passe na região, não há dimensão usinada para avaliar.',
        medicao: 'Não é isso. A leitura existe, mas mede a barra laminada, não o resultado de um passe.',
      },
      explicacao: '',
    };
  }

  criterios.push({
    id: 'analise',
    titulo: 'Análise do desvio observado',
    nivel: 'pendente',
    texto: ['Responda à pergunta estruturada abaixo.'],
  });

  return {
    pecaNumero: pj.numero,
    modo: e.modo,
    pontos,
    perfil,
    comprimento,
    regiaoBruta,
    superficie,
    decomposicao,
    tempos: { ...e.tempos },
    tempoTotal: tempoTotal(e.tempos),
    custos,
    orcamento,
    arestas: e.arestas.map((a) => ({
      numero: a.numero,
      vb: vbDeDano(a.estado.dano, ferramentas[a.ferramentaId]),
      consumo: consumoAresta(a.estado),
      lascada: a.estado.lascada,
    })),
    volumeRemovido,
    conformeDimensoes,
    conformeGeral,
    criterios,
    fatores,
    pergunta,
  };
}

/** Critério de análise depois da resposta. */
export function criterioAnalise(r: RelatorioEntrega): Criterio {
  if (!r.resposta)
    return { id: 'analise', titulo: 'Análise do desvio observado', nivel: 'pendente', texto: ['Responda à pergunta estruturada.'] };
  const certo = r.resposta === r.pergunta.correta;
  return {
    id: 'analise',
    titulo: 'Análise do desvio observado',
    nivel: certo ? 'atende' : 'parcial',
    texto: [r.pergunta.feedback[r.resposta]],
  };
}
