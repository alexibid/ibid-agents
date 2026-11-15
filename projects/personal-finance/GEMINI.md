# Personal Finance Automation

## 📂 Estrutura do Projeto
- `automate_sync.py`: **O único comando que precisas de correr.** Ele orquestra todo o fluxo.
- `data/`: Contém o histórico completo (`bank_data_full.json`) e ficheiros temporários de cache.
- `scripts/`: A lógica Python para processamento de datas, ciclos e formatação.
- `analysis/`: Ferramentas para procurar salários e bónus.
- `backups/`: Guarda versões antigas se necessário.

## 🚀 Como Adicionar Novos Movimentos
Quando tiveres um novo extrato bancário:
1. Copia o conteúdo do CSV ou texto.
2. Pede ao Gemini: *"@personal-finance Adiciona estes movimentos e sincroniza: [COLA O TEXTO AQUI]"*.
3. O Gemini criará um script temporário na pasta `data/` para fundir os dados e depois correrá o `python3 automate_sync.py`.

## 📊 Google Sheets
- **Nome:** `consolidado - Fevereiro 2026`
- **ID:** `1WsmvpZTv1PuAes4zEratJcLQiXI7nlYd_s9qWNMQi2k`
- **Tabs Automáticas:** `2025_2026-original.csv` e todas as tabs de meses (ex: `2026-03`).

## ⚠️ Regras Importantes
- **Não apagar `data/bank_data_full.json`**: É a tua base de dados principal.
- **Deduplicação**: O sistema usa o trio (Data, Descrição, Valor) para garantir que nada é repetido.
- **Formatação de Valores**: Usar sempre números puros com vírgula para decimais (ex: `1234,56`), sem pontos de milhares e sem o símbolo `€`, para garantir que o Sheets os reconhece como números.
