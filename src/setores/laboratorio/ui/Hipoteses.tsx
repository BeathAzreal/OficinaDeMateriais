import type { CategoriaHipotese } from '../casos/tipos';
import { atualizarHipotese } from '../motor/estado';
import { useJogo } from './contexto';
import { Dicas } from './componentes/comuns';

const GRUPOS: { cat: CategoriaHipotese; titulo: string; explica: string }[] = [
  { cat: 'mecanismo', titulo: 'Mecanismo de falha', explica: 'Como a peça rompeu fisicamente (o processo de fratura).' },
  { cat: 'causa', titulo: 'Causa provável', explica: 'Por que a falha começou ali, naquele momento (a condição de origem).' },
  { cat: 'fator', titulo: 'Fatores contribuintes', explica: 'Condições que facilitaram, aceleraram ou deixaram de impedir a falha.' },
];

export function Hipoteses() {
  const { caso, estado, alterar } = useJogo();
  const contagem = (id: string) => {
    const c = { apoia: 0, enfraquece: 0, inconclusiva: 0 };
    for (const e of estado.evidencias) {
      const v = e.vinculos[id];
      if (v) c[v]++;
    }
    return c;
  };
  return (
    <div className="hipoteses">
      <header className="cabecalho-pagina">
        <h2>Formular hipóteses</h2>
        <p>
          Selecione as hipóteses que pretende investigar e anote o que seria preciso observar para apoiá-las ou enfraquecê-las. A seleção não revela
          nada sobre a resposta; os números ao lado de cada hipótese contam apenas as associações que <em>você</em> fez no caderno.
        </p>
      </header>
      <Dicas estacao="hipoteses" />
      {GRUPOS.map((g) => (
        <section key={g.cat} className="painel">
          <h3>
            {g.titulo} <small>— {g.explica}</small>
          </h3>
          <div className="cartoes-hipotese">
            {caso.publico.hipoteses
              .filter((h) => h.categoria === g.cat)
              .map((h) => {
                const r = estado.hipoteses[h.id];
                const c = contagem(h.id);
                return (
                  <article key={h.id} className={`cartao-hipotese ${r?.selecionada ? 'selecionada' : ''}`}>
                    <label className="titulo-hipotese">
                      <input
                        type="checkbox"
                        checked={!!r?.selecionada}
                        onChange={(e) => alterar((s) => atualizarHipotese(s, h.id, { selecionada: e.target.checked }))}
                      />
                      <strong>{h.titulo}</strong>
                    </label>
                    <p>{h.descricao}</p>
                    <p className="contagem" aria-label="Associações registradas no caderno">
                      <span title="apoia">＋ {c.apoia}</span> <span title="enfraquece">－ {c.enfraquece}</span> <span title="inconclusiva">？ {c.inconclusiva}</span>
                    </p>
                    {r?.selecionada && (
                      <div className="campos-hipotese">
                        <label>
                          O que eu esperaria observar se ela fosse verdadeira
                          <textarea rows={2} value={r.apoiaria} onChange={(e) => alterar((s) => atualizarHipotese(s, h.id, { apoiaria: e.target.value }))} />
                        </label>
                        <label>
                          O que a enfraqueceria
                          <textarea rows={2} value={r.enfraqueceria} onChange={(e) => alterar((s) => atualizarHipotese(s, h.id, { enfraqueceria: e.target.value }))} />
                        </label>
                      </div>
                    )}
                  </article>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
