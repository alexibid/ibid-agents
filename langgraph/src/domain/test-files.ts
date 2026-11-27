const TEST_SUPPORT_FILE = /\.spec\.ts$|\.mock\.ts$|(?:^|\/)mocks\//;
const E2E_FILE = /(?:^|\/)e2e\/|(?:^|\/)playwright\.config\.[cm]?[jt]s$|(?:^|\/)tsconfig\.e2e\.json$/;
const UNIT_SPEC_FILE = /\.(?:spec|test)\.ts$/;
const STORYBOOK_FILE = /\.stories\.ts$/;

export function isTestSupportFile(file: string): boolean {
  return TEST_SUPPORT_FILE.test(file);
}

export function isE2eFile(file: string): boolean {
  return E2E_FILE.test(file);
}

export function isUnitSpecFile(file: string): boolean {
  return !isE2eFile(file) && UNIT_SPEC_FILE.test(file);
}

export function isStorybookFile(file: string): boolean {
  return STORYBOOK_FILE.test(file);
}
