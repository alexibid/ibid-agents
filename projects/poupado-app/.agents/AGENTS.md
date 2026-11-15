# PoupadoApp Workspace Rules

Sempre que trabalharem no projeto **PoupadoApp**, os agentes DEVEM seguir estritamente estas normas arquiteturais e diretrizes. Ver `PRD.md` (visão completa) e `MVP.md` (âmbito atual, v0.1.0) na raiz do repositório para o contexto de produto.

## 🌐 Âmbito Atual: Web/Angular Exclusivo (MVP v0.1.0)
- O desenvolvimento está estrita e exclusivamente focado na plataforma **Web Angular (SPA)**.
- As configurações e integrações para **Tauri v2** (Desktop) e **Capacitor v6** (Mobile) sob `platforms/` estão em standby e só serão retomadas depois da versão Web estar 100% concluída e validada. Não investir esforço a ligá-las a menos que explicitamente pedido.

## 🏛️ Directory & File Structure (DDD)
- Aderir às camadas de **Domain-Driven Design (DDD)** sob `src/app/`:
  - `domain/`: Lógica de negócio, entidades, value objects e interfaces de repositório (`models/`, `services/`, `repositories/`). TS puro, sem dependências de framework.
  - `infrastructure/`: Adaptadores/repositórios **RxDB** (`rxdb/`), APIs externas (`api/`), e sincronização com Google Drive (`sync/`).
  - `application/`: Casos de uso (`use-cases/`) e estado reativo/facades com Angular Signals ou RxJS.
  - `ui/`: Camada de apresentação, dividida estritamente por **Atomic Design**.

A persistência é **RxDB** (base de dados reativa local) — nunca aceder diretamente a SQLite/IndexedDB fora de `src/app/infrastructure/rxdb/`.

## 🎨 UI Design System (Angular Material)
- Baseline é **Angular Material nativo** (100% gratuito, open-source) — sem overrides de tema customizados nem kits de componentes de terceiros.
- **Átomos:** primitivos do Angular Material diretamente (`mat-button`, `mat-input`, `mat-select`, `mat-icon`), com tokens de dimensão, padding e estados rigorosamente consistentes em todas as vistas.
- **Organismos:** regras fixas de layout estrutural — cabeçalho, limites de página e ações fundamentais (ex: botão de Definições) mantêm-se padronizados em todos os ecrãs.
- Agrupar componentes em `src/app/ui/components/atoms/` → `molecules/` → `organisms/`, mais `templates/` (layout de página) e `pages/` (vistas de rota que ligam templates a dados reais).

## 🧠 Motor de ML On-Device (Dual-Layer)
- Classificador **Naïve Bayes** ultraleve + matrizes de aprendizagem por reforço, escrito em TypeScript puro dentro de `domain/`. Zero APIs externas, < 10 KB na bundle, execução em milissegundos.
- Camada 1 (regras globais estáticas): dicionário embutido de comerciantes portugueses conhecidos (ex: Lidl, Pingo Doce, BP, Águas de Gaia).
- Camada 2 (regras privadas do utilizador): aprendidas e persistidas no RxDB sempre que o utilizador confirma/corrige uma categoria; sobrepõem-se sempre às regras globais.
- Qualquer alteração de categoria via `mat-select` deve disparar o fluxo de re-categorização em lote (popup `mat-dialog`) antes de aplicar mudanças em massa.

## 📥 Assistente de Importação & Configuração de Contas
- Mesmo padrão dual-layer do motor de ML acima, aplicado à estrutura do CSV/tipo de conta em vez de à descrição da transação — ver `PRD.md` §4.1 (FR-01 a FR-08) e `MVP.md` §1.
- Camada 1: assinaturas de cabeçalho por banco (CGD, Millennium BCP, Bankinter, Cartão Universo...). Camada 2: heurísticas de conteúdo quando não há assinatura conhecida. Camada 3: correções do utilizador viram template privado.
- Após importação, os movimentos passam por um ecrã de triagem em lote (não caem direto na lista principal) com sugestão de categoria pré-preenchida e orçamento/projeto opcional na mesma linha; o que for ignorado fica pendente com notificação persistente, não bloqueante.

## 🙅 Princípio Anti-Tabela (Utilizador Leigo)
- Público-alvo: pessoas que querem respostas diretas ("tenho dinheiro para ir de férias?"), não uma ferramenta de BI para explorar dados — ver `PRD.md` §1.1–1.2.
- Antes de desenhar uma grelha/tabela densa como interface principal, prefira cards com a resposta já calculada, confirmação inline, ou ecrãs de revisão em lote. Tabelas são último recurso (ex: export/auditoria), nunca o ecrã principal do dia a dia.

## 🎨 Styling Architecture (SCSS, ITCSS, BEM)
- Usar **SCSS** para folhas de estilo.
- Organizar estilos globais em `src/styles/` seguindo as camadas de especificidade **ITCSS**:
  - Settings → Tools → Generic → Elements → Objects → Components → Trumps.
- Aplicar a convenção **BEM** (Block-Element-Modifier) em todas as classes dentro de componentes: `.block__element--modifier`.

## 💎 Clean Code & TypeScript Conventions
- Seguir: Composition over Inheritance, OOP, SOLID e DRY.
- Ficheiros com no máximo 200–300 linhas; funções pequenas e de responsabilidade única (SRP).
- TypeScript estrito: nunca usar `any` (usar `unknown` ou generics), preferir arrays/propriedades `readonly`, e evitar enums numéricos (usar union types/`as const`).
- **Código auto-explicativo & comentários apenas em inglês:** o código deve ser legível por si só; comentários mantidos ao mínimo indispensável, e quando estritamente necessários NUNCA escritos em português — sempre em inglês.

## 🌿 Git Branching Model & Workflow (GitHub Flow & Conventional Commits)
- Tratar `master`/`main` como o branch de produção estável.
- Desenvolver features e correções em branches de vida curta: `feature/*`, `fix/*` ou `chore/*`.
- Aplicar a especificação **Conventional Commits** (`type(scope): description`) em todas as mensagens de commit, validadas localmente via Husky + commitlint.
- Integrar código no branch principal estritamente via Pull Requests (PR), após revisão e validação.

## 🧪 Spec-Driven TDD (Test-Driven Development)
- Escrever testes unitários (`.spec.ts`) antes ou em paralelo com a implementação de componentes, services, use-cases e repositories.
- Aderir estritamente ao ciclo Red-Green-Refactor.
- O design de código e as fronteiras de API devem ser guiados pelas especificações de comportamento.
- Garantir cobertura de teste para toda a lógica de negócio; correr `npm run test` regularmente para validar.

## ⚠️ Gestão Exclusiva de Git pelo Utilizador
- OS AGENTES NUNCA DEVEM EXECUTAR COMANDOS DE GIT QUE ALTEREM O ESTADO DO REPOSITÓRIO (`git commit`, `git merge`, `git push`, `git pull`, `git rebase`, `git tag`, `git checkout -b`, etc.).
- O agente só tem autorização para consultar o estado do repositório em modo de leitura (`git status`, `git diff`, `git log`, `git branch`).
- Qualquer alteração de código ou preparação de commit/merge deve ser apresentada ao utilizador com os comandos exatos para que este os execute manualmente no seu próprio terminal.

## 📦 Fluxo de Trabalho & Economia de Tokens
- Observar SEMPRE as alterações no git (`git diff`, `git status`) na primeira fase de análise. Só percorrer o resto do código se for estritamente necessário, visando poupar tokens.
- O desenvolvimento do projeto deve ser composto por pequenas tarefas e pequenos commits sempre.

## ✅ Correção de Domínio
- Transações importadas devem ser deduplicadas via hash criptográfico (data + descrição + valor) — nunca importar a mesma linha de extrato duas vezes em uploads CSV/OFX sobrepostos.
- Os splits de uma transação devem somar sempre exatamente ao valor total da transação-pai — tratar qualquer discrepância como bug, nunca como arredondamento a ignorar.
- Qualquer funcionalidade envolvendo sync, storage ou dados externos não pode enfraquecer a garantia local-first/zero-knowledge: nenhum dado financeiro sai do dispositivo exceto através da sincronização explícita e encriptada do utilizador com o seu próprio Google Drive.
