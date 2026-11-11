# VAR Sem Juízo — Comentarista IA LIVE (protótipo 1.0)

## Arquivos
- `index.html`: estúdio 3D original em Three.js, personagem e voz do navegador.
- `server.mjs`: servidor Express/WebSocket, fila de comentários, IA opcional, TikTok LIVE.
- `package.json`: dependências.

## GitHub e Render (iPhone)
1. Crie **novo repositório** no GitHub e envie os três arquivos na raiz.
2. Render → New → Web Service → selecione o repositório.
3. Build Command: `npm install`.
4. Start Command: `npm start`.
5. Environment: `TIKTOK_USERNAME=varsemjuizo` (sem @); `ADMIN_KEY` uma senha forte. Opcional: `OPENAI_API_KEY` (chave secreta da API), `OPENAI_MODEL=gpt-4o-mini`.
6. Abra o endereço Render no Safari e teste a caixa de perguntas.
7. Verifique `https://SEU-ENDERECO.onrender.com/tiktok-status` para status real do TikTok.

## Funcionamento
- Perguntas do chat entram em fila, com intervalo por usuário para reduzir spam.
- Comandos `!pergunta texto`, `!fala texto`, `!var texto` ou comentários comuns.
- Respostas via OpenAI API quando configurada; sem chave, respostas pré-programadas.
- Presentes ativam aviso visual, sem exigir pagamento para participação.
- Voz usa `speechSynthesis` no navegador: **no iPhone pode exigir interação na página e o áudio pode não ser capturado na transmissão**.
- Three.js é carregado por CDN: requer internet.

## Limitações importantes
- Este é um protótipo funcional para testes, não um sistema de streaming RTMP/OBS.
- Não inclui áudio de saída para TikTok, captura de tela nem live streaming automático. Essas funções precisam de um pipeline de transmissão separado, possivelmente um computador ou serviço em nuvem.
- A integração TikTok é não oficial e pode apresentar `UserOfflineError`, mesmo com LIVE aberta; não é garantida.
- IA pode gerar informações incorretas; não confiar em placares ou notícias atuais sem fonte externa.
- Nunca coloque `OPENAI_API_KEY` no HTML ou repositório público. API é cobrada à parte.
- O personagem é original e não copia personagens de desenhos conhecidos.
