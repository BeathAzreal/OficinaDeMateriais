import { useState } from 'react';
import type { Aquisicao, Evidencia } from '../motor/tipos';
import { atualizarEvidencia, definirVinculo, removerEvidencia } from '../motor/estado';
import { grupoPorId } from '../motor/interpretacoes';
import { formatarHoras, formatarReais, gastoTotal } from '../motor/recursos';
import { useJogo } from './contexto';
import { Modal, SeloQualidade } from './componentes/comuns';
import { Miniatura, SeletorVinculo, VisorAquisicao, ICONE_VINCULO } from './componentes/VisorAquisicao';
import { GraficoDureza } from './componentes/Microdureza';

type Aba = 'resultados' | 'evidencias' | 'matriz' | 'comparar' | 'gastos';

const NOME_TIPO: Record<Aquisicao['tipo'], string> = {
  visual: 'Inspeção visual',
  micrografia: 'Micrografias',
  microdureza: 'Perfis de microdureza',
  documento: 'Documentos',
};

export function Caderno({ onFechar }: { onFechar: () => void }) {
  const { estado } = useJogo();
  const [aba, setAba] = useState<Aba>('resultados');
  const [aberto, setAberto] = useState<string | null>(null);
  const aq = estado.aquisicoes.find((a) => a.id === aberto);
  return (
    <aside className="caderno" aria-label="Caderno de investigação">
      <header>
        <h2>📓 Caderno</h2>
        <button className="botao fantasma" onClick={onFechar} aria-label="Recolher caderno">
          ⇥
        </button>
      </header>
      <nav className="abas-caderno">
        {(
          [
            ['resultados', `Resultados (${estado.aquisicoes.length})`],
            ['evidencias', `Evidências (${estado.evidencias.length})`],
            ['matriz', 'Matriz'],
            ['comparar', 'Comparar'],
            ['gastos', 'Gastos'],
          ] as [Aba, string][]
        ).map(([id, rot]) => (
          <button key={id} className={aba === id ? 'ativa' : ''} onClick={() => setAba(id)}>
            {rot}
          </button>
        ))}
      </nav>
      <div className="conteudo-caderno">
        {aba === 'resultados' && <Resultados onAbrir={setAberto} />}
        {aba === 'evidencias' && <Evidencias onAbrir={setAberto} />}
        {aba === 'matriz' && <Matriz />}
        {aba === 'comparar' && <Comparar />}
        {aba === 'gastos' && <Gastos />}
      </div>
      {aq && (
        <Modal titulo={`Resultado ${aq.id}`} onFechar={() => setAberto(null)} largo>
          <VisorAquisicao aq={aq} />
        </Modal>
      )}
    </aside>
  );
}

function Resultados({ onAbrir }: { onAbrir: (id: string) => void }) {
  const { estado } = useJogo();
  if (estado.aquisicoes.length === 0) return <p className="vazio">Os resultados obtidos aparecem aqui, com amostra e parâmetros.</p>;
  const tipos: Aquisicao['tipo'][] = ['visual', 'micrografia', 'microdureza', 'documento'];
  return (
    <div>
      {tipos.map((t) => {
        const lista = estado.aquisicoes.filter((a) => a.tipo === t);
        if (lista.length === 0) return null;
        return (
          <section key={t}>
            <h3>{NOME_TIPO[t]}</h3>
            <ul className="lista-resultados">
              {lista.map((a) => {
                const nEv = estado.evidencias.filter((e) => e.aquisicaoId === a.id).length;
                const graves = a.limitacoes.filter((l) => l.severidade === 'grave').length;
                return (
                  <li key={a.id}>
                    <button className="item-resultado" onClick={() => onAbrir(a.id)}>
                      <Miniatura aq={a} />
                      <span>
                        <strong>{a.id}</strong> {graves > 0 && <span className="sev-grave" title="Limitação grave">✖</span>}
                        <small>{a.rotulo}</small>
                        {nEv > 0 && <small>{nEv} evidência(s) registrada(s)</small>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Evidencias({ onAbrir }: { onAbrir: (id: string) => void }) {
  const { caso, estado } = useJogo();
  const [filtro, setFiltro] = useState<string>('');
  if (estado.evidencias.length === 0) {
    return <p className="vazio">Registre observações a partir dos resultados ("Registrar no caderno").</p>;
  }
  const lista = filtro ? estado.evidencias.filter((e) => e.vinculos[filtro]) : estado.evidencias;
  return (
    <div>
      <label className="rotulo">
        Filtrar por hipótese
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">(todas)</option>
          {caso.publico.hipoteses.map((h) => (
            <option key={h.id} value={h.id}>
              {h.titulo}
            </option>
          ))}
        </select>
      </label>
      {lista.map((e) => (
        <CartaoEvidencia key={e.id} ev={e} onAbrir={onAbrir} />
      ))}
    </div>
  );
}

function CartaoEvidencia({ ev, onAbrir }: { ev: Evidencia; onAbrir: (id: string) => void }) {
  const { caso, estado, alterar } = useJogo();
  const [expandida, setExpandida] = useState(false);
  const grupo = grupoPorId(caso, ev.grupo);
  const travado = estado.concluido;
  const hips = caso.publico.hipoteses.filter((h) => estado.hipoteses[h.id]?.selecionada || ev.vinculos[h.id]);
  return (
    <article className="cartao-evidencia">
      <header>
        <strong>{ev.id}</strong> {ev.qualidade !== 'nitida' && <SeloQualidade q={ev.qualidade} />}
        <button className="link" onClick={() => onAbrir(ev.aquisicaoId)}>
          ver {ev.aquisicaoId}
        </button>
      </header>
      <p className="obs">
        <span className="rotulo-mini">Observação</span> {ev.observacao}
      </p>
      <p className="origem">{ev.origem}</p>
      {grupo && (
        <label className="rotulo-mini">
          Interpretação
          <select value={ev.interpretacaoId ?? ''} disabled={travado} onChange={(e) => alterar((s) => atualizarEvidencia(s, ev.id, { interpretacaoId: e.target.value || undefined }))}>
            <option value="">(sem interpretação)</option>
            {grupo.opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.texto}
              </option>
            ))}
          </select>
        </label>
      )}
      {ev.nota && <p className="nota">📝 {ev.nota}</p>}
      <div className="vinculos-resumo">
        {Object.entries(ev.vinculos).map(([h, v]) => (
          <span key={h} className={`vinc vinc-${v}`}>
            {ICONE_VINCULO[v]} {caso.publico.hipoteses.find((x) => x.id === h)?.titulo}
          </span>
        ))}
      </div>
      {!travado && (
        <>
          <button className="link" onClick={() => setExpandida(!expandida)}>
            {expandida ? 'Fechar associações' : 'Associar a hipóteses'}
          </button>
          {expandida && (
            <table className="tabela-vinculos compacta">
              <tbody>
                {(hips.length ? hips : caso.publico.hipoteses).map((h) => (
                  <tr key={h.id}>
                    <td>{h.titulo}</td>
                    <td>
                      <SeletorVinculo valor={ev.vinculos[h.id]} onMudar={(v) => alterar((s) => definirVinculo(s, ev.id, h.id, v))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button className="link perigo" onClick={() => alterar((s) => removerEvidencia(s, ev.id))}>
            Remover do caderno
          </button>
        </>
      )}
    </article>
  );
}

function Matriz() {
  const { caso, estado } = useJogo();
  const hips = caso.publico.hipoteses.filter((h) => estado.hipoteses[h.id]?.selecionada || estado.evidencias.some((e) => e.vinculos[h.id]));
  if (hips.length === 0) return <p className="vazio">Selecione hipóteses e associe evidências para ver a matriz.</p>;
  return (
    <table className="matriz">
      <thead>
        <tr>
          <th>Hipótese</th>
          <th title="apoia">＋</th>
          <th title="enfraquece">－</th>
          <th title="inconclusiva">？</th>
        </tr>
      </thead>
      <tbody>
        {hips.map((h) => {
          const por = (v: string) => estado.evidencias.filter((e) => e.vinculos[h.id] === v).map((e) => e.id);
          return (
            <tr key={h.id}>
              <td>
                <span className={`cat cat-${h.categoria}`}>{h.categoria}</span> {h.titulo}
              </td>
              {['apoia', 'enfraquece', 'inconclusiva'].map((v) => (
                <td key={v} title={por(v).join(', ')}>
                  {por(v).length || '·'}
                  {por(v).length > 0 && <small>{por(v).join(' ')}</small>}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Comparar() {
  const { estado } = useJogo();
  const opcoes = estado.aquisicoes.filter((a) => a.tipo !== 'documento');
  const [a, setA] = useState<string>(opcoes[0]?.id ?? '');
  const [b, setB] = useState<string>(opcoes[1]?.id ?? '');
  if (opcoes.length < 2) return <p className="vazio">São necessários dois resultados para comparar.</p>;
  const A = opcoes.find((x) => x.id === a);
  const B = opcoes.find((x) => x.id === b);
  const perfis = [A, B].filter((x): x is Extract<Aquisicao, { tipo: 'microdureza' }> => x?.tipo === 'microdureza');
  return (
    <div className="comparar">
      <div className="seletores">
        {[
          [a, setA],
          [b, setB],
        ].map(([val, set], k) => (
          <select key={k} value={val as string} onChange={(e) => (set as (s: string) => void)(e.target.value)}>
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.id} — {o.rotulo.slice(0, 60)}
              </option>
            ))}
          </select>
        ))}
      </div>
      {perfis.length === 2 ? (
        <GraficoDureza
          series={perfis.map((p) => ({
            rotulo: `${p.id} (${p.carga.replace('.', ',')})`,
            carga: p.carga,
            pontos: p.pontos,
            eixo: estado.amostras.find((x) => x.id === p.amostraId)?.orientacao === 'longitudinal' ? 'y' : 'x',
          }))}
        />
      ) : (
        <div className="lado-a-lado">
          {[A, B].map(
            (x, k) =>
              x && (
                <figure key={k}>
                  <Miniatura aq={x} />
                  <figcaption>
                    <strong>{x.id}</strong> {x.rotulo}
                    <ul>
                      {x.achados
                        .filter((y) => y.modo === 'campo' || x.encontrados.includes(y.chave))
                        .map((y) => (
                          <li key={y.chave}>{y.observacao}</li>
                        ))}
                    </ul>
                  </figcaption>
                </figure>
              ),
          )}
        </div>
      )}
    </div>
  );
}

function Gastos() {
  const { caso, estado } = useJogo();
  const t = gastoTotal(estado);
  return (
    <div>
      <p>
        Total: <strong>R$ {formatarReais(t.reais)}</strong> de R$ {formatarReais(caso.publico.recursos.orcamento)} ·{' '}
        <strong>{formatarHoras(t.horas)}</strong> de {caso.publico.recursos.tempoH} h
      </p>
      <ol className="lista-gastos">
        {estado.gastos.map((g) => (
          <li key={g.id}>
            <span>{g.descricao}</span>
            <small>
              R$ {formatarReais(g.custo.reais)} · {formatarHoras(g.custo.horas)}
            </small>
          </li>
        ))}
      </ol>
    </div>
  );
}
