import { useState } from 'react';
import { ferramentas, materiais } from '../../dados/catalogo';
import type { Acao, EstadoPartida, RegistroOperacao } from '../../jogo/partida';
import { compararPasses, raMedia } from '../../jogo/comparacao';
import { T } from '../../jogo/programa';
import { num } from '../formato';

const ROT: Record<string, string> = { n: 'n', f: 'f', ap: 'ap', L: 'L', operacao: 'operação', P: 'P', q: 'q' };

function resumoParametros(r: RegistroOperacao): string {
  return r.tipo === 'tornear'
    ? `ap ${num(r.params.ap)} · L ${num(r.params.L, 1)} · ${r.params.operacao}`
    : `P ${num(r.params.P, 1)} · q ${num(r.params.q, 1)}`;
}

function resultado(r: RegistroOperacao): string {
  if (r.tipo === 'tornear') {
    const ra = raMedia(r);
    return `X ${num(r.previsao.dprog, 2)} · Ra ≈ ${ra === null ? '—' : num(ra, 1)} µm${r.lascouEm !== null ? ' · ✕ lascou' : ''}`;
  }
  return `furo Ø ${num(r.diametroFuro, 2)} · Ra ≈ ${num(r.raFuro, 1)} µm${r.quebrouEm !== null ? ' · ✕ quebrou' : ''}`;
}

interface Props {
  estado: EstadoPartida;
  despachar(a: Acao): string | null;
  ocupado: boolean;
  onRepetirNoPrograma(numero: number): void;
}

export function PainelHistorico({ estado, despachar, ocupado, onRepetirNoPrograma }: Props) {
  const [sel, setSel] = useState<number[]>([]);
  const alternar = (n: number) => setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : [...s, n].slice(-2)));
  const escolhidos = sel.map((n) => estado.passes[n - 1]).filter(Boolean);
  const comp = escolhidos.length === 2 ? compararPasses(escolhidos[0], escolhidos[1]) : null;
  const lab = estado.modo === 'laboratorio';
  const ultimoSel = escolhidos[escolhidos.length - 1];

  return (
    <div className="painel-conteudo">
      <h2>Histórico e comparação</h2>
      {estado.passes.length === 0 ? (
        <p className="nota">Nenhuma operação executada ainda.</p>
      ) : (
        <>
          <p className="nota">Marque duas operações para compará-las.</p>
          <div className="rolagem-x">
            <table className="tabela compacta">
              <thead>
                <tr>
                  <th scope="col">Comparar</th>
                  <th scope="col">#</th>
                  <th scope="col">Peça</th>
                  <th scope="col">Material</th>
                  <th scope="col">T / ferramenta</th>
                  <th scope="col">S [rpm]</th>
                  <th scope="col">F [mm/v]</th>
                  <th scope="col">Parâmetros [mm]</th>
                  <th scope="col">vc [m/min]</th>
                  <th scope="col">Tempo [min]</th>
                  <th scope="col">Resultado (modelo)</th>
                  <th scope="col">VB fim [mm]</th>
                  <th scope="col">Cavaco</th>
                  <th scope="col">Experimento</th>
                </tr>
              </thead>
              <tbody>
                {estado.passes.map((r) => (
                  <tr key={r.numero} className={sel.includes(r.numero) ? 'selecionada' : ''}>
                    <td>
                      <input type="checkbox" aria-label={`Comparar operação ${r.numero}`} checked={sel.includes(r.numero)} onChange={() => alternar(r.numero)} />
                    </td>
                    <td>{r.numero}</td>
                    <td>
                      {r.pecaNumero}
                      {r.refugoApos.length ? ' ✕' : ''}
                    </td>
                    <td>{materiais[r.materialId].nome}</td>
                    <td>
                      {T(r.estacao)} {ferramentas[r.ferramentaId].codigo}
                    </td>
                    <td className="num">{num(r.params.n, 0)}</td>
                    <td className="num">{num(r.params.f)}</td>
                    <td>{resumoParametros(r)}</td>
                    <td className="num">{num(r.vcModelo, 0)}</td>
                    <td className="num">{num(r.tipo === 'furar' ? r.tcEfetivo : r.previsao.tc, 3)}</td>
                    <td>{resultado(r)}</td>
                    <td className="num">{num(r.vbFinal, 3)}</td>
                    <td>{r.cavaco.tipo}</td>
                    <td>
                      {r.controle
                        ? `base #${r.controle.baseNumero}; variou ${r.controle.alterado ? ROT[r.controle.alterado] : '—'}; manteve ${r.controle.mantidos.map((m) => ROT[m]).join(', ')}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ultimoSel && (
            <div className="acoes">
              <button type="button" className="botao" disabled={ocupado} onClick={() => onRepetirNoPrograma(ultimoSel.numero)}>
                ↻ Repetir #{ultimoSel.numero} no programa (um parâmetro por vez)
              </button>
              {lab && (
                <button
                  type="button"
                  className="botao"
                  disabled={ocupado}
                  onClick={() => despachar({ tipo: 'prepararEquivalente', passeBase: ultimoSel.numero })}
                  title="Carrega uma peça e monta uma ferramenta no mesmo estado de entrada da operação"
                >
                  ≡ Condições equivalentes à #{ultimoSel.numero}
                </button>
              )}
            </div>
          )}
        </>
      )}

      {comp && (
        <section className="comparacao" aria-live="polite">
          <h3>
            Operação #{escolhidos[0].numero} × #{escolhidos[1].numero}
          </h3>
          <p className={comp.atribuivel ? 'ok' : 'aviso'}>
            {comp.atribuivel ? '✓ ' : '⚠ '}
            {comp.conclusao}
          </p>
          {comp.parametrosDiferentes.length > 0 && (
            <p>
              <strong>Fatores alterados:</strong> {comp.parametrosDiferentes.map((d) => `${d.campo} ${d.a} → ${d.b}`).join('; ')}
            </p>
          )}
          {comp.confusores.length > 0 && (
            <>
              <p>
                <strong>Condições de entrada diferentes:</strong>
              </p>
              <ul className="lista-compacta">
                {comp.confusores.map((c) => (
                  <li key={c.texto}>{c.texto}</li>
                ))}
              </ul>
            </>
          )}
          {comp.linhas.length > 0 && (
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Grandeza</th>
                  <th scope="col">#{escolhidos[0].numero}</th>
                  <th scope="col">#{escolhidos[1].numero}</th>
                  <th scope="col">Unidade</th>
                </tr>
              </thead>
              <tbody>
                {comp.linhas.map((l) => (
                  <tr key={l.rotulo}>
                    <th scope="row">{l.rotulo}</th>
                    <td className="num">{l.a}</td>
                    <td className="num">{l.b}</td>
                    <td>{l.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="nota">Valores “(modelo)” são internos, sem arredondamento de instrumento. Servem para comparar tendências.</p>
        </section>
      )}

      <h3>Peças</h3>
      <ul className="lista-compacta">
        {estado.pecas.map((p) => (
          <li key={p.numero}>
            Peça {p.numero} ({materiais[p.peca.materialId].nome}, Ø {num(p.peca.diametroBruto, 0)} × balanço {num(p.peca.balanco, 0)}):{' '}
            {p.estado === 'refugo' ? '✕ refugo' : p.estado === 'entregue' ? '✓ entregue' : 'em usinagem'} · operações {p.passes.length ? p.passes.join(', ') : 'nenhuma'}
            {p.equivalenteDe ? ` · equivalente à entrada da operação #${p.equivalenteDe}` : ''}
            {p.bloqueio ? ` · ${p.bloqueio}` : p.motivosRefugo.length ? ` · ${p.motivosRefugo.map((m) => m.texto).join(' ')}` : ''}
          </li>
        ))}
      </ul>

      <h3>Medições</h3>
      {estado.medicoes.length ? (
        <ul className="lista-compacta">
          {estado.medicoes.map((m) => (
            <li key={m.numero}>
              Peça {m.pecaNumero}, após operação {m.aposPasse || '— (bruta)'}: {m.rotulo} = {num(m.valor, 2)} mm
            </li>
          ))}
        </ul>
      ) : (
        <p className="nota">Nenhuma medição registrada.</p>
      )}
    </div>
  );
}
