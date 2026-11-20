const TEST_SUPPORT_FILE = /\.spec\.ts$|\.mock\.ts$|(?:^|\/)mocks\//;

export function isTestSupportFile(file: string): boolean {
  return TEST_SUPPORT_FILE.test(file);
}
