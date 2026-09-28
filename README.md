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
Opcionais: `OPENAI_API_KEY`, `OPENAI_MODEL`, `APIBRASIL_BEARER_TOKEN`, `APIBRASIL_DEVICE_TOKEN`, `FISCAL_PROVIDER_URL`, `FISCAL_PROVIDER_TOKEN`.

O sistema nunca marca uma nota como emitida sem autorização do provedor fiscal configurado.
