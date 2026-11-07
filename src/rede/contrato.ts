import { MISSOES, contextoDaMissao, preparoPadrao, type Dificuldade } from '../missoes/catalogo'
import { AJUSTES_PADRAO } from '../modelo/processo'
import { VERSAO_PONTUACAO, type ResultadoPontuacao } from '../pontuacao/regras'
import type { EventosCompactos } from '../dados/eventos'

export const PROTOCOLO_REDE='soldagem-rede-2.0.0'
export const MODELO_REDE=VERSAO_PONTUACAO
export const MISSOES_REDE=MISSOES.filter(m=>m.material==='aco-carbono')
export type FaseRede='espera'|'contagem'|'partida'|'resultado'|'encerrada'
export type EstadoJogador='preparando'|'pronto'|'soldando'|'entregou'|'abandonou'|'tempo-esgotado'
export interface ConfigRede {processo:'mig';missaoId:string;dificuldade:Dificuldade}
export interface CredencialRede {codigo:string;jogadorId:string;token:string;protocolo:string;transporte?:'consulta'}
export interface EntregaRede {eventos:EventosCompactos;resultado:ResultadoPontuacao}
export interface JogadorRede {id:string;nome:string;anfitriao:boolean;conectado:boolean;estado:EstadoJogador;revanche:boolean;entrega:EntregaRede|null}
export interface SalaRede {
 codigo:string;protocolo:string;modelo:string;config:ConfigRede;fase:FaseRede;rodada:number;
 jogadores:JogadorRede[];agora:number;inicioEm:number|null;fimEm:number|null;vencedorId:string|null;motivo:string
}
export type ComandoRede =
 | {tipo:'pronto';rodada:number;pronto:boolean}
 | {tipo:'entregar';rodada:number;eventos:EventosCompactos}
 | {tipo:'sair'} | {tipo:'revanche';rodada:number}
export function configuracaoRede(c:ConfigRede){
 const missao=MISSOES_REDE.find(m=>m.id===c.missaoId)
 if(c.processo!=='mig' || !missao || !['aprendiz','profissional'].includes(c.dificuldade))throw new Error('Missão ou dificuldade indisponível nesta versão do duelo.')
 const preparo={...preparoPadrao(missao),oxidoRemovido:true}
 return {missao,preparo,contexto:contextoDaMissao(missao,preparo),ajustes:{...AJUSTES_PADRAO}}
}
