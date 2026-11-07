import { useState } from 'react';
import type { Contexto } from '../../dados/catalogo';
import { ferramentas } from '../../dados/catalogo';
import {
  instanciaNaEstacao,
  materialDaPeca,
  pecaAtual,
  type EstadoPartida,
  type ParametroControlavel,
} from '../../jogo/partida';
import {
  T,
  inserirBloco,
  listagemIso,
  moverBloco,
  novoId,
  parametrosDoBloco,
  referenciasDosBlocos,
  removerBloco,
  type Bloco,
  type Programa,
} from '../../jogo/programa';
import { raGeometrico } from '../../modelo/cinematica';
import { comprimentoPonta, preverFuracao, verificarFuracao } from '../../modelo/furacao';
import { comprimentoMaximo, limiteAp, preverPasse, verificarParametros } from '../../modelo/passe';
import type { Broca, Ferramenta, FerramentaTornear, Operacao } from '../../modelo/tipos';
import { num } from '../formato';
import { CampoNumero } from './CampoNumero';
import { DiagramaAp } from './Esquemas';

interface Props {
  ctx: Contexto;
  estado: EstadoPartida;
  programa: Programa;
  setPrograma(p: Programa): void;
  selecionado: number;
  setSelecionado(i: number): void;
  ocupado: boolean;
  onExecutarBloco(i: number): void;
}

function resumoBloco(b: Bloco): string {
  if (b.tipo === 'parada') return `M00 parada — ${b.comentario || 'sem comentário'}`;
  if (b.tipo === 'tornear')
    return `${b.params.operacao === 'desbaste' ? 'Desbaste' : 'Acabamento'} · S${num(b.params.n, 0)} · F${num(b.params.f)} · ap ${num(b.params.ap)} · Z−${num(b.params.L, 1)}`;
  return `Furação · S${num(b.params.n, 0)} · F${num(b.params.f)} · P ${num(b.params.P, 1)} · ${b.params.q > 0 ? `pica-pau ${num(b.params.q, 1)}` : 'contínua'}`;
}

export function PainelPrograma({ ctx, estado, programa, setPrograma, selecionado, setSelecionado, ocupado, onExecutarBloco }: Props) {
  const [vista, setVista] = useState<'blocos' | 'iso'>('blocos');
  const { maquina } = ctx;
  const pj = pecaAtual(estado);
  const mat = materialDaPeca(pj);
  const lab = estado.modo === 'laboratorio';
  const refs = referenciasDosBlocos(programa, estado);
  const sel = programa.blocos[selecionado];
  const estacoes = Array.from({ length: maquina.estacoes }, (_, i) => i + 1);
  const ferrDe = (e: number) => {
    const inst = instanciaNaEstacao(estado, e);
    return inst ? ferramentas[inst.ferramentaId] : null;
  };
  const primeiraDe = (tipo: 'tornear' | 'broca') => estacoes.find((e) => ferrDe(e)?.tipo === tipo) ?? 1;

  const atualizar = (b: Bloco) => {
    const blocos = programa.blocos.slice();
    blocos[selecionado] = b;
    setPrograma({ ...programa, blocos });
  };
  const adicionar = (tipo: Bloco['tipo']) => {
    let b: Bloco;
    if (tipo === 'tornear') b = { id: novoId(), tipo, estacao: primeiraDe('tornear'), params: { n: 1200, f: 0.2, ap: 0.5, L: 30, operacao: 'desbaste' } };
    else if (tipo === 'furar') b = { id: novoId(), tipo, estacao: primeiraDe('broca'), params: { n: 800, f: 0.12, P: 20, q: 0 } };
    else b = { id: novoId(), tipo, comentario: 'Medir' };
    const pos = programa.blocos.length ? selecionado + 1 : 0;
    setPrograma(inserirBloco(programa, b, pos));
    setSelecionado(pos);
  };

  const iso = listagemIso(programa, estado);
  const executados = (i: number) => i < programa.cursor;

  return (
    <div className="painel-conteudo">
      <div className="cabecalho-painel">
        <h2>Programa {programa.nome}</h2>
        <div className="segmentado" role="radiogroup" aria-label="Vista do programa">
          <button type="button" role="radio" aria-checked={vista === 'blocos'} className={vista === 'blocos' ? 'ativo' : ''} onClick={() => setVista('blocos')}>
            Blocos
          </button>
          <button type="button" role="radio" aria-checked={vista === 'iso'} className={vista === 'iso' ? 'ativo' : ''} onClick={() => setVista('iso')}>
            Código ISO
          </button>
        </div>
      </div>

      <div className="acoes barra-ferramentas" role="toolbar" aria-label="Editar programa">
        <button type="button" className="botao" disabled={ocupado} onClick={() => adicionar('tornear')}>
          ＋ Torneamento
        </button>
        <button type="button" className="botao" disabled={ocupado} onClick={() => adicionar('furar')}>
          ＋ Furação
        </button>
        <button type="button" className="botao" disabled={ocupado} onClick={() => adicionar('parada')}>
          ＋ Parada M00
        </button>
        <button
          type="button"
          className="botao"
          disabled={ocupado || !sel}
          onClick={() => {
            setPrograma(inserirBloco(programa, { ...sel, id: novoId() } as Bloco, selecionado + 1));
            setSelecionado(selecionado + 1);
          }}
        >
          ⧉ Duplicar
        </button>
        <button type="button" className="botao" disabled={ocupado || selecionado <= 0} onClick={() => { setPrograma(moverBloco(programa, selecionado, -1)); setSelecionado(selecionado - 1); }} aria-label="Mover bloco para cima">
          ↑
        </button>
        <button type="button" className="botao" disabled={ocupado || selecionado >= programa.blocos.length - 1} onClick={() => { setPrograma(moverBloco(programa, selecionado, 1)); setSelecionado(selecionado + 1); }} aria-label="Mover bloco para baixo">
          ↓
        </button>
        <button type="button" className="botao" disabled={ocupado || !sel} onClick={() => { setPrograma(removerBloco(programa, selecionado)); setSelecionado(Math.max(0, selecionado - 1)); }}>
          ✕ Excluir
        </button>
        <button type="button" className="botao" disabled={ocupado} onClick={() => setPrograma({ ...programa, cursor: 0 })}>
          ⟲ Cursor ao início
        </button>
      </div>

      {vista === 'iso' ? (
        <>
          <pre className="listagem-iso" aria-label="Listagem do programa em formato ISO">
            {iso.map((l, k) => (
              <div
                key={k}
                className={`${l.bloco !== null && l.bloco === selecionado ? 'linha-sel' : ''} ${l.bloco !== null && l.bloco === programa.cursor ? 'linha-cursor' : ''} ${l.bloco !== null && executados(l.bloco) ? 'linha-feita' : ''}`}
              >
                {l.texto}
              </div>
            ))}
          </pre>
          <p className="nota">
            Listagem ilustrativa gerada a partir dos blocos (X em diâmetro, Z negativo para dentro da peça). G97 mantém a rotação constante: a vc muda com o diâmetro.
            Você edita o programa pelos campos, não pelo código.
          </p>
        </>
      ) : (
        <ol className="lista-blocos" aria-label="Blocos do programa">
          {programa.blocos.map((b, i) => (
            <li key={b.id}>
              <button
                type="button"
                className={`bloco ${i === selecionado ? 'selecionado' : ''} ${executados(i) ? 'feito' : ''} ${i === programa.cursor ? 'cursor' : ''}`}
                onClick={() => setSelecionado(i)}
                aria-current={i === selecionado}
              >
                <span className="bloco-estado">{executados(i) ? '✓' : i === programa.cursor ? '▶' : ' '}</span>
                <span className="bloco-n">N{(i + 1) * 10}</span>
                <span className="bloco-t">{b.tipo === 'parada' ? 'M00' : T(b.estacao)}</span>
                <span className="bloco-resumo">{resumoBloco(parametrosDoBloco(b, estado))}</span>
              </button>
            </li>
          ))}
          {programa.blocos.length === 0 && <li className="nota">Programa vazio. Adicione um bloco.</li>}
        </ol>
      )}

      {sel && (
        <section className="editor-bloco" aria-label="Editar bloco selecionado">
          <h3>
            Bloco N{(selecionado + 1) * 10} {executados(selecionado) ? '(já executado nesta passagem do cursor)' : ''}
          </h3>
          {sel.tipo === 'parada' ? (
            <div className="campo">
              <label htmlFor="comentario">Comentário da parada (M00)</label>
              <input id="comentario" type="text" value={sel.comentario} onChange={(e) => atualizar({ ...sel, comentario: e.target.value })} />
              <span className="nota">O programa para aqui. Meça, ajuste os blocos seguintes e aperte CICLO INÍCIO para continuar.</span>
            </div>
          ) : (
            <EditorUsinagem
              bloco={sel}
              ctx={ctx}
              estado={estado}
              dref={refs[selecionado]}
              atualizar={atualizar}
              ferrDe={ferrDe}
              estacoes={estacoes}
              lab={lab}
              material={mat}
            />
          )}
          <div className="acoes">
            <button type="button" className="botao" disabled={ocupado || sel.tipo === 'parada'} onClick={() => onExecutarBloco(selecionado)}>
              ▶ Executar só este bloco (MDI)
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function EditorUsinagem({
  bloco,
  ctx,
  estado,
  dref,
  atualizar,
  ferrDe,
  estacoes,
  lab,
  material,
}: {
  bloco: Extract<Bloco, { tipo: 'tornear' | 'furar' }>;
  ctx: Contexto;
  estado: EstadoPartida;
  dref: number;
  atualizar(b: Bloco): void;
  ferrDe(e: number): Ferramenta | null;
  estacoes: number[];
  lab: boolean;
  material: ReturnType<typeof materialDaPeca>;
}) {
  const { maquina, encomenda } = ctx;
  const pj = pecaAtual(estado);
  const efetivo = parametrosDoBloco(bloco, estado) as typeof bloco;
  const ferr = ferrDe(bloco.estacao) as FerramentaTornear | Broca | null;
  const tipoFerr = bloco.tipo === 'tornear' ? 'tornear' : 'broca';
  const basesPossiveis = estado.passes.filter((r) => r.tipo === bloco.tipo);
  const travado = (k: ParametroControlavel) => !!bloco.base && bloco.base.variar !== k;
  const setParam = (k: string, v: number | string) =>
    atualizar({ ...bloco, params: { ...bloco.params, [k]: v } } as Bloco);

  const seletorEstacao = (
    <div className="campo">
      <label htmlFor="estacao">Estação da torre</label>
      <select id="estacao" value={bloco.estacao} onChange={(e) => atualizar({ ...bloco, estacao: Number(e.target.value) } as Bloco)}>
        {estacoes.map((e) => {
          const f = ferrDe(e);
          return (
            <option key={e} value={e} disabled={!f || f.tipo !== tipoFerr}>
              {T(e)} — {f ? f.codigo : 'vazia'}
            </option>
          );
        })}
      </select>
      {(!ferr || ferr.tipo !== tipoFerr) && <span className="erro">✕ Esta estação não tem {tipoFerr === 'broca' ? 'broca' : 'ferramenta de tornear'}. Monte uma em FERRAMENTAS.</span>}
    </div>
  );

  const experimento = lab && (
    <fieldset className="controle-lab">
      <legend>Experimento: um parâmetro por vez</legend>
      <label>
        <input
          type="checkbox"
          checked={!!bloco.base}
          disabled={!basesPossiveis.length}
          onChange={(e) =>
            atualizar({
              ...bloco,
              base: e.target.checked ? { numero: basesPossiveis[basesPossiveis.length - 1].numero, variar: 'n' } : undefined,
            } as Bloco)
          }
        />{' '}
        Repetir uma operação do histórico mudando só um parâmetro
      </label>
      {bloco.base && (
        <div className="campo-linha">
          <label>
            Base{' '}
            <select value={bloco.base.numero} onChange={(e) => atualizar({ ...bloco, base: { ...bloco.base!, numero: Number(e.target.value) } } as Bloco)}>
              {basesPossiveis.map((r) => (
                <option key={r.numero} value={r.numero}>
                  #{r.numero} (peça {r.pecaNumero})
                </option>
              ))}
            </select>
          </label>
          <label>
            Variar{' '}
            <select value={bloco.base.variar} onChange={(e) => atualizar({ ...bloco, base: { ...bloco.base!, variar: e.target.value as ParametroControlavel } } as Bloco)}>
              {(bloco.tipo === 'tornear' ? ['n', 'f', 'ap', 'L', 'operacao'] : ['n', 'f', 'P', 'q']).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {bloco.base && <p className="nota">Os outros parâmetros ficam iguais aos da operação #{bloco.base.numero}. Para igualar também a peça e o desgaste, use “Condições equivalentes” no HISTÓRICO.</p>}
    </fieldset>
  );

  if (bloco.tipo === 'tornear') {
    const p = efetivo.params as Extract<Bloco, { tipo: 'tornear' }>['params'];
    const ft = ferr && ferr.tipo === 'tornear' ? ferr : null;
    const pecaRef = { ...pj.peca, dref };
    const amb = ft ? { material, ferramenta: ft, maquina } : null;
    const problemas = amb ? verificarParametros(pecaRef, p, amb) : [];
    const prev = amb && !problemas.some((x) => x.campo === 'geral') ? preverPasse(pecaRef, p, amb) : null;
    const erro = (k: string) => problemas.find((x) => x.campo === k)?.mensagem;
    const req = encomenda.requisitos;
    const dicas: string[] = [];
    if (lab && prev && ft) {
      if (material.comportamento.rugosidadeApc(prev.vcUsinada) > 0.3) dicas.push(`vc ≈ ${Math.round(prev.vcUsinada)} m/min está na faixa de aresta postiça de ${material.nome}.`);
      if (!ft.quebraCavaco) dicas.push('Ferramenta sem quebra-cavaco: materiais dúcteis formam fita.');
      else if (p.f < ft.quebraCavaco.fMin || p.ap < ft.quebraCavaco.apMin) dicas.push('f ou ap abaixo da janela do quebra-cavaco: espere cavaco em fita.');
      dicas.push(`Parcela geométrica da Ra com rε ${num(ft.raioPonta, 1)}: ≈ ${num(raGeometrico(p.f, ft.raioPonta), 2)} µm (f²/32rε).`);
      if (ft.classe === 'aco-rapido') dicas.push('Aço rápido: a vida da aresta cai muito depressa com a vc.');
    }
    return (
      <>
        {seletorEstacao}
        <fieldset className="operacao">
          <legend>Estratégia (rótulo)</legend>
          {(['desbaste', 'acabamento'] as Operacao[]).map((op) => (
            <label key={op}>
              <input type="radio" name="operacao" checked={p.operacao === op} disabled={travado('operacao')} onChange={() => setParam('operacao', op)} />{' '}
              {op === 'desbaste' ? 'Desbaste' : 'Acabamento'}
            </label>
          ))}
          <p className="nota">É só um rótulo. Quem muda o resultado são n, f, ap, L e a ferramenta.</p>
        </fieldset>
        {experimento}
        <div className="campos">
          <CampoNumero id="c-n" rotulo="Rotação S" unidade="rpm" valor={p.n} onValor={(v) => setParam('n', v)} min={maquina.rotacao.min} max={maquina.rotacao.max} passo={10} casas={0} ajuda="Constante no bloco (G97)." erro={erro('n')} travado={travado('n')} />
          <CampoNumero id="c-f" rotulo="Avanço F" unidade="mm/volta" valor={p.f} onValor={(v) => setParam('f', v)} min={maquina.avanco.min} max={maquina.avanco.max} passo={0.01} ajuda="Deslocamento por volta." erro={erro('f')} travado={travado('f')} />
          <CampoNumero id="c-ap" rotulo="Profundidade radial ap" unidade="mm" valor={p.ap} onValor={(v) => setParam('ap', v)} min={0} max={amb ? limiteAp(amb) : 3} passo={0.01} ajuda="No raio: o diâmetro cai 2·ap." erro={erro('ap')} travado={travado('ap')} />
          <CampoNumero id="c-L" rotulo="Comprimento L" unidade="mm" valor={p.L} onValor={(v) => setParam('L', v)} min={0.5} max={comprimentoMaximo(pj.peca, maquina)} passo={0.5} casas={1} ajuda="A partir da face livre (Z0)." erro={erro('L')} travado={travado('L')} />
        </div>
        {prev && (
          <div className="previsao" aria-live="polite">
            <h3>Previsão geométrica e cinemática</h3>
            <dl className="grade-dados">
              <dt>Velocidade de corte</dt>
              <dd>
                vc = π·D·n/1000 → <strong>{num((Math.PI * dref * p.n) / 1000, 0)}</strong> m/min no Ø de referência (X {num(dref, 2)}) e <strong>{num(prev.vcUsinada, 0)}</strong> m/min no Ø programado (usada pelo modelo)
              </dd>
              <dt>Velocidade de avanço</dt>
              <dd>vf = f·n = {num(prev.vf, 0)} mm/min</dd>
              <dt>Diâmetro (X)</dt>
              <dd>
                X {num(dref, 3)} − 2 × {num(p.ap)} = <strong>X {num(prev.dprog, 3)}</strong> (ΔD = {num(prev.reducaoDiametral)} mm)
              </dd>
              {estado.modo === 'encomenda' && (
                <>
                  <dt>Desenho pede</dt>
                  <dd>
                    Ø {num(req.diametro.nominal + req.diametro.tolInf)} a {num(req.diametro.nominal + req.diametro.tolSup)} em {num(req.comprimento.nominal, 1)} ±{' '}
                    {num(req.comprimento.tol, 1)} mm
                  </dd>
                </>
              )}
              <dt>Tempo</dt>
              <dd>
                ({num(p.L, 1)} + {num(maquina.aproximacao, 0)}) / vf = <strong>{num(prev.tc, 3)} min</strong> + {num(encomenda.tempos.naoProdutivoPorPasse, 1)} min de retorno
              </dd>
              <dt>Material</dt>
              <dd>{prev.passeEmVazio ? 'passe em vazio' : `≈ ${num(prev.volumeNominal / 1000, 2)} cm³`}</dd>
            </dl>
            <DiagramaAp dref={prev.dref} dprog={prev.dprog} ap={p.ap} />
            <p className="nota">A previsão vale se os blocos anteriores forem executados como programados. Deflexão, desgaste e acabamento só aparecem depois.</p>
          </div>
        )}
        {dicas.length > 0 && (
          <aside className="dicas" aria-label="Dicas do modo livre">
            <h3>Dicas</h3>
            <ul>
              {dicas.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </aside>
        )}
      </>
    );
  }

  const p = efetivo.params as Extract<Bloco, { tipo: 'furar' }>['params'];
  const br = ferr && ferr.tipo === 'broca' ? ferr : null;
  const amb = br ? { material, broca: br, maquina } : null;
  const problemas = amb ? verificarFuracao(pj.peca, p, amb) : [];
  const prev = amb && !problemas.some((x) => x.campo === 'geral' && x.mensagem.startsWith('Preencha')) ? preverFuracao(pj.peca, p, amb) : null;
  const erro = (k: string) => problemas.find((x) => x.campo === k)?.mensagem;
  const geral = problemas.filter((x) => x.campo === 'geral');
  const dicas: string[] = [];
  if (lab && prev && br) {
    if (p.q === 0 && p.P / br.diametro > 3) dicas.push(`P/d = ${num(p.P / br.diametro, 1)}: sem pica-pau, o cavaco começa a entupir o canal.`);
    if (pj.peca.furo[0] === 0 && br.diametro >= 12) dicas.push('Furo maciço com broca grande: o gume transversal gera muita força de avanço. Um pré-furo menor ajuda.');
    if (p.f > br.janelaCavaco.fMax) dicas.push('Avanço acima da janela da broca: carga alta.');
  }
  return (
    <>
      {seletorEstacao}
      {experimento}
      <div className="campos">
        <CampoNumero id="c-n" rotulo="Rotação S" unidade="rpm" valor={p.n} onValor={(v) => setParam('n', v)} min={maquina.rotacao.min} max={maquina.rotacao.max} passo={10} casas={0} ajuda="A peça gira; a broca fica parada." erro={erro('n')} travado={travado('n')} />
        <CampoNumero id="c-f" rotulo="Avanço F" unidade="mm/volta" valor={p.f} onValor={(v) => setParam('f', v)} min={maquina.avanco.min} max={maquina.avanco.max} passo={0.01} ajuda="Penetração por volta." erro={erro('f')} travado={travado('f')} />
        <CampoNumero id="c-P" rotulo="Profundidade P" unidade="mm" valor={p.P} onValor={(v) => setParam('P', v)} min={1} max={br ? br.comprimentoUtil : 60} passo={0.5} casas={1} ajuda="Diâmetro pleno, sem contar a ponta." erro={erro('P')} travado={travado('P')} />
        <CampoNumero id="c-q" rotulo="Pica-pau Q" unidade="mm" valor={p.q} onValor={(v) => setParam('q', v)} min={0} max={30} passo={0.5} casas={1} ajuda="Avanço entre retrações para tirar o cavaco; 0 = contínuo." erro={erro('q')} travado={travado('q')} />
      </div>
      {geral.map((g) => (
        <p key={g.mensagem} className="erro">
          ✕ {g.mensagem}
        </p>
      ))}
      {prev && br && (
        <div className="previsao" aria-live="polite">
          <h3>Previsão geométrica e cinemática</h3>
          <dl className="grade-dados">
            <dt>Velocidade de corte</dt>
            <dd>
              vc = π·d·n/1000 = <strong>{num(prev.vc, 0)}</strong> m/min na periferia da broca (no centro, vc → 0)
            </dd>
            <dt>Velocidade de avanço</dt>
            <dd>vf = f·n = {num(prev.vf, 0)} mm/min</dd>
            <dt>Ponta</dt>
            <dd>
              lp = (d/2)/tan(σ/2) = {num(comprimentoPonta(br), 2)} mm → ponta até Z −{num(prev.fundo, 2)}
            </dd>
            <dt>Relação P/d</dt>
            <dd>{num(p.P / br.diametro, 1)}</dd>
            <dt>Tempo</dt>
            <dd>
              {num(prev.percurso, 1)} mm / vf + {prev.descargas} descarga(s) × {num(maquina.tempoDescarga, 2)} min = <strong>{num(prev.tc, 3)} min</strong>
            </dd>
            <dt>Material</dt>
            <dd>≈ {num(prev.volumeNominal / 1000, 2)} cm³{pj.peca.furo[0] > 0 ? ' (já existe furo: só o anel restante é cortado)' : ''}</dd>
          </dl>
        </div>
      )}
      {dicas.length > 0 && (
        <aside className="dicas" aria-label="Dicas do modo livre">
          <h3>Dicas</h3>
          <ul>
            {dicas.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </aside>
      )}
    </>
  );
}
