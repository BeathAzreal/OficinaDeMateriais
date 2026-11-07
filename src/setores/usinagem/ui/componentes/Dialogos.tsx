import { useEffect, useRef, type ReactNode } from 'react';
import { LIMITACOES_RA } from './PainelMedicao';

export function Dialogo({ titulo, aberto, onFechar, children }: { titulo: string; aberto: boolean; onFechar(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog ref={ref} className="dialogo" onClose={onFechar} aria-labelledby="dialogo-titulo">
      <div className="dialogo-cabecalho">
        <h2 id="dialogo-titulo">{titulo}</h2>
        <button type="button" className="botao" onClick={onFechar} aria-label="Fechar">
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function SobreModelo() {
  return (
    <div className="painel-conteudo">
      <p>
        <strong>Usinagem</strong> é um simulador didático de torno CNC com um <strong>modelo simplificado</strong>. São exatas só as relações geométricas e
        cinemáticas: vc = π·D·n/1000, vf = f·n, ΔD = 2·ap, tc = percurso/vf e, na furação, o comprimento da ponta lp = (d/2)/tan(σ/2). Força, deflexão,
        desgaste, cavaco, rugosidade, quebra de broca e todos os dados de materiais e ferramentas são <strong>sintéticos</strong>. Eles mostram tendências
        coerentes, sem validação experimental. Não use esses números como recomendação de operação.
      </p>
      <h3>O que está implementado</h3>
      <ul className="lista-compacta">
        <li>Torneamento externo longitudinal e furação axial no centro (broca parada na torre, peça girando).</li>
        <li>Corte só onde há material: o que foi removido não volta.</li>
        <li>Deflexão quase estática (sistema + peça em balanço, com E do material e furo na seção).</li>
        <li>Desgaste por fração de vida com curvas diferentes para metal duro e aço rápido, casca de fornecimento abrasiva e recuo da ponta.</li>
        <li>Lascamento de inserto e quebra de broca determinísticos, por carga acima do limite sintético.</li>
        <li>Furação: gume transversal (força de avanço maior em furo maciço), entupimento do canal em furo fundo e pica-pau.</li>
        <li>Ra estimada = parcela geométrica + parcelas sintéticas. Cavaco classificado pelo material e pela ferramenta.</li>
      </ul>
      <h3>O que não está implementado</h3>
      <ul className="lista-compacta">
        <li>Vibração, temperatura, dilatação, fluido de corte, revestimento, desgaste de cratera e de entalhe, desgaste adesivo em vc baixa.</li>
        <li>Desvio de broca sem centro, conicidade e ovalização do furo, rebarba na saída, raio no canto do ressalto.</li>
        <li>Faceamento, canais, roscas, perfis e compensação de raio. O código ISO é só ilustrativo, e o programa é editado por campos.</li>
        <li>Potência do motor, velocidade de corte constante (G96), erros geométricos da máquina e do zeramento.</li>
      </ul>
      <h3>Rugosidade</h3>
      <ul className="lista-compacta">
        {LIMITACOES_RA.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="nota">As fórmulas, hipóteses e a tabela de parâmetros estão em docs/MODELO.md.</p>
    </div>
  );
}

export interface PassoTutorial {
  aba: string;
  titulo: string;
  texto: string;
}

export const PASSOS_TUTORIAL: PassoTutorial[] = [
  {
    aba: 'peca',
    titulo: '1. Peça e material',
    texto:
      'Em PEÇA você vê a encomenda (desenho, tolerâncias, material) ou, no modo livre, escolhe o material, o diâmetro do tarugo e o balanço. A ficha mostra a microestrutura e quais dados são sintéticos.',
  },
  {
    aba: 'ferramentas',
    titulo: '2. Torre de ferramentas',
    texto:
      'A torre tem 6 estações (T01 a T06) com insertos de tornear e brocas. Cada uma tem o próprio desgaste. Você pode trocar a aresta ou montar outra ferramenta.',
  },
  {
    aba: 'programa',
    titulo: '3. Programa',
    texto:
      'Monte o programa em blocos: torneamento (S, F, ap, L), furação (S, F, P, pica-pau) e paradas M00. A vc é calculada a partir do diâmetro e da rotação; ap é medida no raio, e o diâmetro cai 2·ap. A listagem ISO mostra o mesmo programa.',
  },
  {
    aba: 'programa',
    titulo: '4. Ciclo início',
    texto:
      'CICLO INÍCIO executa o programa a partir do cursor (▶). Cada bloco já sai calculado; o torno mostra o movimento e o DRO mostra X, Z, S, F e T. Em “Bloco a bloco”, a máquina para depois de cada bloco. A velocidade de simulação muda só a apresentação.',
  },
  {
    aba: 'medicao',
    titulo: '5. Medir e corrigir',
    texto:
      'Em MEDIÇÃO, meça diâmetros externos, furos, comprimento e profundidade, e compare o perfil com o desenho. Depois ajuste os próximos blocos. Material removido não volta. Na encomenda, a ENTREGA traz a devolutiva.',
  },
];

export function Tutorial({ passo, onPasso, onFechar }: { passo: number; onPasso(n: number): void; onFechar(): void }) {
  const p = PASSOS_TUTORIAL[passo];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [passo]);
  return (
    <div className="tutorial" role="dialog" aria-modal="false" aria-labelledby="tutorial-titulo" tabIndex={-1} ref={ref}>
      <p className="rotulo-pequeno">
        Tutorial · {passo + 1} de {PASSOS_TUTORIAL.length}
      </p>
      <h2 id="tutorial-titulo">{p.titulo}</h2>
      <p>{p.texto}</p>
      <div className="acoes">
        <button type="button" className="botao" onClick={onFechar}>
          Pular tutorial
        </button>
        {passo > 0 && (
          <button type="button" className="botao" onClick={() => onPasso(passo - 1)}>
            ← Anterior
          </button>
        )}
        {passo < PASSOS_TUTORIAL.length - 1 ? (
          <button type="button" className="botao primario" onClick={() => onPasso(passo + 1)}>
            Próximo →
          </button>
        ) : (
          <button type="button" className="botao primario" onClick={onFechar}>
            Começar
          </button>
        )}
      </div>
    </div>
  );
}
