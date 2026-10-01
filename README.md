# MF Moto Peças — Gestão

Sistema próprio da MF Moto Peças para PDV, estoque, ordens de serviço, orçamentos com IA, clientes, consulta de placa e módulo fiscal.

## Render
- Node.js 20+
- Build: `npm install`
- Start: `npm start`
- Health: `/api/health`
- Banco: PostgreSQL via `DATABASE_URL`

## Variáveis
Obrigatórias: `DATABASE_URL`, `JWT_SECRET`.
Opcionais: `AI_PROVIDER` (`local`, `groq`, `openai` ou `auto`), `GROQ_API_KEY`, `GROQ_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `APIBRASIL_BEARER_TOKEN`, `APIBRASIL_DEVICE_TOKEN`, `FISCAL_PROVIDER_URL`, `FISCAL_PROVIDER_TOKEN`.

O orçamento assistido funciona em modo `local` sem custo de API. Se `GROQ_API_KEY` for configurada, pode usar o plano gratuito do Groq; se a IA externa falhar, o sistema volta automaticamente ao modo local.

O sistema nunca marca uma nota como emitida sem autorização do provedor fiscal configurado.

## Navegação lateral expansível

A navegação segue a referência fornecida: um bloco compacto com apenas o logo e a seta. Ao clicar na seta, o painel revela o perfil, a busca e os sete atalhos. Ao recolher, esses elementos voltam a ficar ocultos. O estilo específico está em `public/sidebar.css`; o restante da interface mantém o visual MF Cinema V7.

A seta na lateral alterna os estados; o cabeçalho não tem um segundo botão para a mesma navegação. A barra usa preto, cinza e vermelho para combinar com a identidade MF. Em telas pequenas, o painel aberto aparece sobre o conteúdo e fecha ao selecionar uma área, tocar fora ou pressionar Escape. Ctrl/Cmd+K abre a busca. O painel aceita teclado e respeita movimento reduzido.

### Verificação sem banco

Com Playwright instalado (`python -m pip install playwright` e `python -m playwright install chromium`), sirva os arquivos com `python -m http.server 4173 --directory public` e execute `python tests/ui_smoke.py` em outro terminal. As chamadas de API são simuladas; o teste não cria registros reais.

## Login cinematográfico

A entrada usa o vídeo de roda de moto `public/Roda.mp4`, um quadro estático de fallback e estilos limitados ao login em `public/login-cinema.css`. `public/login-motion.js` controla pausa, aceleração ao segurar o botão, reflexos e preferência de movimento reduzido. O vídeo pausa quando a aba fica oculta e depois do login. A interface autentica sem atraso artificial e bloqueia envios repetidos durante a conexão.

A Visão Geral foi retirada da navegação. Ao entrar, o sistema abre diretamente em Atendimento. O workspace permanece oculto até o login.
