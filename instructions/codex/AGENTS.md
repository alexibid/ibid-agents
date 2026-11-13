# Regras globais do utilizador (todos os projetos)

## Texto de commit

Regra do utilizador, igual em qualquer projeto e para qualquer agente (Claude, Gemini, Codex, OpenCode). O agente nunca faz `git add/commit/push`; só dá o texto, e só quando pedido.

- **Um só lote, uma só linha.** Sem descrição, sem corpo, sem rodapé, sem `Co-Authored-By`, sem comandos git.
- **Cumpre o commitlint** (`@commitlint/config-conventional`): `type(scope): subject` em minúsculas, sem ponto final, cabeçalho até 100 caracteres.
- **Tipo por defeito `fix`**; `feat` só para funcionalidade genuinamente nova. O `scope` é o nome do projeto (Nx) afetado.
- **Sem limite de ficheiros.** Lê todos os ficheiros alterados (`git status`) e entrega sempre tudo num único lote, mesmo que sejam dezenas.
- Antes de escrever o texto, lê as regras de commit do projeto (`AGENTS.md`, `.agents/`) e vê o `git status`.
