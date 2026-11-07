import { useState } from 'react';
import type { Contexto } from '../../dados/catalogo';
import { LIVRE, listaMateriais, material as materialPorId } from '../../dados/catalogo';
import { glossario } from '../../dados/glossario';
import { materialDaPeca, pecaAtual, type Acao, type EstadoPartida } from '../../jogo/partida';
import { calcularCustos, estoqueRestante } from '../../jogo/recursos';
import type { Material, ValorDeclarado } from '../../modelo/tipos';
import { num } from '../formato';
import { DesenhoTecnico } from './DesenhoTecnico';
import { Microestrutura } from './Esquemas';

const ORIGEM: Record<ValorDeclarado['origem'], string> = { exato: 'declarado', 'literatura-geral': 'valor típico', sintetico: 'sintético' };

export function FichaMaterial({ m }: { m: Material }) {
  return (
    <div className="ficha-material">
      <p>
        <strong>{m.designacao}</strong>
      </p>
      <p>
        <strong>Condição de fornecimento:</strong> {m.condicaoFornecimento}. {m.descricaoCondicao}
      </p>
      <p className="nota">{m.microestrutura.descricao}</p>
      <Microestrutura material={m} />
      {m.microestrutura.calculo && <p className="nota">{m.microestrutura.calculo}</p>}
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">Propriedade</th>
            <th scope="col">Valor</th>
            <th scope="col">Origem</th>
          </tr>
        </thead>
        <tbody>
          {[...m.composicao, ...m.propriedades].map((v) => (
            <tr key={v.rotulo}>
              <th scope="row">{v.rotulo}</th>
              <td>
                {v.valor}
                {v.nota && <div className="nota">{v.nota}</div>}
              </td>
              <td>
                <span className={`selo selo-${v.origem}`}>{ORIGEM[v.origem]}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="lista-compacta">
        {m.interpretacao.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

function Glossario() {
  return (
    <>
      <h3>Termos</h3>
      {glossario.map((t) => (
        <details key={t.id} className="termo">
          <summary>
            {t.termo}
            {t.simbolo ? ` (${t.simbolo}${t.unidade ? `, ${t.unidade}` : ''})` : t.unidade ? ` (${t.unidade})` : ''}
          </summary>
          <p>{t.texto}</p>
        </details>
      ))}
    </>
  );
}

interface Props {
  ctx: Contexto;
  estado: EstadoPartida;
  despachar(a: Acao): string | null;
  ocupado: boolean;
}

export function PainelPeca({ ctx, estado, despachar, ocupado }: Props) {
  const pj = pecaAtual(estado);
  const atual = materialDaPeca(pj);
  const [materialId, setMaterialId] = useState(atual.id);
  const [diametro, setDiametro] = useState(pj.peca.diametroBruto);
  const [balanco, setBalanco] = useState(pj.peca.balanco);
  const { encomenda: enc, maquina } = ctx;

  if (estado.modo === 'encomenda') {
    const est = estoqueRestante(estado)!;
    const custos = calcularCustos(estado);
    return (
      <div className="painel-conteudo">
        <h2>
          {enc.codigo} · {enc.titulo}
        </h2>
        <p>{enc.resumo}</p>
        <ul className="lista-compacta">
          {enc.contexto.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <DesenhoTecnico enc={enc} material={atual} />
        <h3>Recursos</h3>
        <dl className="grade-dados">
          <dt>Tarugo</dt>
          <dd>
            Ø {enc.tarugo.diametro} × {enc.tarugo.comprimentoTotal} mm, {atual.nome} {atual.condicaoFornecimento.toLowerCase()}
          </dd>
          <dt>Fixação</dt>
          <dd>{enc.fixacao}</dd>
          <dt>Máquina</dt>
          <dd>
            {maquina.nome}: S {maquina.rotacao.min}–{maquina.rotacao.max} rpm; F {num(maquina.avanco.min)}–{num(maquina.avanco.max)} mm/volta; torre com {maquina.estacoes}{' '}
            estações
          </dd>
          <dt>Instrumentos</dt>
          <dd>
            {enc.instrumentos.micrometro.descricao} {enc.instrumentos.paquimetro.descricao}
          </dd>
          <dt>Custos didáticos</dt>
          <dd>
            tarugo {num(enc.custos.tarugo, 0)} u.c. · máquina {num(enc.custos.minutoMaquina, 1)} u.c./min · arestas pelo custo de cada ferramenta × fração de vida usada
          </dd>
          <dt>Tempos fixos</dt>
          <dd>
            preparação {num(enc.tempos.preparacaoTarugo, 1)} min · retorno {num(enc.tempos.naoProdutivoPorPasse, 1)} min/operação · troca de aresta{' '}
            {num(enc.tempos.trocaAresta, 1)} min · montagem {num(enc.tempos.montagemFerramenta, 1)} min · retirada de cavaco em fita {num(enc.tempos.limpezaCavaco, 1)} min
          </dd>
          <dt>Estoque e orçamento</dt>
          <dd>
            {est.tarugos} tarugo(s) e {est.arestas} aresta(s) de reserva · orçamento {num(enc.modoEncomenda.orcamento, 0)} u.c. (gasto {num(custos.total, 1)} u.c.)
          </dd>
        </dl>
        <div className="acoes">
          <button type="button" className="botao" disabled={ocupado || estado.encerrada || est.tarugos <= 0} onClick={() => despachar({ tipo: 'novoTarugo' })}>
            ＋ Carregar tarugo novo ({num(enc.custos.tarugo, 0)} u.c., restam {est.tarugos})
          </button>
        </div>
        <h3>Ficha do material</h3>
        <FichaMaterial m={atual} />
        <Glossario />
      </div>
    );
  }

  const escolhido = materialPorId(materialId);
  const mudou = materialId !== atual.id || diametro !== pj.peca.diametroBruto || balanco !== pj.peca.balanco;
  return (
    <div className="painel-conteudo">
      <h2>Peça e material (modo livre)</h2>
      <p>
        Na placa agora: <strong>peça {pj.numero}</strong> de {atual.nome} ({atual.condicaoFornecimento.toLowerCase()}), Ø {num(pj.peca.diametroBruto, 0)} mm com{' '}
        {num(pj.peca.balanco, 0)} mm em balanço{pj.estado === 'refugo' ? ' · ✕ inutilizada' : ''}.
      </p>
      <fieldset>
        <legend>Material do próximo tarugo</legend>
        <div className="cartoes-material">
          {listaMateriais.map((m) => (
            <label key={m.id} className={`cartao-material ${materialId === m.id ? 'ativo' : ''}`}>
              <input type="radio" name="material" value={m.id} checked={materialId === m.id} onChange={() => setMaterialId(m.id)} />
              <span className="amostra" style={{ background: `linear-gradient(180deg, ${m.cores.usinada[0]}, ${m.cores.usinada[1]})` }} aria-hidden />
              <span>
                <strong>{m.nome}</strong>
                <br />
                <span className="nota">
                  {m.familia} · {m.condicaoFornecimento.toLowerCase()}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="campo-linha">
        <label>
          Diâmetro do tarugo{' '}
          <select value={diametro} onChange={(e) => setDiametro(Number(e.target.value))}>
            {LIVRE.diametros.map((d) => (
              <option key={d} value={d}>
                Ø {d} mm
              </option>
            ))}
          </select>
        </label>
        <label>
          Balanço{' '}
          <select value={balanco} onChange={(e) => setBalanco(Number(e.target.value))}>
            {LIVRE.balancos.map((b) => (
              <option key={b} value={b}>
                {b} mm
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="nota">Balanço maior e diâmetro menor deixam a peça mais flexível: a mesma força gera mais deflexão.</p>
      <div className="acoes">
        <button type="button" className="botao primario" disabled={ocupado} onClick={() => despachar({ tipo: 'novoTarugo', materialId, diametro, balanco })}>
          ＋ Carregar tarugo {mudou ? 'com esta escolha' : 'igual ao atual'}
        </button>
      </div>
      <h3>Ficha: {escolhido.nome}</h3>
      <FichaMaterial m={escolhido} />
      <Glossario />
    </div>
  );
}
