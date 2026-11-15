# Trader Project Instructions

## Project Structure
- **Data**: `/Users/alexsantos/Documents/trader/data/` (Contains PDFs and CSVs of bank statements and transactions)
- **Scripts**: `/Users/alexsantos/Documents/trader/scripts/` (Python scripts for data processing)
- **Docs**: `/Users/alexsantos/Documents/trader/docs/` (Reports and analysis)

## Regional Settings (pt_PT)
- **Decimal Separator**: Always use a comma (`,`) for numeric values in Google Sheets.
- **Currency**: Always use Euro (`€`) for financial values.
- **Date Format**: DD/MM/YYYY.

## Agent Guidelines
- **@trader-analyst**: Always use absolute paths from the structure defined above. When reading CSVs, ensure data is parsed correctly before reconciliation.
- **@trader-worker**: When writing to Google Sheets, rigorously follow the decimal comma and Euro currency rules.
- **@trader-hunter**: Follow the specific Swing Trade research template defined in private memory.

## Resources
- **Dashboard ID**: `16fQ-9TU1LNN6DItTc2RpdCR2SqA148C-WTluEn_ak0c`
