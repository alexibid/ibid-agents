# Instruções de Estilo e Convenções do Projeto

Este documento define como o Claude Code deve escrever, revisar e refatorar código neste projeto. Segue estas regras sempre, sem exceção, a menos que o código existente no ficheiro já siga uma convenção diferente e explícita — nesse caso, mantém a consistência local e assinala a discrepância.

## 🎨 Arquitetura de Estilos (SCSS / ITCSS)

Os estilos globais vivem em `src/styles/` e seguem a hierarquia ITCSS (triângulo invertido), por ordem de especificidade crescente:

1. **Settings** — variáveis globais, cores, tipografia, breakpoints (sem output CSS).
2. **Tools** — mixins e funções utilitárias (sem output CSS).
3. **Generic** — resets (Normalize, box-sizing).
4. **Elements** — estilos base para elementos HTML sem classe (`body`, `h1`, `button`, `a`).
5. **Objects** — classes de layout estruturais, não-cosméticas (grids, wrappers).
6. **Components** — estilos específicos de componentes (locais ao componente Angular ou globais se forem de vendor).
7. **Trumps** — utilitários com `!important` para overrides explícitos.

Ao criar ou editar ficheiros `.scss`, respeita sempre esta ordem de import e nunca escrevas overrides fora da camada "Trumps".

### Nomenclatura BEM

Todas as classes CSS dentro de componentes seguem BEM:

- `.block` — abstração de topo do componente (`.btn`, `.card`)
- `.block__element` — descendente do bloco (`.card__title`, `.card__footer`)
- `.block--modifier` — modificação de estado (`.card--active`, `.btn--disabled`, `.card__title--large`)

Nunca uses seletores aninhados profundos ou classes fora deste padrão.

## 💎 Princípios de Clean Code

Aplica sempre:

- **Composition over Inheritance**
- **OOP** bem aplicada
- **SOLID** (S, O, L, I, D — todos, não apenas os óbvios)
- **Domain-Driven Design (DDD)** — respeita as fronteiras de domínio

### Nomes

- Nomes que revelam intenção; nada de desinformação ou abreviaturas confusas.
- Distinções significativas entre nomes semelhantes.
- Nomes pronunciáveis e pesquisáveis.
- Evitar mapeamento mental — nunca `i`, `j`, `x` fora de loops triviais e idiomáticos.
- Substantivos para classes/tipos, verbos para funções/métodos.

### Funções

- O mais pequenas possível; uma única responsabilidade.
- Um único nível de abstração por função.
- Stepdown Rule: o código lê-se de cima para baixo.
- 0, 1 ou 2 argumentos — evitar mais de 3.
- Sem flag arguments (booleanos que mudam o comportamento).
- Sem efeitos secundários escondidos.
- Command Query Separation.
- Tratamento de erros é "uma coisa" dentro da função.
- DRY — sem duplicação de código.

### Comentários

- O código explica-se a si mesmo; comentários não substituem nomes claros.
- Zero código morto/comentado.
- Sem comentários redundantes ou óbvios.
- Comentários só para decisões arquiteturais complexas ou para avisar de consequências não óbvias.

### Formatação e Organização

- Ficheiros com no máximo 200–300 linhas.
- Espaçamento vertical para separar conceitos.
- Conceitos relacionados fisicamente próximos.
- Variáveis declaradas o mais perto possível de onde são usadas.
- Linhas com no máximo 100–120 caracteres.
- Indentação automática e consistente (Prettier/ESLint) — nunca formatar manualmente contra a config do projeto.

### Objetos, Classes e Estruturas de Dados

- Esconder detalhes de implementação através de abstração.
- Distinguir claramente Objetos (expõem comportamento, escondem dados) de Data Structures (expõem dados, sem comportamento) — nunca misturar os dois padrões na mesma classe.
- Respeitar a Lei de Demeter.
- Classes pequenas, focadas numa única responsabilidade.

### Tratamento de Erros

- Usar exceções (`throw`) em vez de códigos de erro de retorno.
- Estruturar try/catch primeiro ao escrever lógica sujeita a falhas.
- Nunca retornar `null`/`undefined` se for evitável.
- Nunca passar `null`/`undefined` como argumento.

## 🔷 TypeScript

- **Proibido usar `any`** — usar `unknown` ou Generics.
- `readonly` para garantir imutabilidade de arrays e propriedades.
- Evitar enums numéricos — preferir union types ou `as const`.
- Optional Chaining (`?.`) e Nullish Coalescing (`??`) para null-safety.
- Interfaces para APIs públicas; Type Aliases para uniões e interseções.
- Type Guards em vez de type assertions manuais (`as Type`).

---

## Checklist antes de sugerir/gerar código

Antes de propor qualquer código, o Claude Code deve verificar mentalmente:

- [ ] Nomes revelam intenção?
- [ ] Função faz uma coisa só, com um nível de abstração?
- [ ] ≤ 3 argumentos, sem flags booleanos?
- [ ] Sem `any`, sem `null`/`undefined` evitáveis?
- [ ] Classes seguem SRP e SOLID?
- [ ] Ficheiro dentro do limite de linhas?
- [ ] Estilos (se aplicável) seguem ITCSS + BEM?
- [ ] Sem comentários redundantes ou código morto?

---

## ⬇️ Pulls pendentes antes de tudo

No início de cada conversa, antes de ler, planear ou alterar código, faz `git fetch` e vê se o ibid-workspace (raiz e todos os submódulos) ou o ibid-agents estão atrás do remoto (`git rev-list --count HEAD..@{upstream}`). Se algum estiver, diz ao utilizador quais são, pede-lhe para fazer o pull e espera pela confirmação.

---

## 📝 Texto de commit (todos os projetos, todos os agentes: Claude, Gemini e outros)

Regra do utilizador, igual em qualquer projeto. O agente nunca faz `git add/commit/push`; só dá o texto, e só quando pedido.

- **Um só lote, uma só linha.** Sem descrição, sem corpo, sem rodapé, sem `Co-Authored-By`, sem comandos git.
- **Cumpre o commitlint** (`@commitlint/config-conventional`): `type(scope): subject` em minúsculas, sem ponto final, cabeçalho até 100 caracteres.
- **Tipo por defeito `fix`**; `feat` só para funcionalidade genuinamente nova. O `scope` é o nome do projeto (Nx) afetado.
- **Sem limite de ficheiros.** Lê todos os ficheiros alterados (`git status`) e entrega sempre tudo num único lote, mesmo que sejam dezenas.
- Antes de escrever o texto, lê as regras de commit do projeto (`AGENTS.md`/`.agents/`) e vê o `git status`.
- **No ibid-workspace, o DevOps valida antes do texto.** Antes de apresentar qualquer texto de commit para o `main` do ibid-workspace (raiz ou submódulos), corre o `/devops` para validar o Dependabot e os testes. Só depois de o DevOps dar verde é que o texto é apresentado; se falhar, mostra o que falhou e não apresenta texto.
