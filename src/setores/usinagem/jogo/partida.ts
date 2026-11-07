// Estado da partida derivado de um registro de ações. A partida salva só as ações:
// reproduzi-las (sempre deterministicamente) reconstrói peças, ferramentas, tempos e custos.

import { contextoDe, ferramentas, LIVRE, material as materialPorId, materiais, type Contexto } from '../dados/catalogo';
import { criarPeca, copiarPeca, type Peca } from '../modelo/peca';
import {
  arestaNova,
  recuoDaPonta,
  simularPasse,
  verificarParametros,
  type EstadoAresta,
  type ResultadoPasse,
} from '../modelo/passe';
import { simularFuracao, verificarFuracao, type ResultadoFuracao } from '../modelo/furacao';
import {
  lerComprimentoUsinado,
  lerDiametro,
  lerFuro,
  lerProfundidadeFuro,
  verificarRefugo,
  type MotivoRefugo,
} from '../modelo/medicao';
import type { Broca, Ferramenta, FerramentaTornear, Material, ParametrosFuracao, ParametrosPasse } from '../modelo/tipos';
import { avaliarEntrega, type RelatorioEntrega } from './avaliacao';
import { estoqueRestante } from './recursos';

/** 'laboratorio' é o modo livre (o identificador antigo foi mantido para não perder progresso salvo). */
export type Modo = 'encomenda' | 'laboratorio';
export type ParametroControlavel = 'n' | 'f' | 'ap' | 'L' | 'operacao' | 'P' | 'q';

export interface ControleExperimento {
  /** Operação tomada como base no experimento "um parâmetro por vez". */
  baseNumero: number;
  alterado: ParametroControlavel | null;
  mantidos: ParametroControlavel[];
}

export type Acao =
  | { tipo: 'passe'; params: ParametrosPasse; estacao?: number; controle?: ControleExperimento }
  | { tipo: 'furar'; params: ParametrosFuracao; estacao: number; controle?: ControleExperimento }
  | { tipo: 'trocarAresta'; estacao?: number }
  | { tipo: 'montarFerramenta'; estacao: number; ferramentaId: string }
  | { tipo: 'novoTarugo'; materialId?: string; diametro?: number; balanco?: number }
  | { tipo: 'prepararEquivalente'; passeBase: number }
  | { tipo: 'medir'; alvo: string; z?: number }
  | { tipo: 'entregar' }
  | { tipo: 'responder'; opcao: string };

interface RegistroComum {
  numero: number; // 1, 2, 3… em toda a partida
  pecaNumero: number;
  arestaNumero: number; // número da instância de ferramenta
  estacao: number;
  ferramentaId: string;
  materialId: string;
  pecaAntes: Peca;
  pecaDepois: Peca;
  arestaAntes: EstadoAresta;
  arestaDepois: EstadoAresta;
  controle?: ControleExperimento;
  tempoLimpeza: number; // min (cavaco em fita)
  refugoApos: MotivoRefugo[];
}

export interface RegistroPasse extends ResultadoPasse, RegistroComum {
  tipo: 'tornear';
}

export interface RegistroFuracao extends ResultadoFuracao, RegistroComum {
  tipo: 'furar';
}

export type RegistroOperacao = RegistroPasse | RegistroFuracao;

export const ehTorneamento = (r: RegistroOperacao | undefined): r is RegistroPasse => r?.tipo === 'tornear';
export const ehFuracao = (r: RegistroOperacao | undefined): r is RegistroFuracao => r?.tipo === 'furar';

export interface RegistroMedicao {
  numero: number;
  alvo: string;
  z?: number;
  pecaNumero: number;
  aposPasse: number; // número da última operação na peça (0 = bruta)
  valor: number; // leitura em mm
  rotulo: string;
}

export type EstadoPeca = 'em-usinagem' | 'refugo' | 'entregue';

export interface PecaJogo {
  numero: number;
  peca: Peca;
  estado: EstadoPeca;
  motivosRefugo: MotivoRefugo[];
  passes: number[];
  equivalenteDe?: number;
  /** Impedimento físico (ex.: broca quebrada presa no furo). */
  bloqueio?: string;
}

export interface InstanciaFerramenta {
  numero: number;
  ferramentaId: string;
  estacao: number;
  estado: EstadoAresta;
  equivalenteDe?: number;
}

export interface Tempos {
  corte: number; // percurso em avanço (inclui aproximação e descargas)
  naoProdutivo: number;
  limpeza: number;
  trocas: number;
  preparacao: number;
}

export interface EstadoPartida {
  modo: Modo;
  ctx: Contexto;
  pecas: PecaJogo[];
  /** Todas as instâncias de ferramenta já usadas (arestas, brocas). */
  arestas: InstanciaFerramenta[];
  /** torre[posição − 1] = número da instância montada, ou null. */
  torre: (number | null)[];
  /** Estação ativa (última usada ou selecionada). */
  estacaoAtiva: number;
  passes: RegistroOperacao[];
  medicoes: RegistroMedicao[];
  tempos: Tempos;
  /** Arestas/ferramentas novas retiradas do estoque (montagens + trocas). */
  consumoEstoque: number;
  entregas: RelatorioEntrega[];
  encerrada: boolean;
}

export const duracaoOperacao = (r: RegistroOperacao) => (r.tipo === 'furar' ? r.tcEfetivo : r.previsao.tc);
export const pecaAtual = (e: EstadoPartida) => e.pecas[e.pecas.length - 1];
export const instancia = (e: EstadoPartida, numero: number) => e.arestas[numero - 1];
export const instanciaNaEstacao = (e: EstadoPartida, estacao: number): InstanciaFerramenta | null => {
  const n = e.torre[estacao - 1];
  return n ? instancia(e, n) : null;
};
/** Instância da estação ativa (compatibilidade com a interface de uma só ferramenta). */
export const arestaAtual = (e: EstadoPartida): InstanciaFerramenta => {
  const i = instanciaNaEstacao(e, e.estacaoAtiva);
  return i ?? e.arestas[e.arestas.length - 1];
};
export const materialDaPeca = (pj: PecaJogo): Material => materialPorId(pj.peca.materialId);
export const ferramentaDe = (inst: InstanciaFerramenta): Ferramenta => ferramentas[inst.ferramentaId];
export const operacao = (e: EstadoPartida, numero: number): RegistroOperacao | undefined => e.passes[numero - 1];

function torreInicial(modo: Modo, ctx: Contexto): Record<number, string> {
  return modo === 'encomenda' ? ctx.encomenda.torreInicial : LIVRE.torre;
}

export function iniciarPartida(modo: Modo, encomendaId: string): EstadoPartida {
  const ctx = contextoDe(encomendaId);
  const { tarugo } = ctx.encomenda;
  const peca =
    modo === 'encomenda'
      ? criarPeca(tarugo.diametro, tarugo.comprimentoTotal - tarugo.comprimentoFixado, ctx.encomenda.materialId)
      : criarPeca(LIVRE.diametro, LIVRE.balanco, LIVRE.materialId);
  const arestas: InstanciaFerramenta[] = [];
  const torre: (number | null)[] = new Array(ctx.maquina.estacoes).fill(null);
  const ti = torreInicial(modo, ctx);
  for (let pos = 1; pos <= ctx.maquina.estacoes; pos++) {
    const id = ti[pos];
    if (!id || !ferramentas[id]) continue;
    arestas.push({ numero: arestas.length + 1, ferramentaId: id, estacao: pos, estado: arestaNova() });
    torre[pos - 1] = arestas.length;
  }
  return {
    modo,
    ctx,
    pecas: [{ numero: 1, peca, estado: 'em-usinagem', motivosRefugo: [], passes: [] }],
    arestas,
    torre,
    estacaoAtiva: torre.findIndex((n) => n !== null) + 1 || 1,
    passes: [],
    medicoes: [],
    tempos: { corte: 0, naoProdutivo: 0, limpeza: 0, trocas: 0, preparacao: ctx.encomenda.tempos.preparacaoTarugo },
    consumoEstoque: 0,
    entregas: [],
    encerrada: false,
  };
}

// ---------------------------------------------------------------- redutor

export type Resultado = { ok: true; estado: EstadoPartida } | { ok: false; erro: string };

const falha = (erro: string): Resultado => ({ ok: false, erro });

export function podeUsinar(e: EstadoPartida): string | null {
  if (e.encerrada) return 'A encomenda já foi entregue.';
  const p = pecaAtual(e);
  if (p.bloqueio) return p.bloqueio;
  if (p.estado === 'entregue') return 'Esta peça já foi entregue. Prepare um tarugo novo.';
  if (p.estado === 'refugo' && e.modo === 'encomenda') {
    return 'Peça refugada: o material removido não volta. É preciso um tarugo novo.';
  }
  return null;
}

function substituir<T>(lista: T[], indice: number, valor: T): T[] {
  const c = lista.slice();
  c[indice] = valor;
  return c;
}

/** Aplica o resultado de uma operação (torneamento ou furação) ao estado. */
function registrarOperacao(
  e: EstadoPartida,
  inst: InstanciaFerramenta,
  registro: RegistroOperacao,
  bloqueio: string | undefined,
): EstadoPartida {
  const pj = pecaAtual(e);
  const refugo = registro.refugoApos;
  const novaPeca: PecaJogo = {
    ...pj,
    peca: registro.pecaDepois,
    passes: [...pj.passes, registro.numero],
    estado: refugo.length || bloqueio ? 'refugo' : pj.estado,
    motivosRefugo: refugo.length ? refugo : pj.motivosRefugo,
    bloqueio: bloqueio ?? pj.bloqueio,
  };
  return {
    ...e,
    pecas: [...e.pecas.slice(0, -1), novaPeca],
    arestas: substituir(e.arestas, inst.numero - 1, { ...inst, estado: registro.arestaDepois }),
    estacaoAtiva: inst.estacao,
    passes: [...e.passes, registro],
    tempos: {
      ...e.tempos,
      corte: e.tempos.corte + duracaoOperacao(registro),
      naoProdutivo: e.tempos.naoProdutivo + e.ctx.encomenda.tempos.naoProdutivoPorPasse,
      limpeza: e.tempos.limpeza + registro.tempoLimpeza,
    },
  };
}

export function aplicarAcao(e: EstadoPartida, acao: Acao): Resultado {
  const { encomenda, maquina } = e.ctx;
  if (e.encerrada && acao.tipo !== 'responder' && acao.tipo !== 'medir') {
    return falha('A encomenda já foi entregue. Reinicie para jogar de novo.');
  }
  switch (acao.tipo) {
    case 'passe': {
      const bloqueio = podeUsinar(e);
      if (bloqueio) return falha(bloqueio);
      const estacao = acao.estacao ?? 1;
      const inst = instanciaNaEstacao(e, estacao);
      if (!inst) return falha(`Não há ferramenta na estação T${String(estacao).padStart(2, '0')}.`);
      const ferr = ferramentaDe(inst);
      if (ferr.tipo !== 'tornear') return falha(`A ferramenta em T${String(estacao).padStart(2, '0')} é uma broca: use um bloco de furação.`);
      const pj = pecaAtual(e);
      const amb = { material: materialDaPeca(pj), ferramenta: ferr as FerramentaTornear, maquina };
      const problemas = verificarParametros(pj.peca, acao.params, amb);
      if (problemas.length) return falha(problemas.map((p) => p.mensagem).join(' '));
      const numero = e.passes.length + 1;
      const saida = simularPasse(pj.peca, inst.estado, acao.params, amb, numero);
      const tempoLimpeza = saida.resultado.cavaco.tipo === 'fita' ? encomenda.tempos.limpezaCavaco : 0;
      const refugo = e.modo === 'encomenda' ? verificarRefugo(saida.peca, encomenda) : [];
      const registro: RegistroPasse = {
        ...saida.resultado,
        tipo: 'tornear',
        numero,
        pecaNumero: pj.numero,
        arestaNumero: inst.numero,
        estacao,
        ferramentaId: inst.ferramentaId,
        materialId: pj.peca.materialId,
        pecaAntes: pj.peca,
        pecaDepois: saida.peca,
        arestaAntes: inst.estado,
        arestaDepois: saida.aresta,
        controle: acao.controle,
        tempoLimpeza,
        refugoApos: refugo,
      };
      return { ok: true, estado: registrarOperacao(e, inst, registro, undefined) };
    }
    case 'furar': {
      const bloqueio = podeUsinar(e);
      if (bloqueio) return falha(bloqueio);
      const inst = instanciaNaEstacao(e, acao.estacao);
      if (!inst) return falha(`Não há ferramenta na estação T${String(acao.estacao).padStart(2, '0')}.`);
      const ferr = ferramentaDe(inst);
      if (ferr.tipo !== 'broca') return falha('A ferramenta desta estação não é uma broca.');
      if (inst.estado.lascada) return falha('A broca desta estação está quebrada: troque-a antes de furar.');
      const pj = pecaAtual(e);
      const amb = { material: materialDaPeca(pj), broca: ferr as Broca, maquina };
      const problemas = verificarFuracao(pj.peca, acao.params, amb);
      if (problemas.length) return falha(problemas.map((p) => p.mensagem).join(' '));
      const numero = e.passes.length + 1;
      const saida = simularFuracao(pj.peca, inst.estado, acao.params, amb);
      const tempoLimpeza = saida.resultado.cavaco.tipo === 'fita' ? encomenda.tempos.limpezaCavaco : 0;
      const registro: RegistroFuracao = {
        ...saida.resultado,
        tipo: 'furar',
        numero,
        pecaNumero: pj.numero,
        arestaNumero: inst.numero,
        estacao: acao.estacao,
        ferramentaId: inst.ferramentaId,
        materialId: pj.peca.materialId,
        pecaAntes: pj.peca,
        pecaDepois: saida.peca,
        arestaAntes: inst.estado,
        arestaDepois: saida.aresta,
        controle: acao.controle,
        tempoLimpeza,
        refugoApos: [],
      };
      const presa =
        saida.resultado.quebrouEm !== null
          ? `A broca quebrou a ${saida.resultado.quebrouEm.toFixed(1).replace('.', ',')} mm de profundidade e ficou presa no furo: a peça não pode mais ser usinada.`
          : undefined;
      return { ok: true, estado: registrarOperacao(e, inst, registro, presa) };
    }
    case 'trocarAresta': {
      const estacao = acao.estacao ?? 1;
      const atual = instanciaNaEstacao(e, estacao);
      if (!atual) return falha('Não há ferramenta nesta estação.');
      const est = estoqueRestante(e);
      if (est && est.arestas <= 0) return falha('Não há arestas novas no estoque desta encomenda.');
      // A aresta nova é zerada nas coordenadas programadas: recuo de referência zero.
      const nova: InstanciaFerramenta = { numero: e.arestas.length + 1, ferramentaId: atual.ferramentaId, estacao, estado: arestaNova() };
      return {
        ok: true,
        estado: {
          ...e,
          arestas: [...e.arestas, nova],
          torre: substituir(e.torre, estacao - 1, nova.numero),
          estacaoAtiva: estacao,
          consumoEstoque: e.consumoEstoque + 1,
          tempos: { ...e.tempos, trocas: e.tempos.trocas + encomenda.tempos.trocaAresta },
        },
      };
    }
    case 'montarFerramenta': {
      if (acao.estacao < 1 || acao.estacao > maquina.estacoes) return falha('Estação inexistente.');
      const ferr = ferramentas[acao.ferramentaId];
      if (!ferr) return falha('Ferramenta desconhecida.');
      if (e.modo === 'encomenda' && !encomenda.ferramentasPermitidas.includes(ferr.id))
        return falha('Esta ferramenta não está disponível para esta encomenda.');
      const atual = instanciaNaEstacao(e, acao.estacao);
      if (atual && atual.ferramentaId === ferr.id) return falha('Esta ferramenta já está montada nesta estação.');
      const est = estoqueRestante(e);
      if (est && est.arestas <= 0) return falha('Não há arestas novas no estoque desta encomenda.');
      const nova: InstanciaFerramenta = { numero: e.arestas.length + 1, ferramentaId: ferr.id, estacao: acao.estacao, estado: arestaNova() };
      return {
        ok: true,
        estado: {
          ...e,
          arestas: [...e.arestas, nova],
          torre: substituir(e.torre, acao.estacao - 1, nova.numero),
          estacaoAtiva: acao.estacao,
          consumoEstoque: e.consumoEstoque + 1,
          tempos: { ...e.tempos, trocas: e.tempos.trocas + encomenda.tempos.montagemFerramenta },
        },
      };
    }
    case 'novoTarugo': {
      const est = estoqueRestante(e);
      if (est && est.tarugos <= 0) return falha('Não há mais tarugos no estoque desta encomenda.');
      let peca: Peca;
      if (e.modo === 'encomenda') {
        const { tarugo } = encomenda;
        peca = criarPeca(tarugo.diametro, tarugo.comprimentoTotal - tarugo.comprimentoFixado, encomenda.materialId);
      } else {
        const anterior = pecaAtual(e).peca;
        const materialId = acao.materialId ?? anterior.materialId;
        const diametro = acao.diametro ?? anterior.diametroBruto;
        const balanco = acao.balanco ?? anterior.balanco;
        if (!materiais[materialId]) return falha('Material desconhecido.');
        if (!LIVRE.diametros.includes(diametro)) return falha('Diâmetro de tarugo indisponível.');
        if (!LIVRE.balancos.includes(balanco)) return falha('Balanço indisponível.');
        peca = criarPeca(diametro, balanco, materialId);
      }
      // Tangenciamento no tarugo novo com cada ferramenta de tornear montada (possivelmente desgastada).
      const arestas = e.arestas.map((inst) => {
        const f = ferramentas[inst.ferramentaId];
        if (f.tipo !== 'tornear' || !e.torre.includes(inst.numero)) return inst;
        return { ...inst, estado: { ...inst.estado, recuoReferencia: recuoDaPonta(inst.estado, f) } };
      });
      return {
        ok: true,
        estado: {
          ...e,
          arestas,
          pecas: [...e.pecas, { numero: e.pecas.length + 1, peca, estado: 'em-usinagem', motivosRefugo: [], passes: [] }],
          tempos: { ...e.tempos, preparacao: e.tempos.preparacao + encomenda.tempos.preparacaoTarugo },
        },
      };
    }
    case 'prepararEquivalente': {
      if (e.modo !== 'laboratorio') return falha('Condições equivalentes só existem no modo livre.');
      const base = e.passes.find((p) => p.numero === acao.passeBase);
      if (!base) return falha('Operação-base não encontrada.');
      const peca = copiarPeca(base.pecaAntes);
      const nova: InstanciaFerramenta = {
        numero: e.arestas.length + 1,
        ferramentaId: base.ferramentaId,
        estacao: base.estacao,
        estado: { ...base.arestaAntes },
        equivalenteDe: base.numero,
      };
      return {
        ok: true,
        estado: {
          ...e,
          pecas: [
            ...e.pecas,
            { numero: e.pecas.length + 1, peca, estado: 'em-usinagem', motivosRefugo: [], passes: [], equivalenteDe: base.numero },
          ],
          arestas: [...e.arestas, nova],
          torre: substituir(e.torre, base.estacao - 1, nova.numero),
          estacaoAtiva: base.estacao,
          tempos: { ...e.tempos, preparacao: e.tempos.preparacao + encomenda.tempos.preparacaoTarugo },
        },
      };
    }
    case 'medir': {
      const pj = pecaAtual(e);
      const aposPasse = pj.passes.length ? pj.passes[pj.passes.length - 1] : 0;
      let valor: number;
      let rotulo: string;
      const z = acao.z;
      const zOk = z !== undefined && Number.isFinite(z) && z >= 0 && z < pj.peca.balanco;
      if (acao.alvo === 'comprimento') {
        valor = lerComprimentoUsinado(pj.peca, encomenda);
        rotulo = 'Comprimento usinado (paquímetro)';
      } else if (acao.alvo === 'profundidade') {
        valor = lerProfundidadeFuro(pj.peca, encomenda);
        rotulo = 'Profundidade do furo (paquímetro de profundidade)';
      } else if (acao.alvo === 'externo' || acao.alvo === 'interno') {
        if (!zOk) return falha('Posição de medição fora da peça.');
        valor = acao.alvo === 'externo' ? lerDiametro(pj.peca, z!, encomenda) : lerFuro(pj.peca, z!, encomenda);
        rotulo = `${acao.alvo === 'externo' ? 'Ø externo' : 'Ø do furo'} em Z −${z!.toFixed(1).replace('.', ',')} mm`;
      } else {
        const ponto = encomenda.pontosMedicao.find((p) => p.id === acao.alvo);
        if (!ponto || e.modo !== 'encomenda') return falha('Ponto de medição desconhecido.');
        valor = lerDiametro(pj.peca, ponto.z, encomenda);
        rotulo = `Ø na seção ${ponto.id} (Z −${ponto.z} mm)`;
      }
      return {
        ok: true,
        estado: {
          ...e,
          medicoes: [
            ...e.medicoes,
            { numero: e.medicoes.length + 1, alvo: acao.alvo, z: zOk ? z : undefined, pecaNumero: pj.numero, aposPasse, valor, rotulo },
          ],
        },
      };
    }
    case 'entregar': {
      if (e.modo !== 'encomenda') return falha('No modo livre não há entrega.');
      const pj = pecaAtual(e);
      if (pj.estado === 'entregue') return falha('Esta peça já foi entregue.');
      if (!pj.passes.length) return falha('A peça ainda não foi usinada.');
      const relatorio = avaliarEntrega(e, pj);
      return {
        ok: true,
        estado: {
          ...e,
          pecas: [...e.pecas.slice(0, -1), { ...pj, estado: 'entregue' }],
          entregas: [...e.entregas, relatorio],
          encerrada: true,
        },
      };
    }
    case 'responder': {
      const ultima = e.entregas[e.entregas.length - 1];
      if (!ultima) return falha('Nada a responder ainda.');
      if (ultima.resposta) return falha('A pergunta já foi respondida.');
      if (!ultima.pergunta.opcoes.some((o) => o.id === acao.opcao)) return falha('Opção inválida.');
      return {
        ok: true,
        estado: {
          ...e,
          entregas: [...e.entregas.slice(0, -1), { ...ultima, resposta: acao.opcao }],
        },
      };
    }
  }
}

/** Reconstrói a partida a partir das ações; ações inválidas (ex.: arquivo adulterado) são descartadas. */
export function reproduzir(
  modo: Modo,
  encomendaId: string,
  acoes: Acao[],
): { estado: EstadoPartida; aceitas: Acao[] } {
  let estado = iniciarPartida(modo, encomendaId);
  const aceitas: Acao[] = [];
  for (const a of acoes) {
    const r = aplicarAcao(estado, a);
    if (r.ok) {
      estado = r.estado;
      aceitas.push(a);
    }
  }
  return { estado, aceitas };
}
