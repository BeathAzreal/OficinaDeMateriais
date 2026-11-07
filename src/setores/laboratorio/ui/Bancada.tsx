import { useState } from 'react';
import { CUSTOS } from '../motor/recursos';
import { solicitarDocumento } from '../motor/estado';
import { useJogo } from './contexto';
import { Dicas, Preco } from './componentes/comuns';
import { PecaSVG, REGIOES, VistaLateral } from './componentes/PecaSVG';
import { ListaObservacoes } from './componentes/VisorAquisicao';

export function Bancada({ onExaminar }: { onExaminar: (superficie: string) => void }) {
  const { caso, estado, executar } = useJogo();
  const [regiao, setRegiao] = useState<string | null>('fratura');
  const [vista, setVista] = useState<'junta' | 'inteira'>('junta');
  const f = caso.publico.ficha;
  const reg = REGIOES.find((r) => r.id === regiao);
  return (
    <div className="bancada">
      <section className="painel peca">
        <header className="cabecalho-painel">
          <h2>Peça recebida</h2>
          <div className="radio-linha">
            <button className={`botao pequeno ${vista === 'junta' ? 'ativo' : ''}`} onClick={() => setVista('junta')}>
              Região da junta
            </button>
            <button className={`botao pequeno ${vista === 'inteira' ? 'ativo' : ''}`} onClick={() => setVista('inteira')}>
              Barra inteira
            </button>
          </div>
        </header>
        <PecaSVG vista={vista} modo="regioes" regiao={regiao} onRegiao={setRegiao} altura={vista === 'junta' ? 380 : 200} />
        <VistaLateral />
        <p className="legenda-imagem">Desenho esquemático, vista de cima. Passe o mouse para ver as coordenadas; clique numa região para selecioná-la.</p>
        {reg && (
          <div className="regiao-info">
            <h3>{reg.nome}</h3>
            <p>{reg.descricao}</p>
            {reg.superficie && (
              <button className="botao primario" onClick={() => onExaminar(reg.superficie!)}>
                Examinar na estação de inspeção visual →
              </button>
            )}
          </div>
        )}
      </section>

      <div className="coluna-ficha">
        <Dicas estacao="bancada" />
        <section className="painel">
          <h2>Ficha técnica</h2>
          <dl className="ficha">
            <dt>Peça</dt>
            <dd>{f.peca}</dd>
            <dt>Material declarado</dt>
            <dd>{f.materialDeclarado}</dd>
            <dt>Geometria</dt>
            <dd>{f.geometria}</dd>
            <dt>Processo de fabricação</dt>
            <dd>{f.processo}</dd>
            <dt>Condições de uso</dt>
            <dd>{f.condicoesUso}</dd>
          </dl>
        </section>
        <section className="painel">
          <h2>Histórico inicial</h2>
          <ul>
            {caso.publico.historico.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </section>
        <section className="painel destaque">
          <h2>Objetivo da investigação</h2>
          <p>{caso.publico.objetivo}</p>
          <p>
            Recursos disponíveis: <strong>R$ {caso.publico.recursos.orcamento.toLocaleString('pt-BR')}</strong> e{' '}
            <strong>{caso.publico.recursos.tempoH} h</strong> de laboratório.
          </p>
        </section>
        <section className="painel">
          <h2>Documentos que podem ser solicitados</h2>
          <ul className="documentos">
            {caso.publico.documentos.map((d) => {
              const recebido = estado.aquisicoes.find((a) => a.tipo === 'documento' && a.documentoId === d.id);
              return (
                <li key={d.id}>
                  <div className="doc-cabecalho">
                    <strong>{d.titulo}</strong>
                    <small>{d.origem}</small>
                    {!recebido && (
                      <button className="botao pequeno" onClick={() => executar((e) => solicitarDocumento(caso, e, d.id))} disabled={estado.concluido}>
                        Solicitar <Preco custo={CUSTOS.documento} />
                      </button>
                    )}
                  </div>
                  {recebido && <ListaObservacoes aq={recebido} />}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
