#!/usr/bin/env bun

import * as ts from 'typescript';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

interface TypeDebtCounts {
  any: number;
  asAny: number;
}

type TypeDebtAllowlist = Record<string, TypeDebtCounts>;

interface Violation {
  file: string;
  metric: keyof TypeDebtCounts;
  current: number;
  allowed: number;
}

const allowlistPath = 'scripts/type-debt-allowlist.json';
const roots = ['src', 'frontend/src'];
const ignoredPathParts = new Set(['node_modules', 'dist', 'coverage', '__tests__']);
const ignoredFileSuffixes = ['.d.ts', '.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx'];
const shouldUpdate = Bun.argv.includes('--update');

function isSourceFile(path: string): boolean {
  return (
    (path.endsWith('.ts') || path.endsWith('.tsx')) &&
    !ignoredFileSuffixes.some((suffix) => path.endsWith(suffix))
  );
}

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      if (!ignoredPathParts.has(entry)) {
        files.push(...collectFiles(fullPath));
      }
      continue;
    }

    if (stats.isFile() && isSourceFile(fullPath)) {
      files.push(relative(process.cwd(), fullPath).replace(/\\/g, '/'));
    }
  }

  return files;
}

function countTypeDebt(file: string): TypeDebtCounts {
  const sourceText = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const counts: TypeDebtCounts = { any: 0, asAny: 0 };

  function visit(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      counts.any += 1;
    }

    if (
      ts.isAsExpression(node) &&
      node.type.kind === ts.SyntaxKind.AnyKeyword
    ) {
      counts.asAny += 1;
    }

    if (
      ts.isTypeAssertionExpression(node) &&
      node.type.kind === ts.SyntaxKind.AnyKeyword
    ) {
      counts.asAny += 1;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return counts;
}

function hasDebt(counts: TypeDebtCounts): boolean {
  return counts.any > 0 || counts.asAny > 0;
}

function buildCurrentDebt(): TypeDebtAllowlist {
  const result: TypeDebtAllowlist = {};
  const files = roots.flatMap(collectFiles).sort();

  for (const file of files) {
    const counts = countTypeDebt(file);
    if (hasDebt(counts)) {
      result[file] = counts;
    }
  }

  return result;
}

function readAllowlist(): TypeDebtAllowlist {
  if (!existsSync(allowlistPath)) {
    return {};
  }

  return JSON.parse(readFileSync(allowlistPath, 'utf8')) as TypeDebtAllowlist;
}

function writeAllowlist(allowlist: TypeDebtAllowlist) {
  writeFileSync(allowlistPath, `${JSON.stringify(allowlist, null, 2)}\n`);
}

function compareAgainstAllowlist(
  current: TypeDebtAllowlist,
  allowlist: TypeDebtAllowlist
): Violation[] {
  const violations: Violation[] = [];

  for (const [file, counts] of Object.entries(current)) {
    const allowed = allowlist[file] ?? { any: 0, asAny: 0 };

    for (const metric of ['any', 'asAny'] as const) {
      if (counts[metric] > allowed[metric]) {
        violations.push({
          file,
          metric,
          current: counts[metric],
          allowed: allowed[metric],
        });
      }
    }
  }

  return violations;
}

const current = buildCurrentDebt();

if (shouldUpdate) {
  writeAllowlist(current);
  console.log(`check-type-debt: wrote ${Object.keys(current).length} allowlisted file(s).`);
  process.exit(0);
}

const allowlist = readAllowlist();
const violations = compareAgainstAllowlist(current, allowlist);

if (violations.length > 0) {
  console.error('\nNew production type debt detected:\n');
  for (const violation of violations) {
    console.error(
      `  ${violation.file}: ${violation.metric} ${violation.current} > ${violation.allowed}`
    );
  }
  console.error('');
  console.error('Fix the new explicit any/as any usage, or run this only after intentionally');
  console.error('reviewing and updating scripts/type-debt-allowlist.json.');
  process.exit(1);
}

const totalAny = Object.values(current).reduce((sum, counts) => sum + counts.any, 0);
const totalAsAny = Object.values(current).reduce((sum, counts) => sum + counts.asAny, 0);

console.log(
  `check-type-debt: ${Object.keys(current).length} file(s), ${totalAny} any keyword(s), ${totalAsAny} as any assertion(s); no increases.`
);
