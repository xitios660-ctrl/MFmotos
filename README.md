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

## Atalhos de navegação

O visual MF Cinema V7 foi mantido. Os atalhos da antiga barra inferior ficam no menu de três pontos no cabeçalho, com as mesmas áreas da navegação lateral. O menu fecha ao escolher uma área, clicar fora ou pressionar Escape. Tab e Enter permitem navegar pelo teclado.

### Verificação sem banco

Com Playwright instalado (`python -m pip install playwright` e `python -m playwright install chromium`), sirva os arquivos com `python -m http.server 4173 --directory public` e execute `python tests/ui_smoke.py` em outro terminal. As chamadas de API são simuladas; o teste não cria registros reais.
