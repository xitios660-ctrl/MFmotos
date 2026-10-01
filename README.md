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

## Interface Liquid Glass (v8)

O estilo único está em `public/liquid-glass.css`. A interface mantém as operações existentes e usa vidro translúcido no login, cabeçalho, navegação e modais, reflexos que seguem o cursor e feedback ao tocar nos botões. Os efeitos respeitam `prefers-reduced-motion`, com superfícies opacas quando o navegador não suporta desfoque.

Os modais aceitam Escape, mantêm o foco dentro da janela e devolvem o foco ao botão de origem. Campos têm rótulos associados, produtos aceitam Enter/Espaço e o login informa carregamento e erros.

### Verificação visual sem banco

Instale Playwright em um ambiente Python e seu navegador:

```sh
python -m pip install playwright
python -m playwright install chromium
python -m http.server 4173 --directory public
```

Em outro terminal, execute `python tests/ui_smoke.py`. O teste intercepta as chamadas de API com dados fictícios e verifica login, sete módulos, teclado, modais, larguras de 320/390/768/1440 px e movimento reduzido. As capturas ficam em `/tmp/mf-ui-smoke`; `MF_UI_URL` e `MF_UI_ARTIFACTS` permitem alterar o endereço e a pasta de saída. Essa verificação cobre a interface; integrações fiscais e operações reais de banco exigem ambiente e credenciais próprios.
