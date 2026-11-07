import { useState } from 'react';
import type { Contexto } from '../../dados/catalogo';
import { criterioAnalise, type Nivel, type RelatorioEntrega } from '../../jogo/avaliacao';
import { pecaAtual, type Acao, type EstadoPartida } from '../../jogo/partida';
import { calcularCustos, tempoTotal } from '../../jogo/recursos';
import { comSinal, num, pct } from '../formato';

const NIVEL: Record<Nivel, string> = {
  atende: '✓ Atende',
  parcial: '◐ Atende parcialmente',
  'nao-atende': '✕ Não atende',
  pendente: '… Pendente',
  informativo: 'ℹ Informativo',
};

const STATUS: Record<string, string> = { conforme: '✓', acima: '▲ acima', abaixo: '▼ abaixo' };

function Relatorio({ r, ctx, despachar }: { r: RelatorioEntrega; ctx: Contexto; despachar(a: Acao): string | null }) {
  const [escolha, setEscolha] = useState<string>('');
  const enc = ctx.encomenda;
  const req = enc.requisitos;
  const criterios = r.criterios.map((c) => (c.id === 'analise' ? criterioAnalise(r) : c));
  return (
    <article className="relatorio">
      <h3>
        Devolutiva da peça {r.pecaNumero} {r.modo === 'laboratorio' ? '(laboratório)' : ''}
      </h3>
      <p className={r.conformeGeral ? 'ok' : 'aviso'}>
        {r.conformeGeral ? '✓ Peça conforme aos objetivos da missão.' : '✕ A peça não atende a todos os objetivos da missão.'}
      </p>

      <h4>Dimensões</h4>
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Verificação</th>
            <th scope="col">Nominal / pedido</th>
            <th scope="col">Leitura</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {r.pontos.map((p) => (
            <tr key={p.id}>
              <th scope="row">Ø seção {p.id} (Z −{p.z})</th>
              <td>
                {num(req.diametro.nominal)} ({num(req.diametro.nominal + req.diametro.tolInf)} a {num(req.diametro.nominal + req.diametro.tolSup)})
              </td>
              <td className="num">{num(p.aval.leitura)}</td>
              <td>
                {STATUS[p.aval.status]} {comSinal(p.aval.desvio, 2)}
              </td>
            </tr>
          ))}
          <tr>
            <th scope="row">
              Perfil completo z {num(r.perfil.z0, 0)}–{num(r.perfil.z1, 1)}
            </th>
            <td>idem</td>
            <td className="num">
              {num(r.perfil.min.leitura)} a {num(r.perfil.max.leitura)}
            </td>
            <td>{r.perfil.min.status === 'conforme' && r.perfil.max.status === 'conforme' ? '✓' : '✕'}</td>
          </tr>
          <tr>
            <th scope="row">Comprimento usinado</th>
            <td>
              {num(req.comprimento.nominal, 1)} ± {num(req.comprimento.tol, 1)}
            </td>
            <td className="num">{num(r.comprimento.leitura)}</td>
            <td>{r.comprimento.conforme ? '✓' : '✕'}</td>
          </tr>
          <tr>
            <th scope="row">Região bruta preservada</th>
            <td>sem usinagem além de {num(req.comprimento.nominal + req.comprimento.tol, 1)}</td>
            <td>—</td>
            <td>{r.regiaoBruta.conforme ? '✓' : '✕'}</td>
          </tr>
        </tbody>
      </table>

      <h4>Superfície</h4>
      <p>
        {r.superficie.raMax === null
          ? 'A região funcional não tem superfície usinada.'
          : `Pior Ra estimada ≈ ${num(r.superficie.raMax, 1)} µm (faixa didática ${num(r.superficie.faixa![0], 1)}–${num(r.superficie.faixa![1], 1)} µm) para objetivo ≤ ${num(req.ra.max, 1)} µm: ${r.superficie.conforme ? '✓ atende pela estimativa' : '✕ não atende'}${r.superficie.margemPequena ? ' (margem pequena: a faixa cruza o limite)' : ''}.`}
        {r.superficie.regiaoBrutaNaFuncional && ' Parte da região funcional continua com carepa.'}
      </p>

      <h4>Tempo, ferramenta e custo</h4>
      <dl className="grade-dados">
        <dt>Tempo calculado</dt>
        <dd>
          {num(r.tempoTotal, 2)} min: corte {num(r.tempos.corte, 2)} · retorno e ajuste {num(r.tempos.naoProdutivo, 2)} · cavaco {num(r.tempos.limpeza, 2)} · trocas{' '}
          {num(r.tempos.trocas, 2)} · preparação {num(r.tempos.preparacao, 2)}
        </dd>
        <dt>Arestas</dt>
        <dd>
          {r.arestas.map((a) => `aresta ${a.numero}: VB ≈ ${num(a.vb, 3)} mm, ${pct(a.consumo)} consumida${a.lascada ? ' (lascada)' : ''}`).join(' · ')}
        </dd>
        <dt>Material removido</dt>
        <dd>{num(r.volumeRemovido / 1000, 1)} cm³ na peça entregue</dd>
        <dt>Custo didático</dt>
        <dd>
          {num(r.custos.total, 1)} u.c. (tarugos {num(r.custos.tarugos, 1)} · máquina {num(r.custos.maquina, 1)} · arestas {num(r.custos.arestas, 1)})
          {r.orcamento !== null ? ` · orçamento ${num(r.orcamento, 0)} u.c.` : ''}
        </dd>
      </dl>

      <h4>Avaliação</h4>
      <ul className="criterios">
        {criterios.map((c) => (
          <li key={c.id} className={`criterio nivel-${c.nivel}`}>
            <strong>{c.titulo}</strong> <span className="selo">{NIVEL[c.nivel]}</span>
            {c.texto.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </li>
        ))}
      </ul>

      <h4>Principais fatores no seu resultado</h4>
      <ul className="lista-compacta">
        {r.fatores.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <section className="pergunta" aria-labelledby="pergunta-titulo">
        <h4 id="pergunta-titulo">Pergunta: {r.pergunta.enunciado}</h4>
        <p className="nota">{r.pergunta.contexto}</p>
        {r.resposta ? (
          <>
            <p>
              Sua resposta: <strong>{r.pergunta.opcoes.find((o) => o.id === r.resposta)?.texto}</strong>
            </p>
            <p className={r.resposta === r.pergunta.correta ? 'ok' : 'aviso'}>{r.pergunta.feedback[r.resposta]}</p>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (escolha) despachar({ tipo: 'responder', opcao: escolha });
            }}
          >
            <fieldset>
              <legend className="visualmente-oculto">Opções</legend>
              {r.pergunta.opcoes.map((o) => (
                <label key={o.id} className="opcao">
                  <input type="radio" name="resposta" value={o.id} checked={escolha === o.id} onChange={() => setEscolha(o.id)} /> {o.texto}
                </label>
              ))}
            </fieldset>
            <button type="submit" className="botao primario" disabled={!escolha}>
              Responder
            </button>
          </form>
        )}
      </section>
    </article>
  );
}

interface Props {
  ctx: Contexto;
  estado: EstadoPartida;
  despachar(a: Acao): string | null;
  animando: boolean;
  onReiniciar(): void;
}

export function PainelEntregar({ ctx, estado, despachar, animando, onReiniciar }: Props) {
  const pj = pecaAtual(estado);
  const custos = calcularCustos(estado);
  const enc = ctx.encomenda;
  const lab = estado.modo === 'laboratorio';
  const ultima = estado.entregas[estado.entregas.length - 1];
  const medidaFinal = estado.medicoes.some((m) => m.pecaNumero === pj.numero && m.aposPasse === pj.passes[pj.passes.length - 1]);
  return (
    <div className="painel-conteudo">
      <h2>{lab ? 'Avaliar a peça' : 'Entregar a encomenda'}</h2>
      {!estado.encerrada && pj.estado !== 'entregue' && (
        <>
          <dl className="grade-dados">
            <dt>Peça atual</dt>
            <dd>
              {pj.numero} · {pj.estado === 'refugo' ? '✕ refugo' : 'em usinagem'} · {pj.passes.length} passe(s)
            </dd>
            <dt>Tempo até agora</dt>
            <dd>{num(tempoTotal(estado.tempos), 2)} min</dd>
            <dt>Custo até agora</dt>
            <dd>
              {num(custos.total, 1)} u.c.{!lab ? ` de ${num(enc.modoEncomenda.orcamento, 0)} u.c. de orçamento` : ''}
            </dd>
          </dl>
          {!medidaFinal && pj.passes.length > 0 && <p className="aviso">⚠ Você ainda não mediu a peça depois do último passe.</p>}
          <p className="nota">
            {lab
              ? 'No laboratório, a avaliação marca a peça como entregue. Depois disso, você pode preparar outro tarugo e continuar.'
              : 'Entregar encerra a encomenda. O cliente confere com os mesmos instrumentos da inspeção.'}
          </p>
          <button type="button" className="botao primario grande" disabled={animando || pj.passes.length === 0} onClick={() => despachar({ tipo: 'entregar' })}>
            {lab ? '✓ Avaliar esta peça' : '✓ Entregar a peça'}
          </button>
        </>
      )}
      {ultima && <Relatorio key={estado.entregas.length} r={ultima} ctx={ctx} despachar={despachar} />}
      {estado.encerrada && (
        <div className="acoes">
          <button type="button" className="botao" onClick={onReiniciar}>
            ↺ Nova partida
          </button>
        </div>
      )}
    </div>
  );
}
