import {cpSync,existsSync,mkdirSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs'
import {dirname,join,resolve,sep} from 'node:path'
import {spawnSync} from 'node:child_process'
import {gravarAtalhoOnline} from './atalho-online.mjs'
import {OFICINA_ONLINE} from '../src/rede/convite.ts'

const projeto=process.cwd(),raiz=resolve('pacote-v22'),saida=join(raiz,'Oficina-de-Soldagem-v2.2')
const portatil=resolve('portatil/Oficina de Soldagem v2.2')
const rede=resolve('pacote-rede/Oficina-de-Soldagem-v2.2-Rede')
const zip=resolve('Oficina-de-Soldagem-Alpha-v2.2.zip')
if(process.platform!=='win32')throw Error('A geração deste ZIP Windows x64 usa a biblioteca ZIP do Windows.')
if(dirname(saida)!==raiz||!saida.startsWith(resolve(projeto)+sep))throw Error('Destino do pacote fora do projeto.')
for(const arquivo of[join(portatil,'Oficina de Soldagem.html'),join(rede,'runtime/node.exe'),join(rede,'servidor/index.js')]){
 if(!existsSync(arquivo))throw Error('Gere primeiro o portátil e o pacote de rede: falta '+arquivo)
}
if(existsSync(saida))rmSync(saida,{recursive:true,force:true})
mkdirSync(saida,{recursive:true})
cpSync(portatil,saida,{recursive:true})
cpSync(rede,join(saida,'servidor-local'),{recursive:true})
gravarAtalhoOnline(saida)
writeFileSync(join(saida,'NOTAS DA VERSAO.txt'),readFileSync(join(portatil,'LEIA-ME.txt')))
writeFileSync(join(saida,'LEIA-ME.txt'),`OFICINA DE SOLDAGEM — ALPHA v2.2

Extraia a pasta inteira antes de abrir qualquer arquivo.

1. JOGAR ONLINE (opção principal)
Abra JOGAR ONLINE.html. Ele abre ${OFICINA_ONLINE}/?rede=1.
Não precisa iniciar Node.js, .bat ou servidor no PC. Precisa de internet.
Crie uma sala e compartilhe o convite. O x1 online é para duas pessoas em MIG/MAG.

2. TREINAR OFFLINE
Abra Oficina de Soldagem.html no Chrome ou Edge. Abrir o jogo.bat também abre esse HTML.
Funciona sem internet e sem servidor. Os recordes ficam no navegador, não na pasta.
Antes de trocar de pasta ou navegador, exporte os recordes que quiser preservar.

3. SERVIDOR LOCAL DE RESERVA
A pasta servidor-local contém o servidor, os arquivos do jogo, o Node.js portátil
para Windows x64, sua licença e o manifesto com SHA-256 conferido.
Use apenas se quiser jogar em rede local: abra servidor-local/ABRIR-OFICINA.bat
no PC anfitrião e mantenha sua janela aberta. Não exige instalar Node.js.
No outro PC, abra o endereço com IP mostrado pelo servidor, não localhost.
Os PCs precisam se alcançar na rede e a porta 5197 precisa estar permitida.
As políticas do Windows e da rede continuam valendo para esse modo de reserva.
Detalhes em servidor-local/LEIA-ME.txt.

Notas da versão: NOTAS DA VERSAO.txt.
Modelo didático qualitativo: os números não são uma receita de soldagem.
`.replace(/\n/g,'\r\n'),'utf8')
if(dirname(zip)!==resolve(projeto))throw Error('ZIP fora do projeto.')
if(existsSync(zip))rmSync(zip)
const resultado=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:OFICINA_PACOTE_ENTRADA,$env:OFICINA_PACOTE_ZIP,[System.IO.Compression.CompressionLevel]::Optimal,$true)'],{
 stdio:'inherit',windowsHide:true,env:{...process.env,OFICINA_PACOTE_ENTRADA:saida,OFICINA_PACOTE_ZIP:zip}
})
if(resultado.error)throw resultado.error
if(resultado.status!==0)throw Error('Não foi possível gerar o ZIP completo.')
if(statSync(zip).size>=100*1024*1024)throw Error('ZIP ultrapassou o limite de 100 MiB para publicação no GitHub.')
console.log(`Pacote completo: ${zip} (${(statSync(zip).size/1024/1024).toFixed(1)} MiB)`)
