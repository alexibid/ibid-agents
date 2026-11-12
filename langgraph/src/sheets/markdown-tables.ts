export type TableRow = readonly string[];

const HEADING = /^##\s+(.*)$/;
const SEPARATOR_ROW = /^\|\s*-{3,}/;

export function rowsUnderHeading(markdown: string, heading: string): TableRow[] {
  return dataRows(linesUnderHeading(markdown, heading));
}

export function rowsBeforeFirstHeading(markdown: string): TableRow[] {
  const lines = markdown.split('\n');
  const firstHeading = lines.findIndex((line) => HEADING.test(line));
  return dataRows(firstHeading === -1 ? lines : lines.slice(0, firstHeading));
}

export function codeSpans(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

function linesUnderHeading(markdown: string, heading: string): string[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => HEADING.exec(line)?.[1]?.trim() === heading);
  if (start === -1) {
    return [];
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => HEADING.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

function dataRows(lines: readonly string[]): TableRow[] {
  const tableLines = lines.filter((line) => line.trim().startsWith('|'));
  return tableLines.filter((line, index) => index > 0 && !SEPARATOR_ROW.test(line.trim())).map(cellsOf);
}

function cellsOf(line: string): TableRow {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}
