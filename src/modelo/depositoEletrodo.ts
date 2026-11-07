import type { PecaEletrodo } from '../missoes/pecasEletrodo'
import { limitesPecaEletrodo } from '../missoes/pecasEletrodo'
import { faceRaizMm, INFO_JUNTA, pontoNaSuperficie } from './juntas'

/** H79: altura real do metal-base; o fundo aberto usa uma raiz retentora didática. */
export function baseEletrodo(p: PecaEletrodo, y: number): number {
  if (INFO_JUNTA[p.junta].familia === 'filete') return pontoNaSuperficie(p.junta,p,y)[1]
  const n=Math.abs(y), a=p.aberturaMm/2
  if (p.junta==='topo') return n<a ? -p.espessuraMm : 0
  if(n<=a) return -p.espessuraMm
  return Math.min(0,-p.espessuraMm+faceRaizMm(p)+(n-a)/Math.tan(Math.PI/6))
}

export interface CamadaDeposito { passe:number; tInicioMs:number; espessuraMm:number; vale:number; fundiu:boolean|null }

/** H96: tempo sem receber metal para a célula contar como solidificada (ms). */
export const SOLIDIFICA_MS=2000

/** Depósito SMAW em células locais: sem deslocar metal para uma junta pré-fixada. */
export class DepositoEletrodo {
  readonly nx=150
  readonly ny=200
  readonly dx=1
  readonly dy=.5
  readonly metal=new Float64Array(this.nx*this.ny)
  /** H96: metal já solidificado em cada célula (passes anteriores) e quando a célula recebeu metal pela última vez (ms). */
  readonly solido=new Float64Array(this.nx*this.ny)
  private readonly tDeposito=new Float64Array(this.nx*this.ny).fill(-Infinity)
  /**
   * H97: camadas de cada célula, de baixo para cima. Uma camada nova começa quando a célula
   * recebe metal depois de solidificada. `vale` é quanto a célula estava abaixo do metal frio
   * mais alto ao redor quando a camada começou (mm); `fundiu` é decidido pela análise (null = ainda não).
   */
  readonly camadas=new Map<number,CamadaDeposito[]>()
  /** Passe atual: muda quando nada foi depositado em lugar nenhum por SOLIDIFICA_MS. */
  passe=0
  private ultimoMs=-Infinity
  readonly limitesX
  readonly alcanceY
  versao=0
  private volume=0
  constructor(readonly peca:PecaEletrodo){
    this.limitesX=limitesPecaEletrodo(peca)
    this.alcanceY=INFO_JUNTA[peca.junta].familia==='filete'?50/Math.SQRT2:50
  }
  x(i:number){return (i+.5)*this.dx}
  /** Índice da célula mais perto de (x, y). */
  celula(x:number,y:number){return Math.max(0,Math.min(this.ny-1,Math.round((y+50)/this.dy-.5)))*this.nx+Math.max(0,Math.min(this.nx-1,Math.round(x/this.dx-.5)))}
  y(j:number){return -50+(j+.5)*this.dy}
  naPeca(x:number,y:number){return x>=this.limitesX.min && x<=this.limitesX.max && Math.abs(y)<=this.alcanceY}
  private amostrar(x:number,y:number,absoluta=false):number {
    if(!this.naPeca(x,y))return 0
    const u=Math.max(0,Math.min(this.nx-1,x/this.dx-.5)),v=Math.max(0,Math.min(this.ny-1,(y+50)/this.dy-.5))
    const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j
    const q=(i:number,j:number)=>{
      i=Math.min(this.nx-1,i);j=Math.min(this.ny-1,j)
      return this.metal[j*this.nx+i]+(absoluta?baseEletrodo(this.peca,this.y(j)):0)
    }
    return q(i,j)*(1-a)*(1-b)+q(i+1,j)*a*(1-b)+q(i,j+1)*(1-a)*b+q(i+1,j+1)*a*b
  }
  espessura(x:number,y:number){return this.amostrar(x,y)}
  altura(x:number,y:number){
    // Interpole a altura absoluta, como os triângulos do 3D, sem somar o fundo outra vez na borda.
    return this.espessura(x,y)>1e-9?this.amostrar(x,y,true):baseEletrodo(this.peca,y)
  }
  volumeTotal(){return this.volume}
  /**
   * H95 (v2.0): largura do cordão (mm) que o passe deixa. Mesma escala do
   * modelo anterior (4 desvios-padrão da gaussiana de antes): cresce com o
   * diâmetro do eletrodo, com o arco longo (razão menor, H69) e com a
   * instabilidade do arco.
   */
  larguraPasse(razao=.25,instabilidade=0):number{
    const sigma=Math.max(.8,Math.min(1.8,1.05+(.25-razao)*2+Math.abs(instabilidade)*.4))
    return 4*sigma*this.peca.diametroMm/2.5
  }
  /**
   * Depósito local (H79). H95 (v2.0): a seção transversal do passe é a parábola
   * de Banaee et al. (2023, eq. 1), y = h(1 − 4n²/w²), em vez de uma gaussiana.
   * Ao longo do avanço o metal se espalha um pouco (sx), só para não ficar em
   * degraus; somando os pontos de um passe reto, o corte sai parabólico.
   * O volume entra inteiro e uma vez só: os pesos são normalizados.
   */
  depositar(x:number,y:number,volume:number,_agora=0,razao=.25,_oscilacao=0,instabilidade=0,larguraMm?:number){
    if(volume<=0 || !this.naPeca(x,y))return
    if(_agora-this.ultimoMs>SOLIDIFICA_MS || this.passe===0)this.passe++
    this.ultimoMs=_agora
    const sx=1.2,meia=Math.max(this.dy,(larguraMm??this.larguraPasse(razao,instabilidade))/2)
    const celulas:{k:number;peso:number;altura:number}[]=[]
    let minimo=Infinity
    for(let j=Math.max(0,Math.floor((y+50-meia)/this.dy));j<=Math.min(this.ny-1,Math.ceil((y+50+meia)/this.dy));j++)
      for(let i=Math.max(0,Math.floor(x-3*sx));i<=Math.min(this.nx-1,Math.ceil(x+3*sx));i++){
        const cx=this.x(i),cy=this.y(j)
        if(!this.naPeca(cx,cy))continue
        const ax=((cx-x)/sx)**2,n=(cy-y)/meia,perfil=1-n*n
        if(ax>9 || perfil<=0)continue
        const k=j*this.nx+i,base=baseEletrodo(this.peca,cy),altura=base+this.metal[k]
        // H96: metal que não recebe nada há mais de SOLIDIFICA_MS já endureceu.
        if(_agora-this.tDeposito[k]>SOLIDIFICA_MS)this.solido[k]=this.metal[k]
        minimo=Math.min(minimo,altura)
        celulas.push({k,peso:Math.exp(-.5*ax)*perfil,altura})
      }
    // Só o metal novo molha o entorno imediato; não move cordões frios nem salta para a raiz.
    let soma=0
    // Dentro da junta (abaixo da face) o metal novo procura os pontos baixos: enche a abertura e o chanfro.
    // H95: acima da face vale só a parábola (a coroa não é achatada). No filete, o nível é o do canto.
    const nivel=Math.min(0,alvoEletrodo(this.peca).altura)
    // H96: acima da face, o passe novo assenta a sua parábola sobre a superfície que encontra (passes
    // anteriores incluídos), sem regra extra de escorrimento: a soma já dá vale, plano ou morro conforme
    // a distância entre passes, como nos ensaios de Banaee et al. (2023, Fig. 10 e 13).
    for(const c of celulas){c.peso/=1+2*Math.max(0,Math.min(nivel,c.altura)-Math.min(nivel,minimo));soma+=c.peso}
    if(!soma)return
    // H97: vale entre passes = metal já depositado e frio, mais alto dos DOIS lados (na mesma seção x).
    const frioDe=(c:{k:number;altura:number})=>c.altura-this.metal[c.k]+this.solido[c.k]
    const valeEm=(c:{k:number;altura:number})=>{
      const i=c.k%this.nx,j=Math.floor(c.k/this.nx),f=frioDe(c)
      let esq=-Infinity,dir=-Infinity
      for(const o of celulas){
        // Só metal depositado e já frio forma as paredes do vale: a chapa e a abertura da junta não contam.
        if(o.k%this.nx!==i || this.solido[o.k]<0.05)continue
        const jo=Math.floor(o.k/this.nx)
        if(jo<j)esq=Math.max(esq,frioDe(o));else if(jo>j)dir=Math.max(dir,frioDe(o))
      }
      return Math.max(0,Math.min(esq,dir)-f)
    }
    for(const c of celulas){
      const mm=volume*c.peso/soma/(this.dx*this.dy)
      const lista=this.camadas.get(c.k) ?? []
      const ultima=lista[lista.length-1]
      if(!ultima || _agora-this.tDeposito[c.k]>SOLIDIFICA_MS){
        lista.push({passe:this.passe,tInicioMs:_agora,espessuraMm:0,vale:lista.length?valeEm(c):0,fundiu:null})
        this.camadas.set(c.k,lista)
      }
      lista[lista.length-1].espessuraMm+=mm
      this.metal[c.k]+=mm;this.tDeposito[c.k]=_agora
    }
    this.volume+=volume;this.versao++
  }
}

/** A região avaliada vem do trabalho solicitado, não da altura global da chapa. */
export function alvoEletrodo(p:PecaEletrodo){
  const filete=INFO_JUNTA[p.junta].familia==='filete',raiz=p.junta==='v'
  // H91: cordão sobre chapa — miolo de um diâmetro de largura com pelo menos 1,5 mm de altura.
  if(p.sobreChapa)return {raiz:false,filete:false,meia:p.diametroMm/2,faixa:p.diametroMm+2,altura:1.5,descricao:'Cordão em relevo sobre a chapa (pelo menos 1,5 mm de altura no miolo, sem falhas)'}
  const meia=filete?2.8:Math.max(.6,p.aberturaMm/2)
  return {raiz,filete,meia,faixa:meia+2,
    altura:raiz?-p.espessuraMm+2:filete?2.8:0,
    descricao:raiz?'Passe de raiz no fundo do chanfro (camada de 2 mm)':filete?'Filete no canto entre as duas chapas (perna-alvo 4 mm)':'União e preenchimento da abertura até a face das chapas',
  }
}

export function trechoEletrodo(c:DepositoEletrodo,x:number){
  const a=alvoEletrodo(c.peca)
  let progresso=0,unidos=0
  for(let k=0;k<9;k++){
    const y=(-.9+1.8*k/8)*a.meia,base=baseEletrodo(c.peca,y),metal=c.espessura(x,y)
    const falta=Math.max(.2,a.altura-base)
    progresso+=metal>.001?Math.max(0,Math.min(1,(c.altura(x,y)-base)/falta))/9:0
    if(metal>.1 && c.altura(x,y)>=a.altura-.2)unidos++
  }
  // As duas bordas precisam estar unidas: só o centro cheio não conta como junta completa.
  return {progresso,coberto:unidos===9}
}
