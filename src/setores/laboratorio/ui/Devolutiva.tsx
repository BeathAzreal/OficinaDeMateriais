import { useMemo } from 'react';
import { avaliar, gabaritoAchado, INSUFICIENTE } from '../avaliacao/avaliar';
import { grupoPorId } from '../motor/interpretacoes';
import type { Limitacao } from '../motor/tipos';
import { useJogo } from './contexto';

export function Devolutiva({ onReiniciar }: { onReiniciar: () => void }) {
  const { caso, estado } = useJogo();
  const res = useMemo(() => avaliar(caso, estado), [caso, estado]);
  const gab = caso.gabarito;
  const r = estado.relatorio;
  const nome = (id: string | null) => (id === INSUFICIENTE ? 'Dados insuficientes' : caso.publico.hipoteses.find((h) => h.id === id)?.titulo ?? '—');
  const coletados = new Set(res.coletados);
  const citados = new Set(estado.evidencias.filter((e) => r.evidencias.includes(e.id)).map((e) => e.achadoId));
  const limitacoes = new Map<string, Limitacao>();
  for (const a of estado.aquisicoes) for (const l of a.limitacoes) if (l.severidade !== 'info') limitacoes.set(l.id, l);
  for (const p of estado.preparos) for (const l of p.limitacoes) if (l.severidade !== 'info') limitacoes.set(l.id, l);

  return (
    <div className="devolutiva">
      <header className="cabecalho-pagina">
        <h2>Devolutiva</h2>
        <p className="aviso-didatico">
          Dados sintéticos e imagens esquemáticas. A nota avalia o raciocínio de investigação neste exercício; não certifica competência prática de
          laboratório.
        </p>
      </header>

      <section className="painel nota-geral">
        <div className="nota-total" aria-label={`Nota total ${res.total} de 100`}>
          <span>{res.total}</span>
          <small>/ 100</small>
        </div>
        <div className="dimensoes">
          {res.dimensoes.map((d) => (
            <div key={d.id} className="dimensao">
              <div className="dim-cabecalho">
                <strong>{d.nome}</strong>
                <span>
                  {d.nota}/100 · peso {Math.round(d.peso * 100)}%
                </span>
              </div>
              <div className="barra" role="meter" aria-valuenow={d.nota} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${d.nota}%` }} />
              </div>
              <ul>
                {d.positivos.map((t) => (
                  <li key={t} className="positivo">
                    ✓ {t}
                  </li>
                ))}
                {d.melhorar.map((t) => (
                  <li key={t} className="melhorar">
                    → {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="painel">
        <h3>O que aconteceu com a peça</h3>
        {gab.resumo.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <table className="comparacao">
          <thead>
            <tr>
              <th></th>
              <th>Seu relatório</th>
              <th>Caso</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Mecanismo</td>
              <td className={r.mecanismo === gab.mecanismo.correta ? 'certo' : 'errado'}>{nome(r.mecanismo)}</td>
              <td>
                {nome(gab.mecanismo.correta)}
                <small>{gab.mecanismo.explicacao}</small>
              </td>
            </tr>
            <tr>
              <td>Causa provável</td>
              <td className={r.causa === gab.causa.correta ? 'certo' : 'errado'}>{nome(r.causa)}</td>
              <td>
                {nome(gab.causa.correta)}
                <small>{gab.causa.explicacao}</small>
              </td>
            </tr>
            {Object.entries(gab.fatores).map(([id, f]) => {
              const marcou = r.fatores.includes(id);
              return (
                <tr key={id}>
                  <td>Fator: {nome(id)}</td>
                  <td className={marcou === f.verdadeiro ? 'certo' : 'errado'}>{marcou ? 'indicado' : 'não indicado'}</td>
                  <td>
                    {f.verdadeiro ? 'contribuiu' : 'não contribuiu'}
                    <small>{f.explicacao}</small>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="painel">
        <h3>Cadeia de evidências</h3>
        <p className="ajuda">● obtido e citado no relatório · ◐ obtido, mas não citado · ○ não obtido</p>
        {gab.cadeia.map((elo) => (
          <div key={elo.titulo} className="elo">
            <h4>{elo.titulo}</h4>
            <p>{elo.texto}</p>
            <ul>
              {elo.achados.map((a) => {
                const g = gabaritoAchado(caso, a);
                const st = citados.has(a) ? '●' : coletados.has(a) ? '◐' : '○';
                return (
                  <li key={a}>
                    <span className="status-elo" aria-label={st === '●' ? 'obtido e citado' : st === '◐' ? 'obtido' : 'não obtido'}>
                      {st}
                    </span>
                    <span>
                      {g?.explicacao}
                      <small>Como obter: {g?.comoObter}</small>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <section className="painel">
        <h3>Hipóteses alternativas</h3>
        <ul className="alternativas">
          {caso.publico.hipoteses
            .filter((h) => !gab.hipoteses[h.id]?.verdadeira)
            .map((h) => (
              <li key={h.id}>
                <strong>{h.titulo}</strong> — sua avaliação: <em>{r.alternativas[h.id] ?? (r.mecanismo === h.id || r.causa === h.id || r.fatores.includes(h.id) ? 'escolhida' : 'não avaliada')}</em>
                <p>{gab.hipoteses[h.id]?.explicacao}</p>
              </li>
            ))}
        </ul>
      </section>

      <section className="painel">
        <h3>Revisão das suas evidências</h3>
        {estado.evidencias.length === 0 && <p className="vazio">Nenhuma evidência registrada.</p>}
        <ul className="revisao-evidencias">
          {estado.evidencias.map((e) => {
            const g = gabaritoAchado(caso, e.achadoId);
            const av = res.porEvidencia[e.id];
            const grupo = grupoPorId(caso, e.grupo);
            const sua = grupo?.opcoes.find((o) => o.id === e.interpretacaoId)?.texto;
            const esperadas = grupo?.opcoes.filter((o) => g?.corretas?.includes(o.id)).map((o) => o.texto);
            return (
              <li key={e.id} className={`rev rev-${av?.interpretacao}`}>
                <header>
                  <strong>{e.id}</strong> {g?.artefato && <span className="etiqueta alerta">artefato de preparação</span>}
                  {r.evidencias.includes(e.id) && <span className="etiqueta">citada no relatório</span>}
                </header>
                <p>{e.observacao}</p>
                <small>{e.origem}</small>
                {grupo && (
                  <p>
                    Sua interpretação: <em>{sua ?? '(nenhuma)'}</em>
                    {av && av.interpretacao !== 'correta' && esperadas && esperadas.length > 0 && (
                      <>
                        {' '}
                        · Esperado: <em>{esperadas.join(' / ')}</em>
                      </>
                    )}
                  </p>
                )}
                <p className="explicacao">{g?.explicacao}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="painel">
        <h3>O que cada ensaio mostra — e o que não mostra</h3>
        <table className="tabela-ensaios">
          <thead>
            <tr>
              <th>Estação</th>
              <th>Mostra</th>
              <th>Não mostra</th>
            </tr>
          </thead>
          <tbody>
            {gab.ensaios.map((x) => (
              <tr key={x.estacao}>
                <td>{x.estacao}</td>
                <td>{x.mostra}</td>
                <td>{x.naoMostra}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {limitacoes.size > 0 && (
        <section className="painel">
          <h3>Limitações que apareceram nos seus ensaios</h3>
          <ul className="limitacoes-explicadas">
            {[...limitacoes.values()].map((l) => (
              <li key={l.id}>
                <strong>{l.texto}</strong>
                <p>{l.explicacao}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="painel acoes">
        <p>Os resultados continuam disponíveis no caderno para revisão.</p>
        <button className="botao primario" onClick={onReiniciar}>
          Nova tentativa
        </button>
      </section>
    </div>
  );
}
