import { SalasHospedadas,type BancoSalas } from './hospedado'

export function criarWorker(pagina:string){
 return {async fetch(r:Request,env:{DB?:BancoSalas}){
  const url=new URL(r.url)
  if(url.pathname.startsWith('/api/')){
   if(!env.DB)return Response.json({erro:'O serviço de salas online está temporariamente indisponível.'},{status:503,headers:{'Cache-Control':'no-store'}})
   return new SalasHospedadas(env.DB).responder(r)
  }
  if(!['GET','HEAD'].includes(r.method))return new Response('Método não permitido.',{status:405})
  if(url.pathname!=='/'&&url.pathname!=='/index.html')return new Response('Não encontrado.',{status:404})
  return new Response(r.method==='HEAD'?null:pagina,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}})
 }}
}
