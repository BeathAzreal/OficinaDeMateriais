import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ferramentas } from '../dados/catalogo';
import {
  aplicarAcao,
  instanciaNaEstacao,
  materialDaPeca,
  pecaAtual,
  reproduzir,
  type Acao,
  type Modo,
} from '../jogo/partida';
import { calcularCustos, estoqueRestante, tempoTotal } from '../jogo/recursos';
import { armazenamentoDoNavegador, carregar, reiniciarModo, salvar, type Salvo } from '../jogo/persistencia';
import { blocoParaAcao, inserirBloco, novoId, parametrosDoBloco, referenciasDosBlocos, type Bloco, type Programa } from '../jogo/programa';
import { vbDeDano } from '../modelo/fenomenos';
import { comprimentoPonta, verificarFuracao } from '../modelo/furacao';
import { verificarParametros } from '../modelo/passe';
import type { Broca, FerramentaTornear } from '../modelo/tipos';
import { num } from './formato';
import { Dialogo, SobreModelo, Tutorial, PASSOS_TUTORIAL } from './componentes/Dialogos';
import { PainelEntregar } from './componentes/PainelEntregar';
import { PainelFerramentas } from './componentes/PainelFerramentas';
import { PainelHistorico } from './componentes/PainelHistorico';
import { PainelMaquina } from './componentes/PainelMaquina';
import { PainelMedicao } from './componentes/PainelMedicao';
import { PainelPeca } from './componentes/PainelPeca';
import { PainelPrograma } from './componentes/PainelPrograma';
import type { PrevisaoDesenho } from './componentes/Torno';
import type { RelatorioEntrega } from '../jogo/avaliacao';

/** v2.2 (fábrica): avisado a cada peça entregue na encomenda. */
export interface PropsUsinagem {
  aoEntregar?: (relatorio: RelatorioEntrega) => void;
}

type Aba = 'programa' | 'ferramentas' | 'peca' | 'medicao' | 'historico' | 'entrega';
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: 'programa', rotulo: 'PROGRAMA' },
  { id: 'ferramentas', rotulo: 'FERRAMENTAS' },
  { id: 'peca', rotulo: 'PEÇA' },
  { id: 'medicao', rotulo: 'MEDIÇÃO' },
  { id: 'historico', rotulo: 'HISTÓRICO' },
  { id: 'entrega', rotulo: 'ENTREGA' },
];

interface EmCurso {
  indice: number;
  mdi: boolean;
}

export function App({ aoEntregar }: PropsUsinagem) {
  const arm = useMemo(() => armazenamentoDoNavegador(), []);
  const [salvo, setSalvo] = useState<Salvo>(() => carregar(arm));
  const [aba, setAba] = useState<Aba>('peca');
  const [selecionado, setSelecionado] = useState(0);
  const [animando, setAnimando] = useState<number | null>(null);
  const [execucao, setExecucao] = useState(-1);
  const [emCurso, setEmCurso] = useState<EmCurso | null>(null);
  const [executando, setExecutando] = useState(false);
  const [blocoABloco, setBlocoABloco] = useState(false);
  const [proximo, setProximo] = useState<number | null>(null);
  const [alarme, setAlarme] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [tutorial, setTutorial] = useState<number | null>(salvo.configuracoes.tutorialVisto ? null : 0);

  useEffect(() => {
    salvar(arm, salvo);
  }, [arm, salvo]);

  const modo = salvo.configuracoes.modo;
  const partida = salvo.partidas[modo];
  const programa = partida.programa;
  const estado = useMemo(() => reproduzir(modo, partida.encomendaId, partida.acoes).estado, [modo, partida.encomendaId, partida.acoes]);
  const ctx = estado.ctx;
  // Só avisa entregas novas (não as que já estavam salvas ao abrir o setor).
  const entregasVistas = useRef(modo === 'encomenda' ? estado.entregas.length : 0);
  useEffect(() => {
    if (modo !== 'encomenda') return;
    const n = estado.entregas.length;
    if (n > entregasVistas.current) aoEntregar?.(estado.entregas[n - 1]);
    entregasVistas.current = n;
  }, [modo, estado.entregas, aoEntregar]);
  const pj = pecaAtual(estado);
  const material = materialDaPeca(pj);
  // A operação animada só é mostrada enquanto for a última da peça que está na placa.
  const regAnim = animando !== null ? estado.passes[animando - 1] ?? null : null;
  const registroAnimado = regAnim && regAnim.pecaNumero === pj.numero && pj.passes[pj.passes.length - 1] === regAnim.numero ? regAnim : null;
  const ocupado = emCurso !== null;
  const abas = ABAS.filter((a) => a.id !== 'entrega' || modo === 'encomenda');

  const setPrograma = (p: Programa) =>
    setSalvo((s) => ({ ...s, partidas: { ...s.partidas, [modo]: { ...s.partidas[modo], programa: p } } }));

  const despachar = (acao: Acao): string | null => {
    const r = aplicarAcao(estado, acao);
    if (!r.ok) {
      setAlarme(r.erro);
      return r.erro;
    }
    setAlarme(null);
    setSalvo((s) => ({
      ...s,
      partidas: { ...s.partidas, [modo]: { ...s.partidas[modo], acoes: [...s.partidas[modo].acoes, acao] } },
    }));
    if (acao.tipo === 'passe' || acao.tipo === 'furar') {
      setAnimando(r.estado.passes.length);
      setExecucao((x) => x + 1);
    }
    if (acao.tipo === 'entregar') setAba('entrega');
    return null;
  };

  const executarBloco = (i: number, mdi: boolean) => {
    const b = programa.blocos[i];
    if (!b) {
      setExecutando(false);
      setMensagem('Fim do programa (M30). Use “Cursor ao início” para repetir.');
      return;
    }
    setSelecionado(i);
    if (b.tipo === 'parada') {
      if (!mdi) setPrograma({ ...programa, cursor: i + 1 });
      setExecutando(false);
      setMensagem(`M00 — parada programada: ${b.comentario || 'sem comentário'}. Aperte CICLO INÍCIO para continuar.`);
      return;
    }
    const acao = blocoParaAcao(b, estado)!;
    const erro = despachar(acao);
    if (erro) {
      setExecutando(false);
      return;
    }
    setMensagem(null);
    setEmCurso({ indice: i, mdi });
  };

  const cicloInicio = () => {
    setAlarme(null);
    if (programa.cursor >= programa.blocos.length) {
      setMensagem('Fim do programa (M30). Use “Cursor ao início” para repetir.');
      return;
    }
    setExecutando(true);
    executarBloco(programa.cursor, false);
  };

  const fimDaAnimacao = () => {
    if (!emCurso) return;
    const atual = emCurso;
    setEmCurso(null);
    if (atual.mdi) {
      setMensagem('Bloco executado em MDI (o cursor do programa não muda).');
      return;
    }
    const cursor = atual.indice + 1;
    setPrograma({ ...programa, cursor });
    const quebrou = pecaAtual(estado).bloqueio;
    if (executando && !blocoABloco && cursor < programa.blocos.length && !quebrou) setProximo(cursor);
    else {
      setExecutando(false);
      setMensagem(cursor >= programa.blocos.length ? 'Fim do programa (M30).' : blocoABloco ? 'Bloco a bloco: aperte CICLO INÍCIO para o próximo.' : null);
    }
  };

  // Continua o ciclo depois que o estado foi atualizado pela operação anterior.
  useEffect(() => {
    if (proximo !== null && emCurso === null) {
      const i = proximo;
      setProximo(null);
      executarBloco(i, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proximo, emCurso]);

  const resetar = () => {
    setExecutando(false);
    setProximo(null);
    setAlarme(null);
    setMensagem('RESET: programa parado. O cursor fica no próximo bloco.');
  };

  const limparExecucao = () => {
    setAnimando(null);
    setEmCurso(null);
    setExecutando(false);
    setProximo(null);
    setAlarme(null);
    setMensagem(null);
  };

  const trocarModo = (m: Modo) => {
    limparExecucao();
    setSelecionado(0);
    setSalvo((s) => ({ ...s, configuracoes: { ...s.configuracoes, modo: m } }));
  };

  const reiniciar = () => {
    limparExecucao();
    setSalvo((s) => reiniciarModo(s, modo));
    setConfirmar(false);
    setAba('peca');
  };

  const fecharTutorial = () => {
    setTutorial(null);
    setSalvo((s) => ({ ...s, configuracoes: { ...s.configuracoes, tutorialVisto: true } }));
  };
  const irPasso = (n: number) => {
    setTutorial(n);
    setAba(PASSOS_TUTORIAL[n].aba as Aba);
  };

  const repetirNoPrograma = (numero: number) => {
    const r = estado.passes[numero - 1];
    if (!r) return;
    const b: Bloco =
      r.tipo === 'tornear'
        ? { id: novoId(), tipo: 'tornear', estacao: r.estacao, params: { ...r.params }, base: { numero, variar: 'n' } }
        : { id: novoId(), tipo: 'furar', estacao: r.estacao, params: { ...r.params }, base: { numero, variar: 'n' } };
    const pos = Math.min(programa.blocos.length, Math.max(programa.cursor, selecionado + 1));
    setPrograma(inserirBloco(programa, b, pos));
    setSelecionado(pos);
    setAba('programa');
  };

  // Ferramenta e previsão mostradas no torno.
  const blocoSel = programa.blocos[selecionado];
  let estacaoVista = estado.estacaoAtiva;
  if (registroAnimado) estacaoVista = registroAnimado.estacao;
  else if (aba === 'programa' && blocoSel && blocoSel.tipo !== 'parada') estacaoVista = blocoSel.estacao;
  const instVista = registroAnimado ? estado.arestas[registroAnimado.arestaNumero - 1] : instanciaNaEstacao(estado, estacaoVista);
  const ferrVista = instVista ? ferramentas[instVista.ferramentaId] : null;

  let previsao: PrevisaoDesenho | null = null;
  if (aba === 'programa' && !ocupado && blocoSel && blocoSel.tipo !== 'parada' && !estado.encerrada && ferrVista) {
    const ef = parametrosDoBloco(blocoSel, estado);
    const refs = referenciasDosBlocos(programa, estado);
    if (ef.tipo === 'tornear' && ferrVista.tipo === 'tornear') {
      const pecaRef = { ...pj.peca, dref: refs[selecionado] };
      const prob = verificarParametros(pecaRef, ef.params, { material, ferramenta: ferrVista as FerramentaTornear, maquina: ctx.maquina });
      if (Number.isFinite(ef.params.ap) && ef.params.L > 0)
        previsao = {
          tipo: 'tornear',
          dref: refs[selecionado],
          dprog: refs[selecionado] - 2 * ef.params.ap,
          ap: ef.params.ap,
          L: Math.min(ef.params.L, pj.peca.balanco),
          valido: prob.length === 0,
        };
    } else if (ef.tipo === 'furar' && ferrVista.tipo === 'broca') {
      const br = ferrVista as Broca;
      const prob = verificarFuracao(pj.peca, ef.params, { material, broca: br, maquina: ctx.maquina });
      const fundo = Math.min(ef.params.P + comprimentoPonta(br), pj.peca.balanco);
      previsao = { tipo: 'furar', d: br.diametro, P: Math.min(ef.params.P, pj.peca.balanco), fundo, valido: prob.length === 0 };
    }
  }

  const abasRef = useRef<(HTMLButtonElement | null)[]>([]);
  const teclaAbas = (e: KeyboardEvent, i: number) => {
    const n = abas.length;
    let j: number | null = null;
    if (e.key === 'ArrowRight') j = (i + 1) % n;
    if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
    if (e.key === 'Home') j = 0;
    if (e.key === 'End') j = n - 1;
    if (j !== null) {
      e.preventDefault();
      setAba(abas[j].id);
      abasRef.current[j]?.focus();
    }
  };
  // Atalhos Alt+1…6 para as teclas de painel.
  useEffect(() => {
    const ouvir = (e: globalThis.KeyboardEvent) => {
      if (!e.altKey) return;
      const k = Number(e.key);
      if (k >= 1 && k <= abas.length) {
        e.preventDefault();
        setAba(abas[k - 1].id);
      }
    };
    window.addEventListener('keydown', ouvir);
    return () => window.removeEventListener('keydown', ouvir);
  }, [abas]);

  const custos = calcularCustos(estado);
  const est = estoqueRestante(estado);
  const instAtiva = instanciaNaEstacao(estado, estado.estacaoAtiva);
  const ferrAtiva = instAtiva ? ferramentas[instAtiva.ferramentaId] : null;

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="marca">
          <h1>USINAGEM</h1>
          <span className="subtitulo">
            {ctx.maquina.nome} · {modo === 'encomenda' ? `Encomenda ${ctx.encomenda.codigo} — ${ctx.encomenda.titulo}` : 'Modo livre'}
          </span>
        </div>
        <div className="segmentado" role="radiogroup" aria-label="Modo de jogo">
          {(['encomenda', 'laboratorio'] as Modo[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={modo === m} className={modo === m ? 'ativo' : ''} onClick={() => trocarModo(m)} disabled={ocupado}>
              {m === 'encomenda' ? 'Encomenda' : 'Modo livre'}
            </button>
          ))}
        </div>
        <div className="acoes-cabecalho">
          <button type="button" className="selo-modelo" onClick={() => setSobre(true)}>
            modelo didático · limitações
          </button>
          <button type="button" className="botao" onClick={() => irPasso(0)}>
            Tutorial
          </button>
          <button type="button" className="botao" onClick={() => setConfirmar(true)} disabled={ocupado}>
            ↺ Reiniciar
          </button>
        </div>
      </header>

      <div className="faixa-status" aria-label="Situação">
        <span>
          Peça <strong>{pj.numero}</strong> ({material.nome}, Ø {num(pj.peca.diametroBruto, 0)}):{' '}
          {pj.bloqueio ? '✕ inutilizada' : pj.estado === 'refugo' ? '✕ refugo' : pj.estado === 'entregue' ? '✓ entregue' : 'em usinagem'}
        </span>
        <span>
          Ativa <strong>T{String(estado.estacaoAtiva).padStart(2, '0')}</strong> {ferrAtiva?.codigo ?? '—'}
          {instAtiva && ferrAtiva ? `: VB ≈ ${num(vbDeDano(instAtiva.estado.dano, ferrAtiva), 2)} mm` : ''}
        </span>
        <span>Tempo {num(tempoTotal(estado.tempos), 2)} min</span>
        <span>
          Custo {num(custos.total, 1)} u.c.{modo === 'encomenda' ? ` / ${num(ctx.encomenda.modoEncomenda.orcamento, 0)}` : ''}
        </span>
        {est && (
          <span>
            Reserva: {est.tarugos} tarugo(s), {est.arestas} aresta(s)
          </span>
        )}
        <span>Operações: {estado.passes.length}</span>
      </div>

      <main className="principal">
        <PainelMaquina
          peca={pj.peca}
          material={material}
          ferramenta={ferrVista}
          estacao={estacaoVista}
          registro={registroAnimado}
          execucao={registroAnimado ? execucao : -1}
          previsao={previsao}
          velocidade={salvo.configuracoes.velocidade}
          onVelocidade={(v) => setSalvo((s) => ({ ...s, configuracoes: { ...s.configuracoes, velocidade: v } }))}
          onFim={fimDaAnimacao}
          ciclo={{ executando, blocoABloco, cursor: programa.cursor, total: programa.blocos.length, alarme, mensagem }}
          onCicloInicio={cicloInicio}
          onReset={resetar}
          onBlocoABloco={setBlocoABloco}
          aproximacao={ctx.maquina.aproximacao}
          pontos={modo === 'encomenda' ? ctx.encomenda.pontosMedicao : []}
          ressalto={modo === 'encomenda' ? ctx.encomenda.requisitos.comprimento.nominal : null}
          aviso={pj.bloqueio ? 'BROCA QUEBRADA PRESA NA PEÇA' : pj.estado === 'refugo' ? 'PEÇA REFUGADA (material removido não volta)' : null}
        />

        <section className="painel" aria-label="Painéis">
          <div className="painel-rolagem" role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} tabIndex={0}>
            {aba === 'programa' && (
              <PainelPrograma
                ctx={ctx}
                estado={estado}
                programa={programa}
                setPrograma={setPrograma}
                selecionado={Math.min(selecionado, Math.max(0, programa.blocos.length - 1))}
                setSelecionado={setSelecionado}
                ocupado={ocupado || executando}
                onExecutarBloco={(i) => executarBloco(i, true)}
              />
            )}
            {aba === 'ferramentas' && <PainelFerramentas ctx={ctx} estado={estado} despachar={despachar} ocupado={ocupado || executando} />}
            {aba === 'peca' && <PainelPeca ctx={ctx} estado={estado} despachar={despachar} ocupado={ocupado || executando} />}
            {aba === 'medicao' && <PainelMedicao ctx={ctx} estado={estado} despachar={despachar} ocupado={ocupado} />}
            {aba === 'historico' && <PainelHistorico estado={estado} despachar={despachar} ocupado={ocupado || executando} onRepetirNoPrograma={repetirNoPrograma} />}
            {aba === 'entrega' && modo === 'encomenda' && (
              <PainelEntregar ctx={ctx} estado={estado} despachar={despachar} animando={ocupado || executando} onReiniciar={() => setConfirmar(true)} />
            )}
          </div>
          <nav className="softkeys" role="tablist" aria-label="Teclas de painel (Alt+1 a Alt+6)">
            {abas.map((a, i) => (
              <button
                key={a.id}
                ref={(el) => {
                  abasRef.current[i] = el;
                }}
                role="tab"
                id={`aba-${a.id}`}
                aria-selected={aba === a.id}
                aria-controls={`painel-${a.id}`}
                tabIndex={aba === a.id ? 0 : -1}
                className={aba === a.id ? 'ativa' : ''}
                onClick={() => setAba(a.id)}
                onKeyDown={(e) => teclaAbas(e, i)}
              >
                <span className="softkey-n">F{i + 1}</span>
                {a.rotulo}
              </button>
            ))}
          </nav>
        </section>
      </main>

      {tutorial !== null && <Tutorial passo={tutorial} onPasso={irPasso} onFechar={fecharTutorial} />}

      <Dialogo titulo="Sobre o modelo didático" aberto={sobre} onFechar={() => setSobre(false)}>
        <SobreModelo />
      </Dialogo>
      <Dialogo titulo="Reiniciar a partida?" aberto={confirmar} onFechar={() => setConfirmar(false)}>
        <p>
          Isto apaga as operações do modo <strong>{modo === 'encomenda' ? 'Encomenda' : 'Livre'}</strong> salvas neste navegador. O programa continua, com o cursor no
          início. O outro modo e as configurações não mudam.
        </p>
        <div className="acoes">
          <button type="button" className="botao" onClick={() => setConfirmar(false)}>
            Cancelar
          </button>
          <button type="button" className="botao primario" onClick={reiniciar}>
            Reiniciar
          </button>
        </div>
      </Dialogo>
    </div>
  );
}
