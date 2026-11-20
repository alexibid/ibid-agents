# Relatório de melhorias — 19 de novembro de 2026

Estado: nada está em commit. Build do motor e do monitor feitos, 300 testes passam, skills
instalados. Os servidores das sessões abertas só carregam o código novo quando reiniciam.

## 1. O motor passou a ter um nome genérico

| O quê | Porquê |
| --- | --- |
| Contratos, skills, regras e mensagens dizem "the flow engine" em vez de "LangGraph" | Os agentes dependem do papel do motor, não da tecnologia. Se o LangGraph for trocado, nenhum contrato muda |
| LangGraph só é nomeado onde é a implementação: `langgraph/README.md`, `flow-engineer.md`, e as regras que proíbem citá-lo no ibid-workspace | Um único sítio diz qual é a tecnologia |
| Ficaram iguais: a pasta `langgraph/`, o servidor `ibid-langgraph`, os nomes das ferramentas e o motor | Mudar isto partiria as sessões em curso sem ganho para os agentes |

## 2. Um agente para o motor: `flow-engineer`

`agents/flow-engineer.md` e `/flow-engineer`. Encontra problemas nas execuções das stories,
prova a causa (story, plano da query ou linha da transcrição), corrige com um teste e nunca
mexe em estado, servidores ou git.

**Porquê:** até agora os problemas do motor eram corrigidos à mão, a meio das stories. Com um
papel próprio, a correção segue sempre o mesmo método e deixa prova.

## 3. Especialistas por app, que orquestram os agentes genéricos

| App | Especialista | Agentes do projeto que entram nos passos |
| --- | --- | --- |
| papikapi | `papikapi-specialist` | `blender` no `implement` quando há `figures` |
| papikapi-api (ficha nova) | `papikapi-api-specialist` | `blender` no `implement` quando há `figures` |
| papikapi-studio | `papikapi-studio-specialist` | `blender` no `implement` quando há `figures` |
| oh-save-me | `oh-save-me-specialist` | `finance-agent` no `plan` e no `implement` |
| ibid-website | `ibid-website-specialist` | — |
| ibid-website-api | `ibid-website-api-specialist` | — |
| boilerplate | `boilerplate-specialist` | — |

Como funciona:

- A ficha nomeia o especialista (`Specialist`) e os agentes do projeto (tabela `Agents`:
  agente, passo, condição, contrato). O motor entrega o plano ao especialista do projeto e
  junta cada agente do projeto ao passo certo, só quando a condição se cumpre.
- Cada especialista compõe o `specialist.md` genérico (composição, não herança) e acrescenta só
  o que é do projeto: quem faz cada passo e o que um plano desse projeto nunca pode esquecer.
- A ficha é recusada se um agente entrar num passo que o projeto não corre, ou se faltar o
  contrato. Um teste confirma que todos os contratos nomeados existem e que todas as apps têm
  especialista.
- Um agente com fluxo próprio (`blender`, `finance-agent`…) não arranca esse fluxo dentro de
  uma story: lá serve apenas como conhecimento do passo.

**Porquê:** o conhecimento de cada projeto (figuras, RxDB, conteúdos) estava espalhado ou em
falta, e um único especialista genérico tinha de adivinhá-lo. Agora o especialista do projeto
decide e os agentes genéricos executam.

## 4. O que o `flow-engineer` encontrou e corrigiu

Do diário: o `implement` falhou 14 vezes em 32, e cerca de 10 dessas falhas não foram culpa do
developer.

| Problema | Correção |
| --- | --- |
| Tentativas gastas por ficheiros de outra story | Os ficheiros de outra story contam como dela enquanto está em curso ou acabou depois do início desta. Os specs e mocks do test author passam a ser da própria story |
| Uma story parada durante a noite deixava de contar como em curso | Conta qualquer story `working`, por mais tempo que esteja parada (também no guard) |
| O mock que o test author tem de escrever chumbava o `implement` | Specs, mocks e `mocks/` nunca são ficheiros estranhos |
| Uma resposta com o formato errado gastava uma tentativa e mandava a story para trás | Pede-se o mesmo passo outra vez, contado à parte |
| Uma story reiniciada não passava porque o trabalho anterior já estava na árvore | Trabalho já presente no início passa, com uma nota |
| Linha de commit com `git add --` sem ficheiros | Diz que não há nada para adicionar e dá só o commit |
| Não havia forma de fechar uma story abandonada | Ferramenta nova `abandon_story` |
| A mesma chamada contada em dois pedidos no monitor | Cada linha da transcrição lê-se uma só vez (88 chamadas duplicadas a menos) |
| O ibid-website não tinha `author-tests` nem `validate-tests` | Acrescentados; as stories em curso mantêm a fila com que começaram |
| A ficha do ibid-website falava de PocketBase | Atualizada para a API de conteúdos local |
| A verificação final aplicava a regra W64 do DevOps a todos os repositórios | Agora só ao ibid-workspace |

Queries:

| Query | Antes | Depois |
| --- | --- | --- |
| Limites no monitor | 33,4 ms, a crescer com cada amostra | 0,3 ms |
| Últimas stories (SQLite) | 0,15 ms | 0,07 ms |
| Agentes e erros (`agent_calls`) | 52–154 ms | Proposta de dois índices, não aplicada |

## 5. Segunda ronda: o que tinha ficado contigo

| O quê | Feito | Porquê |
| --- | --- | --- |
| Índices `agent_calls_agents` e `agent_calls_failures` | Criados e no `schema.sql`. Agentes 105→0,6 ms, painel 149→0,5 ms, atividade 55→0,05 ms, erros 43→0,1 ms | As páginas de agentes e erros liam ~490 MB por pedido |
| Runs de agentes sem saída | Ferramenta `abandon_agent_run`; `devops~fccbbb14` fechado | Mantinha o guard aberto desde 18/11 |
| Story `ibid-website-api-207f383c` | Abandonada | Segurava 58 ficheiros e recusava planos da API |
| `validate-tests` falhado voltava ao developer | Volta ao test author (ou ao developer se o projeto não tiver `author-tests`) | Quem escreveu testes que não provam o critério é quem os corrige |
| Agentes do projeto não entravam em passos acrescentados depois do `implement` | As condições encontradas nos ficheiros passam a fazer parte do plano | Senão um passo `ui` acrescentado corria sem o agente do projeto |
| `secretlint` falhava quando a story só apagava ficheiros | Só analisa ficheiros que existem ("Not found target files" confirmado) | A verificação final chumbava sem motivo |
| `visual-gate` proibido de mudar ficheiros mas escrevia um ficheiro de regiões | Tudo o que escreve vai para a pasta `--out`, fora do workspace | O ficheiro aparecia no diff e era culpa do developer |
| `final-verifier` só lê mas a W64 mandava-o correr o DevOps | O assistente corre `/devops` depois da verificação final; a W64 diz isso | Um papel só de leitura não pode correr pipelines |
| Tokens contados duas vezes | Nova sincronização: menos ~76 milhões de tokens | As 88 chamadas repetidas inflacionavam os pedidos |
| `usage-ledger` | Medido: 339 transcrições em 24 s numa sincronização completa; a de 20 s só lê ficheiros alterados | Não justifica otimização |
| Ficha do ibid-website | Corresponde ao código: snapshot, admin sem persistência, facades | Falava de PocketBase, `studio` e de uma API que já não existe |

O "pequeno buraco" da correção 1 (um ficheiro de uma story acabada mas ainda sem commit não
conta como estranho) é o comportamento certo: o ficheiro é dessa story até ao commit.

## 6. O que falta, e porquê

- **A API do ibid-website já não existe:** foi removida no commit `42335ca`. A ficha
  `ibid-website-api.md` e o seu especialista estão obsoletos; apagá-los espera pela tua
  confirmação. Por isso `api/dist` e a porta da API deixaram de ser problemas.
- **ibid-website (uma story):** `login` compara a password com `'123'` no código, o que viola
  "No credential enters any bundle". O `compose.yaml` expõe um Postgres que nada usa em todas as
  interfaces, e o README e o `.gitignore` ainda falam de PocketBase. A password está em
  `snapshot-content.repository.ts`, que a story dos acentos tem no plano, por isso esta story só
  pode começar quando essa acabar. Falta decidir como fica o login sem servidor.
- **Outros atores fora das stories:** o motor não distingue um ficheiro mudado por ti ou por
  outra ferramenta de um mudado pelo developer.
