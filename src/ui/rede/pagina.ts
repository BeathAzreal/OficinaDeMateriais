import type { Tela } from '../app'
import { h } from '../dom'
import '../../menu-grafico.css'
import '../../rede.css'

export function paginaRede(titulo:string,subtitulo:string,conteudo:HTMLElement,rodape?:HTMLElement):Tela{
 return app=>{
  document.body.classList.add('menu-grafico')
  app.raiz.classList.add('tela-inicio','rede-pagina')
  app.raiz.append(h('header',{class:'grafico-titulo'},h('p',{},subtitulo),h('h2',{class:'tela-titulo',tabindex:'-1'},titulo)),
   h('span',{class:'grafico-versao'},'ALPHA / 2.2'),conteudo,...(rodape?[rodape]:[]))
  return ()=>{document.body.classList.remove('menu-grafico');app.raiz.classList.remove('rede-pagina')}
 }
}
export function botaoRede(texto:string,acao:()=>void,primario=false){return h('button',{type:'button',class:primario?'primario':'',on:{click:acao}},texto)}
