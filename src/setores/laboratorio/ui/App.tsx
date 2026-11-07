import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CASOS, casoPorId } from '../casos';
import type { Aba, EstadoJogo, Modo, Resultado } from '../motor/tipos';
import { definirTutorial, irPara, novoJogo } from '../motor/estado';
import { apagarPartida, carregarPartida, salvarPartida } from '../motor/persistencia';
import { formatarHoras, formatarReais, saldo } from '../motor/recursos';
import { ContextoJogo, useJogo, type Jogo } from './contexto';
import { Bancada } from './Bancada';
import { Hipoteses } from './Hipoteses';
import { Ensaios, type Estacao } from './Ensaios';
import { Caderno } from './Caderno';
import { Relatorio } from './Relatorio';
import { Devolutiva } from './Devolutiva';
import { BotaoConfirmar } from './componentes/comuns';
import { avaliar, type ResultadoAvaliacao } from '../avaliacao/avaliar';

/** v2.2 (fábrica): avisado quando o relatório é enviado e a devolutiva abre. */
export interface PropsLaboratorio {
  aoConcluir?: (r: { casoId: string; avaliacao: ResultadoAvaliacao }) => void;
  /** v2.2: os ensaios são feitos na bancada 3D; o escritório mostra só o raciocínio. */
  semEnsaios?: boolean;
}

export function App({ aoConcluir, semEnsaios }: PropsLaboratorio) {
  const [estado, setEstado] = useState<EstadoJogo | null>(() => carregarPartida());
  const ref = useRef(estado);
  ref.current = estado;
  const [aviso, setAviso] = useState<{ texto: string; tipo: 'erro' | 'ok'; n: number } | null>(null);
  const [cadernoAberto, setCadernoAberto] = useState(true);
  const [estacao, setEstacao] = useState<Estacao>('visual');
  const [superficieInicial, setSuperficieInicial] = useState<string | undefined>();
  const [resultado, setResultado] = useState<string | null>(null);

  useEffect(() => {
    if (estado) salvarPartida(estado);
  }, [estado]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.tipo === 'erro' ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const avisar = useCallback((texto: string, tipo: 'erro' | 'ok' = 'erro') => setAviso({ texto, tipo, n: Date.now() }), []);

  const caso = estado ? casoPorId(estado.casoId) : undefined;
  const jaConcluido = useRef(!!estado?.concluido);
  useEffect(() => {
    const feito = !!estado?.concluido;
    if (feito && !jaConcluido.current && estado && caso) aoConcluir?.({ casoId: estado.casoId, avaliacao: avaliar(caso, estado) });
    jaConcluido.current = feito;
  }, [estado, caso, aoConcluir]);

  const jogo: Jogo | null = useMemo(() => {
    if (!estado || !caso) return null;
    return {
      caso,
      estado,
      executar: (acao: (e: EstadoJogo) => Resultado) => {
        const atual = ref.current;
        if (!atual) return false;
        const r = acao(atual);
        if (!r.ok) {
          avisar(r.erro);
          return false;
        }
        ref.current = r.estado;
        setEstado(r.estado);
        return r.novoId;
      },
      alterar: (f) => {
        const atual = ref.current;
        if (!atual) return;
        const novo = f(atual);
        ref.current = novo;
        setEstado(novo);
      },
      avisar,
      selecionarResultado: setResultado,
      resultadoSelecionado: resultado,
    };
  }, [estado, caso, avisar, resultado]);

  const reiniciar = () => {
    if (estado) apagarPartida(estado.casoId);
    setEstado(null);
    setResultado(null);
  };

  if (!jogo) return <TelaInicial onIniciar={(modo) => setEstado(novoJogo(CASOS[0], modo))} />;

  const { caso: c, estado: e } = jogo;
  const s = saldo(e, c.publico.recursos);
  const abas: [Aba, string][] = [
    ['bancada', '1 · Bancada'],
    ['hipoteses', '2 · Hipóteses'],
    ['ensaios', '3 · Ensaios'],
    ['relatorio', '4 · Relatório'],
  ].filter(([a]) => !(semEnsaios && a === 'ensaios')) as [Aba, string][];
  if (e.concluido) abas.push(['devolutiva', '★ Devolutiva']);
  const irAba = (a: Aba) => jogo.alterar((x) => irPara(x, a));

  return (
    <ContextoJogo.Provider value={jogo}>
      <div className="app">
        <header className="topo">
          <div className="marca">
            <span className="logo" aria-hidden>
              ⚗
            </span>
            <div>
              <h1>Laboratório de Falhas</h1>
              <small>
                Caso: {c.publico.titulo} · <span className="etiqueta">dados sintéticos</span> <span className="etiqueta">imagens esquemáticas</span>
              </small>
            </div>
          </div>
          <div className="recursos" aria-label="Recursos restantes">
            <Medidor rotulo="Orçamento" valor={s.reais} total={c.publico.recursos.orcamento} texto={`R$ ${formatarReais(s.reais)}`} />
            <Medidor rotulo="Tempo" valor={s.horas} total={c.publico.recursos.tempoH} texto={formatarHoras(Math.max(0, s.horas))} />
          </div>
          <div className="acoes-topo">
            <span className={`modo modo-${e.modo}`}>{e.modo === 'aprender' ? 'Modo Aprender' : 'Modo Desafio'}</span>
            <button className="botao" onClick={() => jogo.alterar((x) => definirTutorial(x, 0))}>
              Tutorial
            </button>
            <button className="botao" onClick={() => setCadernoAberto(!cadernoAberto)} aria-pressed={cadernoAberto}>
              📓 Caderno
            </button>
            <BotaoConfirmar aviso="Apagar todo o progresso deste caso?" onConfirmar={reiniciar}>
              Reiniciar
            </BotaoConfirmar>
          </div>
        </header>
        <nav className="abas" aria-label="Etapas da investigação">
          {abas.map(([id, rot]) => (
            <button key={id} className={e.aba === id ? 'ativa' : ''} onClick={() => irAba(id)}>
              {rot}
            </button>
          ))}
        </nav>
        <div className={`corpo ${cadernoAberto ? 'com-caderno' : ''}`}>
          <main className="principal">
            {e.aba === 'bancada' && (
              <Bancada
                onExaminar={(sup) => {
                  setSuperficieInicial(sup);
                  setEstacao('visual');
                  irAba('ensaios');
                }}
              />
            )}
            {e.aba === 'hipoteses' && <Hipoteses />}
            {e.aba === 'ensaios' && <Ensaios estacao={estacao} onEstacao={setEstacao} superficieInicial={superficieInicial} />}
            {e.aba === 'relatorio' && <Relatorio />}
            {e.aba === 'devolutiva' && e.concluido && <Devolutiva onReiniciar={reiniciar} />}
          </main>
          {cadernoAberto && <Caderno onFechar={() => setCadernoAberto(false)} />}
        </div>
        {aviso && (
          <div key={aviso.n} className={`aviso aviso-${aviso.tipo}`} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>
            {aviso.tipo === 'erro' ? '⚠ ' : '✓ '}
            {aviso.texto}
          </div>
        )}
        {e.tutorialPasso !== null && <Tutorial />}
      </div>
    </ContextoJogo.Provider>
  );
}

function Medidor({ rotulo, valor, total, texto }: { rotulo: string; valor: number; total: number; texto: string }) {
  const frac = Math.max(0, Math.min(1, valor / total));
  return (
    <div className={`medidor ${frac < 0.15 ? 'baixo' : ''}`}>
      <span>
        {rotulo}: <strong>{texto}</strong> restantes
      </span>
      <div className="barra" role="meter" aria-label={rotulo} aria-valuenow={Math.round(frac * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${frac * 100}%` }} />
      </div>
    </div>
  );
}

function Tutorial() {
  const j = useJogo();
  const passos = j.caso.publico.tutorial;
  const i = j.estado.tutorialPasso ?? 0;
  const p = passos[i];
  useEffect(() => {
    if (p?.aba) j.alterar((x) => irPara(x, p.aba!));
  }, [i]);
  if (!p) return null;
  const ir = (n: number | null) => j.alterar((x) => definirTutorial(x, n));
  return (
    <div className="tutorial" role="dialog" aria-label="Tutorial">
      <div className="tutorial-cartao">
        <small>
          Tutorial · {i + 1} de {passos.length}
        </small>
        <h3>{p.titulo}</h3>
        <p>{p.texto}</p>
        <footer>
          <button className="botao fantasma" onClick={() => ir(null)}>
            Pular tutorial
          </button>
          <span>
            {i > 0 && (
              <button className="botao" onClick={() => ir(i - 1)}>
                Anterior
              </button>
            )}
            <button className="botao primario" onClick={() => ir(i + 1 < passos.length ? i + 1 : null)}>
              {i + 1 < passos.length ? 'Próximo' : 'Começar'}
            </button>
          </span>
        </footer>
      </div>
    </div>
  );
}


function TelaInicial({ onIniciar }: { onIniciar: (m: Modo) => void }) {
  const caso = CASOS[0];
  return (
    <div className="tela-inicial">
      <div className="cartao-inicial">
        <span className="logo grande" aria-hidden>
          ⚗
        </span>
        <h1>Laboratório de Falhas</h1>
        <p className="subtitulo">Investigação de falhas em materiais — protótipo didático</p>
        <div className="caso-inicial">
          <h2>Caso 1: {caso.publico.titulo}</h2>
          <p>{caso.publico.subtitulo}</p>
        </div>
        <p>
          Você recebe uma peça que falhou, investiga o histórico, formula hipóteses e escolhe onde amostrar, como preparar e que ensaios fazer. O
          orçamento e o tempo são limitados, e cada escolha muda a utilidade dos dados.
        </p>
        <p className="aviso-didatico">
          As imagens são <strong>esquemáticas</strong> e os dados são <strong>sintéticos</strong>. A atividade desenvolve raciocínio de investigação
          (processamento → estrutura → propriedades → desempenho) e <strong>não certifica competência prática</strong> de laboratório.
        </p>
        <div className="escolha-modo">
          <button className="modo-cartao" onClick={() => onIniciar('aprender')}>
            <strong>Aprender</strong>
            <span>Dicas antes das decisões e explicações das limitações durante a investigação.</span>
          </button>
          <button className="modo-cartao" onClick={() => onIniciar('desafio')}>
            <strong>Desafio</strong>
            <span>Menos orientação; as explicações completas aparecem só na devolutiva.</span>
          </button>
        </div>
        <p className="nota-modo">O progresso fica salvo neste navegador.</p>
      </div>
    </div>
  );
}
