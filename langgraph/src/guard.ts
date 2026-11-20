#!/usr/bin/env node
import { text } from 'node:stream/consumers';
import { hasActiveFlow } from './guard/active-flow.js';
import { ruleOn, type Ruling } from './guard/policy.js';
import { reservedPortsOf } from './guard/reserved-ports.js';
import { readPayload } from './guard/tool-payloads.js';

const NOT_THIS_WORKSPACE: Ruling = { allowed: true, rule: '', reason: '' };

const workspaceRoot = process.env['IBID_WORKSPACE_ROOT'] ?? process.cwd();
const dialect = readPayload(await text(process.stdin), workspaceRoot, await reservedPortsOf(workspaceRoot), hasActiveFlow());
const sessionIsInWorkspace = dialect.sessionDirectories.some(
  (directory) => directory === workspaceRoot || directory.startsWith(`${workspaceRoot}/`),
);
const answer = dialect.answer(sessionIsInWorkspace ? ruleOn(dialect.attempt) : NOT_THIS_WORKSPACE);

if (answer !== '') {
  process.stdout.write(`${answer}\n`);
}
