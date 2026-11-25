import { conditionsUsedBy, type ConditionTrigger, type ProjectSheet } from './sheet.js';
import { CONDITIONS, type Condition } from './steps.js';
import { isTestSupportFile } from './test-files.js';

const SCREEN_FOLDERS = ['ui/', 'atoms/', 'molecules/', 'organisms/', 'templates/', 'pages/', 'layouts/'];

const GENERAL_TRIGGERS: readonly ConditionTrigger[] = [
  { condition: 'ui', patterns: ['.html', '.scss', '.css', '.svg'] },
  { condition: 'behaviour', patterns: [...SCREEN_FOLDERS, '.routes.ts', '.directive.ts', '.pipe.ts', '.guard.ts'] },
  { condition: 'workflows', patterns: ['.github/'] },
];

const NEVER_TRIGGERS = /\.stories\.ts$/;

const FOLDER_MARK = '/';

export function conditionsOfFiles(files: readonly string[], sheet: ProjectSheet): Condition[] {
  const used = conditionsUsedBy(sheet);
  const productFiles = files.filter((file) => !isTestSupportFile(file) && !NEVER_TRIGGERS.test(file));
  const triggered = new Set(
    [...GENERAL_TRIGGERS, ...sheet.triggers]
      .filter(({ condition }) => used.has(condition))
      .filter(({ patterns }) => productFiles.some((file) => matchesAny(file, patterns)))
      .map(({ condition }) => condition),
  );
  return CONDITIONS.filter((condition) => condition === 'always' || triggered.has(condition));
}

export function matchesPattern(file: string, pattern: string): boolean {
  if (pattern.endsWith(FOLDER_MARK)) {
    return `${FOLDER_MARK}${file}`.includes(`${FOLDER_MARK}${pattern}`);
  }
  return file.endsWith(pattern);
}

function matchesAny(file: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPattern(file, pattern));
}
