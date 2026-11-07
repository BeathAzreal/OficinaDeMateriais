import {gravarAtalhoOnline} from './atalho-online.mjs'
import {OFICINA_ONLINE} from '../src/rede/convite.ts'
import {createHash} from 'node:crypto'
import {mkdirSync,cpSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs'
import {resolve,join,dirname,sep} from 'node:path'
const manifesto=JSON.parse(readFileSync('licencas/node-runtime.json','utf8').replace(/^\uFEFF/,''))
const executavel=resolve(process.env.NODE_PORTATIL??process.execPath)
const hash=createHash('sha256').update(readFileSync(executavel)).digest('hex')
if(hash!==manifesto.sha256)throw Error('Para gerar o pacote Windows x64, NODE_PORTATIL deve apontar ao node.exe oficial '+manifesto.versao+'. O jogo entregue já inclui esse runtime.')
const raiz=resolve('pacote-rede'),saida=join(raiz,'Oficina-de-Soldagem-v2.2-Rede')
if(dirname(saida)!==raiz || !saida.startsWith(resolve(process.cwd())+sep))throw Error('Destino do pacote fora do projeto.')
if(existsSync(saida))rmSync(saida,{recursive:true,force:true})
mkdirSync(join(saida,'servidor'),{recursive:true})
cpSync('dist',join(saida,'dist'),{recursive:true})
cpSync('dist-servidor/index.js',join(saida,'servidor/index.js'))
mkdirSync(join(saida,'runtime'),{recursive:true})
cpSync(executavel,join(saida,'runtime/node.exe'))
cpSync(join('licencas',manifesto.licenca),join(saida,'runtime/LICENSE.txt'))
writeFileSync(join(saida,'runtime/ORIGEM.json'),JSON.stringify(manifesto,null,2))
writeFileSync(join(saida,'package.json'),JSON.stringify({private:true,type:'module',version:'2.2.0',engines:{node:'>=22'}},null,2))
const bat=`@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
if not exist "%~dp0runtime\\node.exe" (
 echo Extraia o pacote completo antes de abrir o jogo. A pasta runtime deve ficar junto do lancador.
 pause
 exit /b 1
)
set ABRIR_NAVEGADOR=1
if "%SEM_ABRIR_NAVEGADOR%"=="1" set ABRIR_NAVEGADOR=0
"%~dp0runtime\\node.exe" servidor\\index.js
pause
`
writeFileSync(join(saida,'INICIAR-REDE.bat'),bat.replace(/\n/g,'\r\n'))
writeFileSync(join(saida,'ABRIR-OFICINA.bat'),bat.replace(/\n/g,'\r\n'))
writeFileSync(join(saida,'ABRIR-NESTE-PC.url'),'[InternetShortcut]\r\nURL=http://localhost:5197/?rede=1\r\n')
const leia=`OFICINA DE SOLDAGEM v2.2 — X1 EM REDE LOCAL

1. Extraia esta pasta inteira no PC que hospedará a sala.
2. Não é preciso instalar Node.js ou outros programas. Este pacote Windows x64 já inclui o servidor e o runtime necessário. O outro PC só precisa do navegador.
3. Execute ABRIR-OFICINA.bat. O jogo abre no navegador e inicia o servidor automaticamente. Mantenha a janela do servidor aberta. INICIAR-REDE.bat continua disponível como alternativa.
4. Se o navegador não abrir automaticamente, use ABRIR-NESTE-PC.url ou http://localhost:5197/?rede=1.
5. No segundo PC, use um dos endereços com IP mostrados na janela do servidor, acrescentando ?rede=1. Exemplo ilustrativo: http://192.168.0.10:5197/?rede=1. Localhost não serve para acessar o outro computador.
6. Os dois PCs precisam se alcançar pela rede. Se a rede da faculdade isolar os aparelhos ou bloquear a porta, peça à TI para liberar o acesso local ao servidor na porta 5197. Não é preciso abrir portas do roteador para a internet.

PARTIDA
O anfitrião escolhe missão e dificuldade e cria a sala. O segundo jogador entra com o código de seis caracteres. Cada um usa seu apelido. Quando os dois confirmarem prontidão, a contagem inicia a disputa.
Nesta etapa o processo é MIG/MAG, com a mesma preparação e regulagem inicial para ambos. O eletrodo e a física anteriores foram preservados.
Segure o botão esquerdo para soldar; feche o arco e use Encerrar tentativa ou Enter para entregar. Há três minutos por rodada, contados pelo servidor. Pausar não interrompe esse prazo. Não entregar no prazo vale zero.
O servidor reproduz o registro e calcula 0 a 1000 pontos. A maior nota vence; notas iguais empatam. Abandono ou perda de conexão por mais de 30 segundos pode decidir por W/O. Revanche exige a confirmação dos dois.
Recarregar a página durante uma tentativa interrompe a participação. Queda rápida da rede tenta reconectar sem criar outro jogador. Reiniciar o servidor apaga as salas, que ficam apenas em memória.

USO OFFLINE
Os outros modos continuam no mesmo jogo. O pacote HTML portátil separado pode ser aberto sem servidor, mas o x1 precisa desta conexão local.

ONLINE SEM SERVIDOR LOCAL
Para jogar pela internet, abra JOGAR ONLINE.html ou ${OFICINA_ONLINE}/?rede=1. Nesse modo, nenhum jogador precisa iniciar este servidor. Crie a sala e compartilhe o convite. Este pacote local é apenas uma alternativa para a mesma rede. PORT muda a porta local (padrão 5197) e HOST a interface local (padrão 0.0.0.0).

RUNTIME INCLUÍDO
A pasta runtime contém o executável oficial do Node.js para Windows x64, a licença integral e a origem com hash SHA-256 conferido. Não é necessário instalar ou configurar o runtime no computador.

VALIDAÇÃO
Consulte docs/REDE-V17.md no código-fonte para testes e limitações. Dois clientes automatizados na mesma máquina não substituem o teste físico na rede da faculdade.
`
writeFileSync(join(saida,'LEIA-ME.txt'),leia.replace(/\n/g,'\r\n'))
if(existsSync('portatil/Oficina de Soldagem v2.2/Oficina de Soldagem.html'))cpSync('portatil/Oficina de Soldagem v2.2/Oficina de Soldagem.html',join(saida,'Oficina-de-Soldagem-v2.2-offline.html'))
gravarAtalhoOnline(saida)
console.log(`Pacote de rede gerado: ${saida}`)
