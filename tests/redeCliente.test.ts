import {describe,it,expect,vi} from 'vitest'
import {ClienteRede} from '../src/rede/cliente'
import {PROTOCOLO_REDE,MODELO_REDE,type SalaRede} from '../src/rede/contrato'
function estado(fase:SalaRede['fase'],agora:number):SalaRede{return{codigo:'ABC234',protocolo:PROTOCOLO_REDE,modelo:MODELO_REDE,config:{processo:'mig',missaoId:'suporte-carbono',dificuldade:'aprendiz'},fase,rodada:1,jogadores:[],agora,inicioEm:100,fimEm:180100,vencedorId:null,motivo:''}}
describe('cliente de rede',()=>{
 it('verifica disponibilidade sem cache e com cancelamento, sem orientar um servidor no PC',async()=>{
  const controle=new AbortController()
  const pedir=vi.fn(async()=>new Response(JSON.stringify({protocolo:PROTOCOLO_REDE,modelo:MODELO_REDE,modo:'internet'})))
  vi.stubGlobal('fetch',pedir)
  try{
   expect((await ClienteRede.verificar('https://oficina.test',controle.signal)).modo).toBe('internet')
   const opcoes=(pedir.mock.calls[0] as unknown as [URL,RequestInit])[1]
   expect(opcoes.cache).toBe('no-store');expect(opcoes.signal).toBeInstanceOf(AbortSignal)
   controle.abort();expect(opcoes.signal?.aborted).toBe(true)
  }finally{vi.unstubAllGlobals()}
 })
 it('explica falhas de rede e de hospedagem com opção de tentar novamente',async()=>{
  try{
   vi.stubGlobal('fetch',vi.fn(async()=>{throw new TypeError('Failed to fetch')}))
   await expect(ClienteRede.verificar('https://oficina.test')).rejects.toThrow('Confira sua conexão')
   vi.stubGlobal('fetch',vi.fn(async()=>new Response('Indisponível',{status:503})))
   await expect(ClienteRede.verificar('https://oficina.test')).rejects.toThrow('serviço de salas')
   vi.stubGlobal('fetch',vi.fn(async()=>new Response('<html>Site estático</html>')))
   await expect(ClienteRede.verificar('https://oficina.test')).rejects.toThrow('não oferece salas online')
  }finally{vi.unstubAllGlobals()}
 })
 it('consulta o estado hospedado usando token no cabeçalho e para ao fechar',async()=>{
  const c=new ClienteRede({codigo:'ABC234',jogadorId:'A',token:'credencial',protocolo:PROTOCOLO_REDE,transporte:'consulta'},'https://oficina.test')
  const pedir=vi.fn(async(_url:RequestInfo|URL,_opcoes?:RequestInit)=>new Response(JSON.stringify(estado('contagem',20))))
  vi.stubGlobal('fetch',pedir);c.aoEstado=()=>c.fechar()
  try{await c.conectar();expect(pedir).toHaveBeenCalledOnce();expect(String(pedir.mock.calls[0]?.[0])).toBe('https://oficina.test/api/salas/ABC234/estado');expect(c.estado?.fase).toBe('contagem')}finally{c.fechar();vi.unstubAllGlobals()}
 })
 it('não volta do jogo à sala por uma resposta atrasada',async()=>{
  const recebidos:string[]=[],c=new ClienteRede({codigo:'ABC234',jogadorId:'A',token:'credencial',protocolo:PROTOCOLO_REDE},'http://servidor.test')
  const estados=[estado('partida',20),estado('espera',10),estado('contagem',21),estado('resultado',30)]
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new ReadableStream({start(ctrl){for(const s of estados)ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(s)}\n\n`));ctrl.close()}}),{status:200})))
  c.aoEstado=s=>{recebidos.push(s.fase);if(s.fase==='resultado')c.fechar()}
  try{await c.conectar();expect(recebidos).toEqual(['partida','resultado'])}finally{c.fechar();vi.unstubAllGlobals()}
 })
 it('rejeita modelo do servidor diferente, sem iniciar uma tentativa',async()=>{
  const c=new ClienteRede({codigo:'ABC234',jogadorId:'A',token:'credencial',protocolo:PROTOCOLO_REDE},'http://servidor.test'),erros:string[]=[]
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(new ReadableStream({start(ctrl){ctrl.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({...estado('partida',20),modelo:'antigo'})}\n\n`));ctrl.close()}}))))
  c.aoConexao=(_,msg)=>erros.push(msg)
  try{await c.conectar();expect(c.estado).toBeNull();expect(erros.join(' ')).toContain('versão')}finally{c.fechar();vi.unstubAllGlobals()}
 })
})
