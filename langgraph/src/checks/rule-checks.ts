import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProjectSheet } from '../domain/sheet.js';
import { findComments } from './comment-scanner.js';

export interface Violation {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

export interface RuleScope {
  readonly workspaceRoot: string;
  readonly sheet: ProjectSheet;
}

interface SourceFile {
  readonly file: string;
  readonly content: string;
}

type RuleCheck = (source: SourceFile) => Violation[];

const MAX_LINES = 300;
const CHECKED_FILE = /\.(ts|html|scss)$/;
const SCRIPT_OR_STYLE = /\.(ts|scss)$/;
const TEMPLATE = /\.html$/;
const ATOM_FOLDER = /\/atoms\//;
const NATIVE_ELEMENT = /<(button|input|select|dialog|textarea)\b/;
const HTML_COMMENT = /<!--/;
const DESIGN_TOOL = /\bfigma\b|paper\.design|\bpaper mcp\b/i;

const GENERAL_CHECKS: readonly RuleCheck[] = [fileLength, comments, templateComments, designTools];
const DESIGN_SYSTEM_CHECKS: readonly RuleCheck[] = [nativeElements];

export async function checkRules(files: readonly string[], { workspaceRoot, sheet }: RuleScope): Promise<Violation[]> {
  const checks = checksFor(sheet);
  const sources = await Promise.all(files.filter((file) => CHECKED_FILE.test(file)).map((file) => load(file, workspaceRoot)));
  return sources.flatMap((source) => (source.content === '' ? [] : checks.flatMap((check) => check(source))));
}

function checksFor(sheet: ProjectSheet): readonly RuleCheck[] {
  return sheet.reuses.length > 0 ? [...GENERAL_CHECKS, ...DESIGN_SYSTEM_CHECKS] : GENERAL_CHECKS;
}

async function load(file: string, workspaceRoot: string): Promise<SourceFile> {
  return { file, content: await readFile(join(workspaceRoot, file), 'utf8').catch(() => '') };
}

function fileLength({ file, content }: SourceFile): Violation[] {
  const lines = content.split('\n').length;
  return lines > MAX_LINES
    ? [{ rule: 'W13', file, line: MAX_LINES + 1, message: `The file has ${lines} lines; the limit is ${MAX_LINES}.` }]
    : [];
}

function comments({ file, content }: SourceFile): Violation[] {
  if (!SCRIPT_OR_STYLE.test(file)) {
    return [];
  }
  return findComments(content).map(({ line, text }) => ({
    rule: 'W22',
    file,
    line,
    message: `Comments are forbidden: ${text.slice(0, 60)}`,
  }));
}

function templateComments(source: SourceFile): Violation[] {
  return TEMPLATE.test(source.file) ? matchingLines(source, HTML_COMMENT, 'W22', 'Comments are forbidden in templates.') : [];
}

function nativeElements(source: SourceFile): Violation[] {
  if (!TEMPLATE.test(source.file) || ATOM_FOLDER.test(source.file)) {
    return [];
  }
  return matchingLines(source, NATIVE_ELEMENT, 'W09', 'A native element is used outside the atom that wraps it.');
}

function designTools(source: SourceFile): Violation[] {
  return matchingLines(source, DESIGN_TOOL, 'W24', 'Source names a design tool.');
}

function matchingLines({ file, content }: SourceFile, pattern: RegExp, rule: string, message: string): Violation[] {
  return content
    .split('\n')
    .flatMap((text, index) => (pattern.test(text) ? [{ rule, file, line: index + 1, message }] : []));
}
