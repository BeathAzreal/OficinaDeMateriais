import { useEffect, useState, type ReactNode } from 'react';
import type { Qualidade } from '../../casos/tipos';
import type { Custo, Limitacao } from '../../motor/tipos';
import { formatarHoras, formatarReais } from '../../motor/recursos';
import { useJogo } from '../contexto';

export function Dicas({ estacao }: { estacao: keyof ReturnType<typeof useJogo>['caso']['publico']['dicas'] }) {
  const { caso, estado } = useJogo();
  const [aberto, setAberto] = useState(true);
  if (estado.modo !== 'aprender') return null;
  const dicas = caso.publico.dicas[estacao];
  return (
    <aside className="dicas" aria-label="Dicas do modo Aprender">
      <button className="dicas-titulo" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <span aria-hidden>💡</span> Antes de decidir {aberto ? '▾' : '▸'}
      </button>
      {aberto && (
        <ul>
          {dicas.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </aside>
  );
}

const ICONE_SEV = { info: 'ℹ', atencao: '▲', grave: '✖' } as const;
const NOME_SEV = { info: 'Informação', atencao: 'Atenção', grave: 'Limitação grave' } as const;

export function ListaLimitacoes({ limitacoes, titulo = 'Limitações deste resultado' }: { limitacoes: Limitacao[]; titulo?: string }) {
  const { estado } = useJogo();
  if (limitacoes.length === 0) return null;
  const explicar = estado.modo === 'aprender' || estado.concluido;
  return (
    <div className="limitacoes">
      <h4>{titulo}</h4>
      <ul>
        {limitacoes.map((l) => (
          <li key={l.id} className={`sev-${l.severidade}`}>
            <span className="sev-icone" aria-label={NOME_SEV[l.severidade]} title={NOME_SEV[l.severidade]}>
              {ICONE_SEV[l.severidade]}
            </span>
            <div>
              <span>{l.texto}</span>
              {explicar && <small className="explicacao">{l.explicacao}</small>}
            </div>
          </li>
        ))}
      </ul>
      {!explicar && <p className="nota-modo">No modo Desafio, as explicações aparecem na devolutiva.</p>}
    </div>
  );
}

const NOME_Q: Record<Qualidade, string> = { nitida: 'nítida', tenue: 'tênue', comprometida: 'comprometida' };
const ICONE_Q: Record<Qualidade, string> = { nitida: '●', tenue: '◐', comprometida: '○' };

export function SeloQualidade({ q }: { q: Qualidade }) {
  return (
    <span className={`selo-q q-${q}`} title={`Qualidade do dado: ${NOME_Q[q]}`}>
      {ICONE_Q[q]} {NOME_Q[q]}
    </span>
  );
}

export function Preco({ custo }: { custo: Custo }) {
  return (
    <span className="preco">
      R$ {formatarReais(custo.reais)} · {formatarHoras(custo.horas)}
    </span>
  );
}

/** Botão que pede confirmação inline antes de executar uma ação irreversível. */
export function BotaoConfirmar({
  children,
  aviso,
  onConfirmar,
  classe = 'botao',
  desativado,
}: {
  children: ReactNode;
  aviso: string;
  onConfirmar: () => void;
  classe?: string;
  desativado?: boolean;
}) {
  const [pedindo, setPedindo] = useState(false);
  if (!pedindo) {
    return (
      <button className={classe} onClick={() => setPedindo(true)} disabled={desativado}>
        {children}
      </button>
    );
  }
  return (
    <span className="confirmacao" role="alert">
      <span>{aviso}</span>
      <button
        className="botao primario"
        onClick={() => {
          setPedindo(false);
          onConfirmar();
        }}
      >
        Confirmar
      </button>
      <button className="botao" onClick={() => setPedindo(false)}>
        Cancelar
      </button>
    </span>
  );
}

export function Modal({ titulo, onFechar, children, largo }: { titulo: string; onFechar: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onFechar]);
  return (
    <div className="modal-fundo" onClick={onFechar}>
      <div className={`modal ${largo ? 'largo' : ''}`} role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header>
          <h3>{titulo}</h3>
          <button className="botao fantasma" onClick={onFechar} aria-label="Fechar">
            ✕
          </button>
        </header>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}

export function CartaoEstacao({
  titulo,
  finalidade,
  informacao,
  custos,
}: {
  titulo: string;
  finalidade: string;
  informacao: string;
  custos: { item: string; custo: Custo }[];
}) {
  return (
    <section className="cartao-estacao">
      <div>
        <h2>{titulo}</h2>
        <p>
          <strong>Finalidade:</strong> {finalidade}
        </p>
        <p>
          <strong>Tipo de informação:</strong> {informacao}
        </p>
      </div>
      <table className="tabela-custos">
        <caption>Custo e tempo</caption>
        <tbody>
          {custos.map((c) => (
            <tr key={c.item}>
              <td>{c.item}</td>
              <td>
                <Preco custo={c.custo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
