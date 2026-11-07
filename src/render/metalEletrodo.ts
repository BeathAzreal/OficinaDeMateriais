import * as THREE from 'three'
import { DepositoEletrodo, baseEletrodo } from '../modelo/depositoEletrodo'

/** H80: micro-relevo de escamas, limitado a 0,06 mm; só acabamento visual. */
export function alturaMetalEletrodo(c:DepositoEletrodo,x:number,y:number){
  const t=c.espessura(x,y)
  const escama=.06*Math.min(1,t/.4)*Math.cos(x*2.5+Math.abs(y)*.7)
  return c.altura(x,y)+.015+escama
}

/** H80: sólido fechado, do fundo da abertura à superfície atual, não um decalque. */
export function criarMetalEletrodo(){
  const nx=150,ny=200,n=nx*ny
  const pos=new Float32Array(n*2*3),cores=new Float32Array(n*2*3)
  const geo=new THREE.BufferGeometry()
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3))
  geo.setAttribute('color',new THREE.BufferAttribute(cores,3))
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:.68})
  const malha=new THREE.Mesh(geo,material);malha.frustumCulled=false;malha.castShadow=malha.receiveShadow=true
  let anterior:DepositoEletrodo|null=null,versao=-1
  return {malha,atualizar(c:DepositoEletrodo){
    if(c===anterior && versao===c.versao)return
    anterior=c;versao=c.versao
    const indices:number[]=[],ativo=new Uint8Array(n)
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const k=j*nx+i,x=c.x(i),y=c.y(j)
      pos.set([x-75,alturaMetalEletrodo(c,x,y),y],k*3)
      pos.set([x-75,baseEletrodo(c.peca,y),y],(k+n)*3)
      const onda=.012*Math.cos(x*2.5+Math.abs(y)*.7),tom=.24+onda
      cores.set([tom*.97,tom,tom*1.04],k*3)
      cores.set([.16,.17,.18],(k+n)*3)
      if(i+1<nx && j+1<ny && c.naPeca(x,y) && c.naPeca(c.x(i+1),c.y(j+1)) &&
        Math.min(c.metal[k],c.metal[k+1],c.metal[k+nx],c.metal[k+nx+1])>.025)ativo[k]=1
    }
    const lateral=(a:number,b:number)=>indices.push(a,b,a+n,b,b+n,a+n)
    for(let j=0;j+1<ny;j++)for(let i=0;i+1<nx;i++){
      const k=j*nx+i;if(!ativo[k])continue
      const a=k,b=k+nx,d=k+1,e=k+nx+1
      indices.push(a,b,d,d,b,e, a+n,d+n,b+n,d+n,e+n,b+n)
      if(i===0 || !ativo[k-1])lateral(b,a)
      if(i===nx-2 || !ativo[k+1])lateral(d,e)
      if(j===0 || !ativo[k-nx])lateral(a,d)
      if(j===ny-2 || !ativo[k+nx])lateral(e,b)
    }
    geo.setIndex(indices);geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;geo.computeVertexNormals()
    malha.visible=indices.length>0
  }}
}
