import { pontosIniciais, type PontoEnsinado } from './celula'
import { condicoesPadrao, type Condicoes } from './condicoes'
import { CELULA_PADRAO, type Celula } from './executor'

/*
 * Primeira missão (H106): parede reta de várias camadas, com o sentido
 * alternado entre camadas. O programa inicial é VÁLIDO e roda, mas não é
 * o melhor: o incremento de camada e a espera foram chutados. A atividade
 * guiada leva a medir a parede, comparar e corrigir.
 */

export const PROGRAMA_INICIAL = `NOP
'PAREDE RETA - 8 CAMADAS EM SENTIDO ALTERNADO
'D000 = SUBIDA ACUMULADA EM MICRONS
SET B000 0
SET D000 0
SETE P000 (1) 0
SETE P000 (2) 0
SETE P000 (3) 0
MOVJ C00000 VJ=25.00
MOVJ C00001 VJ=15.00
*CAMADA
'IDA: DE A PARA B
SFTON P000
MOVL C00001 V=50.0
MOVL C00002 V=20.0
ARCON ASF#(1)
MOVL C00003 V=8.0
ARCOF AEF#(1)
MOVL C00004 V=50.0
SFTOF
ADD D000 2800
SETE P000 (3) D000
TIMER T=20.00
'VOLTA: DE B PARA A
SFTON P000
MOVL C00004 V=50.0
MOVL C00003 V=20.0
ARCON ASF#(1)
MOVL C00002 V=8.0
ARCOF AEF#(1)
MOVL C00001 V=50.0
SFTOF
ADD D000 2800
SETE P000 (3) D000
TIMER T=20.00
INC B000
JUMP *CAMADA IF B000<4
MOVJ C00000 VJ=25.00
END`

export interface ProjetoManufatura {
  programa: string
  pontos: PontoEnsinado[]
  condicoes: Condicoes
  celula: Celula
}

export function projetoInicial(): ProjetoManufatura {
  return { programa: PROGRAMA_INICIAL, pontos: pontosIniciais(), condicoes: condicoesPadrao(), celula: { ...CELULA_PADRAO } }
}

/**
 * Modo livre (teste): sem missão, sem nota. Começa com um cordão só, de A a
 * B, para o jogador ter de onde partir; o resto é com ele.
 */
export const PROGRAMA_LIVRE = `NOP
'MODO LIVRE: SEM MISSAO E SEM NOTA
'UM CORDAO DE A ATE B. MUDE A VONTADE.
MOVJ C00000 VJ=25.00
MOVJ C00001 VJ=15.00
MOVL C00002 V=20.0
ARCON ASF#(1)
MOVL C00003 V=8.0
ARCOF AEF#(1)
MOVL C00004 V=50.0
MOVJ C00000 VJ=25.00
END`

export function projetoLivre(): ProjetoManufatura {
  return { ...projetoInicial(), programa: PROGRAMA_LIVRE }
}
