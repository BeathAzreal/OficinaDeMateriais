import { EstacaoVisual } from './estacoes/EstacaoVisual';
import { EstacaoMetalografia } from './estacoes/EstacaoMetalografia';
import { EstacaoMicrodureza } from './estacoes/EstacaoMicrodureza';

export type Estacao = 'visual' | 'metalografia' | 'microdureza';

export function Ensaios({ estacao, onEstacao, superficieInicial }: { estacao: Estacao; onEstacao: (e: Estacao) => void; superficieInicial?: string }) {
  return (
    <div className="ensaios">
      <nav className="sub-abas" aria-label="Estações de ensaio">
        <button className={estacao === 'visual' ? 'ativa' : ''} onClick={() => onEstacao('visual')}>
          🔍 Inspeção visual e fratura
        </button>
        <button className={estacao === 'metalografia' ? 'ativa' : ''} onClick={() => onEstacao('metalografia')}>
          🔬 Metalografia
        </button>
        <button className={estacao === 'microdureza' ? 'ativa' : ''} onClick={() => onEstacao('microdureza')}>
          ◇ Microdureza
        </button>
      </nav>
      {estacao === 'visual' && <EstacaoVisual key={superficieInicial ?? 'padrao'} superficieInicial={superficieInicial} />}
      {estacao === 'metalografia' && <EstacaoMetalografia />}
      {estacao === 'microdureza' && <EstacaoMicrodureza />}
    </div>
  );
}
