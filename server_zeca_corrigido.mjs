import express from 'express';
import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const app=express(),server=createServer(app),wss=new WebSocketServer({server,path:'/ws'});
const root=path.dirname(fileURLToPath(import.meta.url));
const indexPath=path.join(root,'index.html');
app.use(express.json({limit:'8kb'}));
app.get('/',(_req,res)=>{
  if(!existsSync(indexPath)){
    console.error('ARQUIVO AUSENTE: index.html na raiz do projeto:',indexPath);
    return res.status(500).type('text/plain').send('Arquivo index.html nao encontrado na raiz do projeto. Verifique o nome no GitHub.');
  }
  res.sendFile(indexPath);
});
app.use(express.static(root));
const username=(process.env.TIKTOK_USERNAME||'').replace(/^@/,'').trim();
const adminKey=process.env.ADMIN_KEY||'';
let status='Modo demonstração',connected=false,lastComment='',lastChatAt=null,conn=null,retryTimer=null,connecting=false;
let queue=[],processing=false,seq=0,lastAnswer='',lastActivity=Date.now(),idleIndex=0;
let aiStatus='não testada',aiLastError=null,aiLastAttempt=null,aiLastSuccess=null;
const clients=new Map(),cooldowns=new Map();
const clean=(s,n=180)=>String(s||'').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,n);
const recentEvents=[];let eventSeq=0;
function broadcast(data){if(data.type==='answer'||data.type==='question'||data.type==='gift'){recentEvents.push({...data,eventSeq:++eventSeq});if(recentEvents.length>80)recentEvents.shift()}const str=JSON.stringify(data);for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(str)}
function setStatus(s,on=false){status=s;connected=on;broadcast({type:'status',status,connected,username,lastChatAt})}
function enqueue(name,text,source='chat'){name=clean(name,32);text=clean(text,180);if(!name||!text)return;const now=Date.now();const key=name.toLowerCase();if(source==='chat'&&now-(cooldowns.get(key)||0)<16000)return;cooldowns.set(key,now);if(source!=='auto')lastActivity=now;if(queue.length>=12)queue.shift();if(source==='auto')queue.push({name,text,source});else queue.unshift({name,text,source});broadcast({type:'question',name,text,source});drain()}
async function aiAnswer(name,question){
  const apiKey=(process.env.OPENAI_API_KEY||'').trim();
  aiLastAttempt=new Date().toISOString();
  if(!apiKey){aiStatus='sem chave';aiLastError='OPENAI_API_KEY ausente ou vazia';console.error('IA CONFIGURAÇÃO: OPENAI_API_KEY ausente ou vazia');return fallback(name,question)}
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch('https://api.openai.com/v1/chat/completions',{
      method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiKey},
      body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4o-mini',temperature:.85,max_tokens:115,
        messages:[{role:'system',content:'Você é Zeca VAR, comentarista fictício de futebol. Responda à pergunta de forma direta em português brasileiro, em até 35 palavras, com humor leve. Não invente fatos recentes, resultados ou notícias.'},{role:'user',content:`Torcedor ${name} perguntou: ${question}`}] }),signal:controller.signal
    });
    if(!r.ok){let detail='';try{const err=await r.json();detail=String(err?.error?.message||'').slice(0,180)}catch{}throw Error(`IA HTTP ${r.status}: ${detail}`)}
    const j=await r.json();const answer=clean(j.choices?.[0]?.message?.content,320);
    if(!answer)throw Error('API retornou resposta vazia');
    aiStatus='funcionando';aiLastError=null;aiLastSuccess=new Date().toISOString();
    console.log('IA RESPOSTA OK',name,answer.slice(0,90));return answer;
  }catch(e){aiStatus='falha';aiLastError=String(e?.message||e).slice(0,240);console.error('IA indisponível:',aiLastError);return fallback(name,question)}
  finally{clearTimeout(timer)}
}
function fallback(name,question){const q=question.toLowerCase();if(q.includes('flamengo'))return `Ô ${name}, o Flamengo chegou na resenha! Mas aqui o VAR é sem juízo e a corneta é para todos!`;if(q.includes('corinthians'))return `${name}, Corinthians no assunto? Segura a emoção, que a resenha hoje tá pegando fogo!`;if(q.includes('galo')||q.includes('atlético'))return `Atenção, ${name}! A torcida do Galo invadiu a cabine! Aqui ninguém escapa da resenha!`;if(q.includes('palmeiras'))return `${name}, Palmeiras na área! Aqui o comentarista não tem time, só tem corneta!`;return `Alô, ${name}! Recebi sua mensagem: ${question.slice(0,75)}. Na cabine do VAR Sem Juízo a resenha não para!`}
async function drain(){if(processing)return;processing=true;try{while(queue.length){const item=queue.shift();console.log('PERGUNTA RECEBIDA',item.source,item.name,item.text.slice(0,90));const answer=item.source==='auto'?await idleAnswer(item.text):await aiAnswer(item.name,item.text);lastAnswer=answer;broadcast({type:'answer',id:++seq,name:item.name,question:item.text,answer,source:item.source});await new Promise(r=>setTimeout(r,600))}}catch(e){console.error('FILA ERRO',e)}finally{processing=false;if(queue.length)setImmediate(drain)}}
const idleTopics=['Qual torcida faz mais barulho: Flamengo, Corinthians ou Atlético? Quero ouvir vocês!','Quem merece vestir a camisa dez da Seleção Brasileira?','Qual é o estádio com a atmosfera mais impressionante do Brasil?','O que pesa mais num clássico: talento ou raça?','Qual foi o gol mais inesquecível que você já viu?','Se você fosse técnico da Seleção, qual jogador seria titular absoluto?','Qual rivalidade do futebol brasileiro rende a melhor resenha?','O que faz um time ser campeão: defesa sólida ou ataque ousado?'];
async function idleAnswer(topic){if(!process.env.OPENAI_API_KEY)return `Atenção, torcida! ${topic} Escreva sua opinião no chat, que eu quero ver esse debate!`;return aiAnswer('Zeca VAR, apresentador',`Faça um comentário espontâneo e divertido sobre esta pauta: ${topic}. Fale diretamente com o público, convide respostas, não atribua falas a espectadores e não invente resultados atuais.`)}
setInterval(()=>{if(Date.now()-lastActivity<35000||processing||queue.length)return;const topic=idleTopics[idleIndex++%idleTopics.length];enqueue('Zeca VAR',topic,'auto');lastActivity=Date.now()},5000);
function onChat(d){const name=clean(d.uniqueId||d.user?.uniqueId||d.nickname||'Torcedor',32),msg=clean(d.comment||d.content||'',180);if(!msg)return;lastActivity=Date.now();lastComment=msg;lastChatAt=new Date().toISOString();console.log('CHAT RECEBIDO',name,msg);broadcast({type:'chat',name,text:msg});if(msg.startsWith('!')&&!/^!(pergunta|fala|var)\s+/i.test(msg))return;const question=msg.replace(/^!(pergunta|fala|var)\s+/i,'');enqueue(name,question)}
function scheduleRetry(){if(retryTimer)return;retryTimer=setTimeout(()=>{retryTimer=null;connectTikTok()},20000)}
async function connectTikTok(){if(!username){setStatus('Modo demonstração — configure TIKTOK_USERNAME');return}if(connecting||connected)return;connecting=true;setStatus('Procurando LIVE @'+username);try{const {TikTokLiveConnection}=await import('tiktok-live-connector');const c=new TikTokLiveConnection(username,{enableExtendedGiftInfo:false});conn=c;c.on('chat',onChat);c.on('gift',d=>{if(d.giftType===1&&d.repeatEnd===false)return;const name=clean(d.uniqueId||d.user?.uniqueId||d.nickname||'Torcedor',32),gift=clean(d.giftName||d.gift?.name||'presente',50);broadcast({type:'gift',name,gift});console.log('PRESENTE',name,gift)});c.on('disconnected',()=>{if(conn!==c)return;setStatus('TikTok desconectado');scheduleRetry()});c.on('error',e=>console.warn('TikTok event:',e?.message||e));await c.connect();setStatus('LIVE @'+username+' conectada',true);console.log('TIKTOK CONECTADO @'+username)}catch(e){setStatus('LIVE não localizada; tentando novamente');console.warn('CONEXÃO TIKTOK:',e?.message||e);scheduleRetry()}finally{connecting=false}}
wss.on('connection',ws=>{ws.send(JSON.stringify({type:'status',status,connected,username,lastChatAt}));ws.on('message',raw=>{let m;try{m=JSON.parse(String(raw))}catch{return}if(m.type==='demo'){enqueue('Visitante',clean(m.text,180),'demo');return}if(m.type==='admin'&&adminKey&&m.key===adminKey){if(m.action==='ask')enqueue(clean(m.name||'Teste',32),clean(m.text,180),'admin');if(m.action==='reconnect'){connected=false;conn?.disconnect?.();setStatus('Reconexão solicitada');scheduleRetry()}}})});
// HTTP fallback when the mobile browser cannot keep a WebSocket open.
app.get('/api/state',(_req,res)=>{res.set('Cache-Control','no-store');res.json({connected,status,username,lastChatAt,eventSeq,events:recentEvents.filter(e=>e.eventSeq>Math.max(0,Number(_req.query.since)||0)).slice(-40)})});
app.post('/api/demo',(req,res)=>{const message=clean(req.body?.text,180);if(!message)return res.status(400).json({ok:false,error:'Pergunta vazia'});enqueue('Visitante',message,'demo');res.json({ok:true})});
app.get('/api/diagnostico',(_req,res)=>{res.set('Cache-Control','no-store');res.json({ok:true,version:'diagnostico-v5',ai:{keyConfigured:Boolean((process.env.OPENAI_API_KEY||'').trim()),model:process.env.OPENAI_MODEL||'gpt-4o-mini',status:aiStatus,lastError:aiLastError,lastAttempt:aiLastAttempt,lastSuccess:aiLastSuccess},tiktok:{connected,status,username,lastChatAt},queueLength:queue.length,processing,lastAnswer})});
app.get('/health',(_,res)=>res.json({ok:true,connected,status,username,lastChatAt,queue:queue.length}));
app.get('/tiktok-status',(_,res)=>res.json({connected,status,username,lastChatAt,lastComment,lastAnswer}));
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>{console.log('VAR COMENTARISTA IA LIVE iniciado');connectTikTok()});
