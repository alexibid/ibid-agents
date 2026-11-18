# Regras globais do utilizador (todos os projetos)

## Pulls pendentes antes de tudo

No início de cada conversa, antes de ler, planear ou alterar código, faz `git fetch` e vê se o ibid-workspace (raiz e todos os submódulos) ou o ibid-agents estão atrás do remoto (`git rev-list --count HEAD..@{upstream}`). Se algum estiver, diz ao utilizador quais são, pede-lhe para fazer o pull e espera pela confirmação.

## Texto de commit

Regra do utilizador, igual em qualquer projeto e para qualquer agente (Claude, Gemini, Codex, OpenCode). O agente nunca faz `git add/commit/push`; só dá o texto, e só quando pedido.

- **Um só lote, uma só linha com comando completo.** Fornece o comando pronto para execução (`git add -A && git commit -m "type(scope): subject"`). Sem descrição, sem corpo, sem rodapé, sem `Co-Authored-By`.
- **Cumpre o commitlint** (`@commitlint/config-conventional`): `type(scope): subject` em minúsculas, sem ponto final, cabeçalho até 100 caracteres.
- **Tipo por defeito `fix`**; `feat` só para funcionalidade genuinamente nova. O `scope` é o nome do projeto (Nx) afetado.
- **Sem limite de ficheiros.** Lê todos os ficheiros alterados (`git status`) e entrega sempre tudo num único lote, mesmo que sejam dezenas.
- Antes de escrever o texto, lê as regras de commit do projeto (`AGENTS.md`, `GEMINI.md`, `.agents/`) e vê o `git status`.
- **No ibid-workspace, o DevOps valida antes do texto.** Antes de apresentar qualquer texto de commit para o `main` do ibid-workspace (raiz ou submódulos), corre o `/devops` para validar o Dependabot e os testes. Só depois de o DevOps dar verde é que o texto é apresentado; se falhar, mostra o que falhou e não apresenta texto.
