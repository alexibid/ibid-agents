# Épico: Contas da família no papikapi

Texto exato das issues, por aprovar. Ordem de trabalho: D0 → S1 → S3 → S4 → S6 → S5.

| Issue | Tipo | Repositório | Tamanho | Pai |
| --- | --- | --- | --- | --- |
| Épico | Feature · `epic` | alexibid/papikapi | L | — |
| D0 | Task · `task` | alexibid/papikapi | M | Épico |
| S1 | Feature · `user-story` | alexibid/services | M | Épico |
| T1 | Task · `task` | alexibid/services | S | S1 |
| S3 | Feature · `user-story` | alexibid/papikapi | M | Épico |
| S4 | Feature · `user-story` | alexibid/papikapi | M | Épico |
| S6 | Feature · `user-story` | alexibid/papikapi | M | Épico |
| S5 | Feature · `user-story` | alexibid/papikapi | S | Épico |

Cada story corre pelo LangGraph com os seus agentes (`/specialist`, `/test-author`, `/developer`,
`/ui`, `/reviewer`, …), por isso o trabalho dos agentes não tem issue própria. Só têm issue as
tarefas que não são de uma story: o desenho (D0) e o que só tu podes fazer (T1).

---

## Épico — Contas da família

**Título:** Contas da família: entrar com Google, cadeado dos pais e gestão dos adultos

O pai e a mãe entram com a conta Google, a parte dos pais ("Grown-ups!") fica protegida com
Face ID, impressão digital ou PIN, e quem entrou gere os adultos da família. A criança continua
sem conta e o ecrã dela abre como hoje.

Decisão tomada: passa a haver contas de adultos na Firebase (projeto `ibid-papikapi`), o que muda
a regra do MVP "sem contas, um ficheiro no Drive".

Fora deste épico:
- Entrar com Apple.
- Ver os mesmos dados (figuras, pontos) nos telemóveis dos dois adultos. Isso é a
  sincronização, que fica para o épico seguinte, depois da D0.

---

## D0 — Desenho: entrada nativa em cada plataforma e a família na Firebase

**Título:** Desenho: entrada nativa em cada plataforma e a família na Firebase

Feito pelo `/solution-architect`, aprovado por ti antes de começar a S1.

- [ ] Decide como se entra no iPhone, no Android e no Mac (Tauri), sem depender de janelas do
      browser dentro da app, e como fica o browser em desenvolvimento.
- [ ] Decide se a nova entrada com Google substitui ou convive com a ligação ao Google que o
      Oh Save Me já usa para o Drive.
- [ ] Decide onde ficam a família, os adultos e os convites na Firebase, e as regras de segurança
      que impedem um adulto de ver outra família.
- [ ] A decisão fica escrita e aprovada por ti.

---

## S1 — Entrar e sair com Google

**Título:** Entrar e sair com Google através da Firebase

Como pai ou mãe, quero entrar e sair com a minha conta Google, para a app me reconhecer em
qualquer dispositivo.

**Tamanho:** M · **Projeto:** `libs/services` · **Depende de:** D0, T1

Critérios de aceitação:
- [ ] Ao tocar em "Entrar com Google" e escolher a conta, a app mostra o nome e o e-mail de quem
      entrou.
- [ ] Funciona no iPhone, no Android e no Mac, e no browser em desenvolvimento.
- [ ] Ao cancelar a janela do Google, a app volta ao ecrã anterior sem erro e sem ninguém ter
      entrado.
- [ ] Sem internet, a app diz que entrar precisa de ligação e não fica presa.
- [ ] Tocar duas vezes seguidas em "Entrar com Google" abre só uma janela.
- [ ] Fechar e voltar a abrir a app mantém a pessoa com a sessão iniciada.
- [ ] Depois de "Sair", a app deixa de reconhecer a pessoa naquele dispositivo.

## T1 — Ativar o Google na Firebase

**Título:** Ativar a entrada com Google na consola da Firebase

Só tu podes fazer: precisa da tua conta Google Cloud.

- [ ] Ativar o fornecedor Google em Authentication, no projeto `ibid-papikapi`.
- [ ] Criar os IDs de cliente para iOS, Android e web.
- [ ] Nenhum segredo vai para o repositório nem para esta issue.

---

## S3 — Entrada dos pais

**Título:** Entrada dos pais no "Grown-ups!"

Como pai ou mãe, quero que a parte dos pais me peça para entrar na primeira vez, para a família
ficar ligada à minha conta.

**Tamanho:** M · **Projeto:** `apps/papikapi` · **Depende de:** S1

Critérios de aceitação:
- [ ] O ecrã da criança abre como hoje, sem pedir para entrar.
- [ ] Na primeira vez que se toca em "Grown-ups!", aparece o ecrã para entrar com Google.
- [ ] Depois de entrar, a pessoa chega à parte dos pais e a família fica ligada à sua conta.
- [ ] Nas vezes seguintes, "Grown-ups!" já não pede para entrar.
- [ ] Depois de "Sair", "Grown-ups!" volta a pedir para entrar e os dados da família continuam
      no dispositivo.
- [ ] Sem internet na primeira vez, o ecrã explica que é preciso ligação e deixa voltar ao ecrã
      da criança.
- [ ] Os textos aparecem na língua da app.

---

## S4 — Cadeado dos pais

**Título:** Cadeado do "Grown-ups!" com biometria ou PIN

Como pai ou mãe, quero que a parte dos pais peça Face ID, impressão digital ou um PIN, para a
criança não lá entrar.

**Tamanho:** M · **Projeto:** `apps/papikapi` · **Depende de:** S3

Critérios de aceitação:
- [ ] Ao tocar em "Grown-ups!", a app pede Face ID, Touch ID ou impressão digital, conforme o
      dispositivo, e entra se reconhecer.
- [ ] Na primeira vez, a app pede para escolher um PIN de 4 dígitos, que serve quando não há
      biometria ou ela falha.
- [ ] Com o PIN certo entra; com o errado diz que está errado.
- [ ] Depois de 5 PINs errados seguidos, espera 30 segundos antes de deixar tentar outra vez.
- [ ] "Esqueci o PIN" pede para entrar outra vez com Google e depois deixa escolher um PIN novo.
- [ ] Ao sair da app ou ao voltar ao ecrã da criança, a parte dos pais volta a ficar trancada.
- [ ] No browser, em desenvolvimento, funciona só com o PIN.

---

## S6 — Convidar o outro adulto

**Título:** Convidar o outro adulto da família

Como pai ou mãe, quero convidar o outro adulto da família, para os dois termos acesso à mesma
família.

**Tamanho:** M · **Projeto:** `apps/papikapi` · **Depende de:** S3, D0

Critérios de aceitação:
- [ ] Nas definições dos pais existe "Convidar adulto", que cria um link para partilhar por
      mensagem.
- [ ] Quem abre o link e entra com Google passa a fazer parte da família.
- [ ] O link deixa de funcionar ao fim de 7 dias ou depois de usado uma vez.
- [ ] Um link usado ou expirado mostra uma mensagem clara.
- [ ] Abrir o mesmo link duas vezes não cria dois membros.
- [ ] A família tem no máximo 2 adultos; um terceiro convite explica o limite.

Nota: as figuras e os pontos ainda não aparecem no telemóvel do segundo adulto. Isso é a
sincronização, o épico seguinte.

---

## S5 — Ver e retirar adultos

**Título:** Ver os adultos da família e retirar um deles

Como pai ou mãe, quero ver os adultos da família e retirar um deles, para controlar quem tem
acesso.

**Tamanho:** S · **Projeto:** `apps/papikapi` · **Depende de:** S6

Critérios de aceitação:
- [ ] Nas definições dos pais aparece a lista dos adultos da família, com nome e e-mail.
- [ ] Um adulto pode retirar o outro, depois de confirmar.
- [ ] O adulto retirado deixa de conseguir abrir a parte dos pais desta família na próxima vez
      que tentar.
- [ ] O único adulto da família não se pode retirar a si próprio.
- [ ] Sem internet, a lista mostra o que já se sabia e retirar fica indisponível, com aviso.
