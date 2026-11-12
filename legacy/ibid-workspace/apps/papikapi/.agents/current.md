# Papikapi — Active Work Plan (`current.md`)

### Product Directives
- **App-First & Voice-First:** Primary targets are mobile (Capacitor iOS/Android) and desktop (Tauri macOS). All inputs prioritize frictionless voice capture in spoken language (PT) with background canonicalization to English upon submission.
- **Single Source of Truth:** This file defines the active implementation plan for Papikapi.

---

## Done

- [x] **US1 — Voice-to-Prompt para Figuras Origami (Concluído na UI):**
  - Molécula genérica reutilizável `<ibid-voice-dictation>` em `libs/ibid-ui` com 3 botões (**Gravar/Retomar**, **Parar**, **Aceitar**) e sessão aberta até 60s.
  - Transcrição apresentada na língua do utilizador (PT) para revisão sem atrito.
  - Tradução silenciosa para inglês canónico com invariantes de estúdio executada estritamente no momento do envio (`createModel()`).
  - Desanexação limpa de listeners do motor de voz no encerramento (eliminação do falso erro 'aborted').
  - Mapeamento de falhas reais (ex: sem internet) para mensagens amigáveis em português.
  - Suíte de integração user journey e 431 testes unitários aprovados a 100%.

---

## Open (Papikapi Roadmap: Voice-First, ML Points & NestJS Server)

### Tranche 1: Voice-First & Tradução Silenciosa
- [ ] **US2 — Voice-to-Text para Registo de Comportamentos (Área dos Pais):**
  - Entrada de voz em linguagem natural no ecrã dos adultos (ex: *"arrumou os brinquedos e ajudou a pôr a mesa sem birra"*).
  - Sem necessidade de selecionar caixas de categorias manuais.

### Tranche 2: NLU, Pontos e Machine Learning Adaptativo
- [ ] **US3 — Extração Canónica NLU (PT -> Ação + Modificadores em EN):**
  - O motor de NLU analisa a frase falada e extrai a estrutura canónica:
    - `domain`: `chores` | `behaviour` | `school` | `talking` | `family`
    - `action`: `clean_toys`, `set_table`
    - `modifiers`: `spontaneous: true`, `attitude: positive`
- [ ] **US4 — Motor Determinístico de Pontos com Guardrails:**
  - Atribuição transparente de pontos base com limites (*bounds*) estritos contra inflação desmedida e garantia de progressão consistente.
- [ ] **US5 — Calibração Adaptativa dos Pais (Loop de ML On-Device / Server):**
  - Sempre que os pais ajustam ou corrigem manualmente a pontuação sugerida, o modelo recalibra os pesos dos modificadores para aquela criança, aprendendo as preferências e o rigor de cada família ao longo do tempo.
- [ ] **US6 — Experiência de Auto-Commit de 3 Segundos:**
  - Ao registar a ação por voz, a pontuação é calculada e surge uma contagem decrescente de 3 segundos para confirmação automática, com botão de "Desfazer / Ajustar" para zero atrito.
- [ ] **US7 — Feedback em Tempo Real na Montagem 3D (Shelf & Pips):**
  - Os pontos ganhos refletem-se instantaneamente na animação de dobragem das peças da figura em construção na prateleira.

### Tranche 3: Arquitetura & Backend Centralizado (NestJS)
- [ ] **US8 — Criação do `papikapi-server` (NestJS) no Monorepo Nx:**
  - Novo projeto `apps/papikapi-server` baseado em NestJS.
  - Endpoints REST e WebSockets/SSE para:
    - `/api/creator/generate` (Geração de alternativas FLUX / Gemini)
    - `/api/creator/pick` (Seleção de modelo e desdobramento papercraft)
    - `/api/creator/progress` (Streaming de progresso em tempo real)
    - `/api/translation` (Tradução e canonicalização)
    - `/api/classifier` (NLU e inferência de pontos para US3 e US5)
- [ ] **US9 — Migração e Desacoplamento do `papikapi-studio`:**
  - Extração de todo o código Node/Express embutido no `papikapi-studio` para o `papikapi-server`.
  - O `papikapi-studio` passa a ser puramente uma SPA de inspeção e edição 3D/UV, comunicando com o `papikapi-server`.
- [ ] **US10 — Modo Autónomo / Offline Fallback no `papikapi`:**
  - O `papikapi` funciona a 100% mesmo quando o `papikapi-server` está desligado: cria figuras locais, gere pontos no RxDB, e sincroniza assim que a ligação ao servidor for restabelecida.
