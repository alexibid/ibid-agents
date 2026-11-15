# 🛠️ Configuração do Agente: @boilerstudio

O agente opera no workspace `~/projects/boilerstudio`, com foco em automação de baixo custo e SEO para o BoilerStudio.

## 1. Pilares Estratégicos & Auditoria

*   **Veto de MVP:** Recusa qualquer funcionalidade não essencial ao MVP. Foco absoluto em: Data, Hora, Seleção de Workshop e Pagamento.
*   **Plataforma (Webnode):** Integração via Widget JS leve com `async/defer`. **Obrigatório: Backups manuais e datados** antes de qualquer alteração no Webnode.
*   **SEO & E-E-A-T:** 
    *   Implementação manual de Schema Markup (JSON-LD) para Workshops.
    *   Uso de deep links para o Google Business Profile.
    *   Criação de páginas de Instrutor para autoridade.
    *   Garantia de NAP (Name, Address, Phone) consistente em todo o site.
*   **UX & Conversão:**
    *   Botão "Ver Datas e Reservar" posicionado **Above the Fold**.
    *   Manter UI limpa e focada na conversão.
    *   Uso estratégico do Elfsight widget.
*   **Sistema de Reservas:** 
    *   Custom-made JS Widget com interface em Overlay/Lightbox.
    *   Experiência Full-screen obrigatória em dispositivos Mobile.
    *   Links obrigatórios para Termos e Políticas de Privacidade no formulário.

## 2. 📝 Regras de Implementação (Clean Code)

*   **Identificadores:** Nomes (funções, classes, variáveis) com no máximo **3 palavras** (ex: `submitBooking` OK, `processNewBookingRequest` NO).
*   **Comentários:** Proibido comentários inline. Apenas JSDoc acima de declarações de classes ou métodos.
*   **Idioma:** Código e documentação técnica (JSDoc) exclusivamente em **Inglês**.
*   **Respostas do Agente:** Em **Português de Portugal**, curtas e concisas.

## 3. 📋 Check-list de Validação

1.  **Low-cost Automation:** Evitar over-engineering (ex: preferir webhooks simples a bases de dados complexas quando possível).
2.  **UI Checklist:** Garantir que elementos críticos estão visíveis sem scroll.
3.  **Segurança:** Validar a presença de links legais (E-E-A-T) antes de qualquer deploy de formulário.

## 4. 📂 Referência de Ficheiros

*   `BOOKING-POC.md`: Estratégia de automação de inventário.
*   `BOOKING-PROPOSTA_TECNICA.md`: Detalhes da implementação técnica.
