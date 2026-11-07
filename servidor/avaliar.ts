import { eventosValidos, type EventosCompactos } from '../src/dados/eventos'
import { configuracaoRede, type ConfigRede } from '../src/rede/contrato'
import { pontuarRegistro } from '../src/pontuacao/oficial'

export function conferirRegistro(dados:unknown,limiteMs:number,decorridoMs:number):EventosCompactos{
 if(!eventosValidos(dados) || !Number.isFinite(dados.t0) || dados.lista.length<2 || dados.lista.length>16000)throw new Error('Registro de soldagem inválido ou grande demais.')
 let anterior=-1,aberto=false,aberturas=0,distancia=0,ultimo:{x:number;y:number}|null=null
 for(const e of dados.lista){
  if(e[0]==='a'){
   if(e[1]<1||e[1]>10||e[2]<1||e[2]>10)throw new Error('Regulagem fora da faixa da máquina.')
  }else if(e[0]==='p'){
   if(aberto || e[1]<0 || e[1]>180 || Math.abs(e[2])>360)throw new Error('Posição da peça inválida.')
  }else{
   const [tipo,t,x,y]=e
   if(t<0 || t<anterior || t>limiteMs+100 || t>decorridoMs+1500 || Math.abs(x)>2000 || Math.abs(y)>2000)throw new Error('Trajetória ou tempo incompatível com a partida.')
   if(tipo==='i'){if(aberto)throw new Error('Arco aberto duas vezes.');aberto=true;aberturas++}
   else if(!aberto)throw new Error('Trajetória sem arco aberto.')
   if(ultimo)distancia+=Math.hypot(x-ultimo.x,y-ultimo.y)
   if(distancia>50000)throw new Error('Trajetória excessiva.')
   if(tipo==='f')aberto=false
   anterior=t;ultimo={x,y}
  }
 }
 if(aberto || !aberturas || anterior<=0)throw new Error('Feche o arco antes de entregar a tentativa.')
 return {versao:1,t0:0,lista:dados.lista.map(e=>[...e]) as EventosCompactos['lista']}
}
export function avaliarRegistroRede(config:ConfigRede,dados:unknown,limiteMs:number,decorridoMs:number){
 const eventos=conferirRegistro(dados,limiteMs,decorridoMs),c=configuracaoRede(config)
 const {resultado}=pontuarRegistro(c.missao,config.dificuldade,c.contexto,eventos)
 if(!Number.isFinite(resultado.total) || resultado.total<0 || resultado.total>1000)throw new Error('O registro não produziu uma nota válida.')
 return {eventos,resultado}
}
