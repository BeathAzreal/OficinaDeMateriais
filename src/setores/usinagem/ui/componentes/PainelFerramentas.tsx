import { useState } from 'react';
import type { Contexto } from '../../dados/catalogo';
import { listaFerramentas } from '../../dados/catalogo';
import { instanciaNaEstacao, type Acao, type EstadoPartida } from '../../jogo/partida';
import { T } from '../../jogo/programa';
import { consumoAresta, estoqueRestante } from '../../jogo/recursos';
import { vbDeDano } from '../../modelo/fenomenos';
import { NOME_CLASSE, type Ferramenta, type ValorDeclarado } from '../../modelo/tipos';
import { num, pct } from '../formato';
import { ArestaVista, BrocaVista, GeometriaInserto } from './Esquemas';

const ORIGEM: Record<ValorDeclarado['origem'], string> = { exato: 'declarado', 'literatura-geral': 'valor típico', sintetico: 'sintético' };

export function FichaFerramenta({ f }: { f: Ferramenta }) {
  return (
    <div className="ficha-ferramenta">
      <p>
        <strong>{f.nome}</strong> · {f.descricaoClasse}
      </p>
      {f.tipo === 'tornear' ? <GeometriaInserto ferramenta={f} /> : <BrocaVista broca={f} />}
      <table className="tabela">
        <tbody>
          {f.geometria.map((g) => (
            <tr key={g.rotulo}>
              <th scope="row">{g.rotulo}</th>
              <td>{g.valor}</td>
              <td>
                <span className={`selo selo-${g.origem}`}>{ORIGEM[g.origem]}</span>
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row">Custo didático</th>
            <td>{num(f.custo, 0)} u.c. {f.tipo === 'tornear' ? 'por aresta' : 'por broca'} (cobrado pela fração de vida usada)</td>
            <td>
              <span className="selo selo-sintetico">sintético</span>
            </td>
          </tr>
        </tbody>
      </table>
      <ul className="lista-compacta">
        {f.observacoes.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
    </div>
  );
}

interface Props {
  ctx: Contexto;
  estado: EstadoPartida;
  despachar(a: Acao): string | null;
  ocupado: boolean;
}

export function PainelFerramentas({ ctx, estado, despachar, ocupado }: Props) {
  const [estacao, setEstacao] = useState(estado.estacaoAtiva);
  const [escolha, setEscolha] = useState<string>('');
  const { maquina, encomenda } = ctx;
  const est = estoqueRestante(estado);
  const lab = estado.modo === 'laboratorio';
  const permitidas = listaFerramentas.filter((f) => lab || encomenda.ferramentasPermitidas.includes(f.id));
  const inst = instanciaNaEstacao(estado, estacao);
  const f = inst ? listaFerramentas.find((x) => x.id === inst.ferramentaId)! : null;
  const vb = inst && f ? vbDeDano(inst.estado.dano, f) : 0;
  const ultimaOp = inst ? [...estado.passes].reverse().find((r) => r.arestaNumero === inst.numero) : undefined;

  return (
    <div className="painel-conteudo">
      <h2>Torre de ferramentas</h2>
      <p className="nota">
        {est ? `Estoque desta encomenda: ${est.arestas} aresta(s)/ferramenta(s) nova(s). Montar ou trocar consome uma.` : 'Modo livre: ferramentas sem limite.'} Cada
        aresta nova é zerada nas coordenadas programadas.
      </p>
      <div className="torre" role="radiogroup" aria-label="Estações da torre">
        {Array.from({ length: maquina.estacoes }, (_, i) => i + 1).map((e) => {
          const ie = instanciaNaEstacao(estado, e);
          const fe = ie ? listaFerramentas.find((x) => x.id === ie.ferramentaId)! : null;
          const v = ie && fe ? vbDeDano(ie.estado.dano, fe) / fe.vbLimite : 0;
          return (
            <button key={e} type="button" role="radio" aria-checked={estacao === e} className={`estacao ${estacao === e ? 'ativa' : ''}`} onClick={() => setEstacao(e)}>
              <span className="estacao-t">{T(e)}</span>
              <span className="estacao-nome">{fe ? fe.codigo : 'vazia'}</span>
              {ie && (
                <span className="barra mini" aria-hidden>
                  <span className="barra-preenchida" style={{ width: `${Math.min(100, v * 100)}%` }} />
                </span>
              )}
              {ie?.estado.lascada && <span className="estacao-alerta">{fe?.tipo === 'broca' ? '✕ quebrada' : '✕ lascada'}</span>}
            </button>
          );
        })}
      </div>

      <h3>Estação {T(estacao)}</h3>
      {inst && f ? (
        <>
          <dl className="grade-dados">
            <dt>Ferramenta</dt>
            <dd>
              {f.codigo} ({f.tipo === 'tornear' ? 'tornear' : 'broca'}, {NOME_CLASSE[f.classe]}) · instância nº {inst.numero}
              {inst.equivalenteDe ? ` (equivalente à da operação #${inst.equivalenteDe})` : ''}
            </dd>
            <dt>Desgaste</dt>
            <dd>
              VB ≈ {num(vb, 3)} mm de {num(f.vbLimite, 2)} mm (estimativa sintética) · {pct(Math.min(inst.estado.dano, 9.99))} da vida de referência ·{' '}
              {num(inst.estado.tempoCorte, 2)} min em contato
              {inst.estado.lascada ? (f.tipo === 'broca' ? ' · ✕ broca quebrada' : ' · ✕ aresta lascada') : ''}
            </dd>
            {ultimaOp && (
              <>
                <dt>Última operação</dt>
                <dd>
                  #{ultimaOp.numero}: vida de referência ≈ {num(ultimaOp.vidaReferencia, 1)} min nas condições usadas (curva sintética de {NOME_CLASSE[f.classe]})
                </dd>
              </>
            )}
            <dt>Consumo para custo</dt>
            <dd>{pct(consumoAresta(inst.estado))}</dd>
          </dl>
          <ArestaVista vb={vb} vbLimite={f.vbLimite} lascada={inst.estado.lascada} apc={ultimaOp?.tipo === 'tornear' && ultimaOp.cavaco.tipo === 'apc'} />
          <div className="acoes">
            <button type="button" className="botao" disabled={ocupado || estado.encerrada || (est !== null && est.arestas <= 0)} onClick={() => despachar({ tipo: 'trocarAresta', estacao })}>
              ⟲ {f.tipo === 'broca' ? 'Trocar broca' : 'Trocar aresta'} ({num(encomenda.tempos.trocaAresta, 1)} min)
            </button>
          </div>
        </>
      ) : (
        <p className="nota">Estação vazia.</p>
      )}

      <div className="campo">
        <label htmlFor="montar">Montar outra ferramenta em {T(estacao)}</label>
        <div className="campo-linha">
          <select id="montar" value={escolha} onChange={(e) => setEscolha(e.target.value)}>
            <option value="">— escolha —</option>
            <optgroup label="Tornear">
              {permitidas.filter((x) => x.tipo === 'tornear').map((x) => (
                <option key={x.id} value={x.id}>
                  {x.codigo} — {NOME_CLASSE[x.classe]}
                </option>
              ))}
            </optgroup>
            {permitidas.some((x) => x.tipo === 'broca') && (
              <optgroup label="Brocas">
                {permitidas.filter((x) => x.tipo === 'broca').map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.codigo} — {NOME_CLASSE[x.classe]}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            className="botao primario"
            disabled={!escolha || ocupado || estado.encerrada}
            onClick={() => {
              if (!despachar({ tipo: 'montarFerramenta', estacao, ferramentaId: escolha })) setEscolha('');
            }}
          >
            Montar ({num(encomenda.tempos.montagemFerramenta, 1)} min)
          </button>
        </div>
        {!lab && <span className="nota">Nesta encomenda só estão disponíveis ferramentas de tornear.</span>}
      </div>

      <h3>Biblioteca</h3>
      {permitidas.map((x) => (
        <details key={x.id} className="termo">
          <summary>
            {x.codigo} · {x.tipo === 'tornear' ? 'tornear' : 'broca'} · {NOME_CLASSE[x.classe]}
          </summary>
          <FichaFerramenta f={x} />
        </details>
      ))}
    </div>
  );
}
