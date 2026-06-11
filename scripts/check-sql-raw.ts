/**
 * check-sql-raw.ts
 *
 * Defence-in-depth against SQL injection: scans src/ for calls to
 * `sql.raw(...)` where the argument is anything other than a plain string
 * literal or an un-interpolated template literal, and fails the build.
 *
 * Context:
 *   drizzle-orm's `sql.raw()` is an intentional escape hatch -- whatever
 *   string you pass goes directly into the SQL. It cannot be made safe by
 *   any drizzle version. Every SQL injection we have shipped in this repo
 *   traces back to a `sql.raw()` call with an interpolated or concatenated
 *   argument (see git log for auto-reply-logs handler and the performance.ts
 *   deletion). This script is the CI-level tripwire so future regressions
 *   are caught before they land.
 *
 * Accepted forms:
 *   sql.raw("SELECT ...")            -- string literal
 *   sql.raw(`SELECT ...`)            -- template literal with NO ${...}
 *
 * Rejected forms:
 *   sql.raw(query)                   -- identifier
 *   sql.raw(`... ${x} ...`)          -- template with substitutions
 *   sql.raw("a" + b)                 -- concatenation
 *   sql.raw(buildSql())              -- function call
 *
 * Escape hatch:
 *   If a sql.raw call is provably safe (e.g. the interpolated value is
 *   regex-validated against a narrow allowlist immediately before), add
 *
 *     // eslint-disable-next-line no-unsafe-sql-raw
 *
 *   on the line above the call, together with a comment explaining why the
 *   value cannot break out of the SQL context.
 *
 * Usage:
 *   bun scripts/check-sql-raw.ts           (all of src/)
 *   bun scripts/check-sql-raw.ts <file>    (single file, useful for hooks)
 *
 * Exit codes:
 *   0 = no violations
 *   1 = one or more violations (or a filesystem / parse error)
 */

import * as ts from 'typescript';
import { readFileSync } from 'fs';

interface Violation {
  file: string;
  line: number;
  column: number;
  snippet: string;
  argKind: string;
}

const SUPPRESSION_RE = /eslint-disable(?:-next-line)?\s+no-unsafe-sql-raw/;

function describeArgKind(arg: ts.Node | undefined): string {
  if (!arg) return 'missing';
  if (ts.isStringLiteral(arg)) return 'StringLiteral';
  if (ts.isNoSubstitutionTemplateLiteral(arg)) return 'NoSubstitutionTemplateLiteral';
  if (ts.isTemplateExpression(arg)) return 'TemplateExpression (interpolated)';
  if (ts.isBinaryExpression(arg)) return 'BinaryExpression (concatenation?)';
  if (ts.isIdentifier(arg)) return 'Identifier';
  if (ts.isCallExpression(arg)) return 'CallExpression';
  if (ts.isPropertyAccessExpression(arg)) return 'PropertyAccessExpression';
  return ts.SyntaxKind[arg.kind];
}

function checkFile(filePath: string): Violation[] {
  const content = readFileSync(filePath, 'utf-8');
  const sf = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true
  );
  const lines = content.split('\n');
  const violations: Violation[] = [];

  function visit(node: ts.Node) {
    // Match: <anything>.raw(<something>) where the LHS identifier is `sql`.
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'raw' &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'sql'
    ) {
      const arg = node.arguments[0];
      const isSafe =
        arg !== undefined &&
        (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg));

      if (!isSafe) {
        const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart());
        const thisLine = lines[line] ?? '';
        const prevLine = line > 0 ? lines[line - 1] ?? '' : '';
        const suppressed =
          SUPPRESSION_RE.test(prevLine) || SUPPRESSION_RE.test(thisLine);

        if (!suppressed) {
          violations.push({
            file: filePath,
            line: line + 1,
            column: character + 1,
            snippet: thisLine.trim(),
            argKind: describeArgKind(arg),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return violations;
}

async function main() {
  const argFiles = process.argv.slice(2);

  let files: string[];
  if (argFiles.length > 0) {
    // Targeted mode (e.g. pre-commit hook passing staged files)
    files = argFiles.filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'));
  } else {
    // Full-repo mode
    files = (await Array.fromAsync(new Bun.Glob('src/**/*.ts').scan('.')))
      .filter(f => !f.endsWith('.d.ts') && !f.includes('node_modules'));
  }

  if (files.length === 0) {
    console.log('check-sql-raw: no TypeScript files to scan.');
    return;
  }

  const allViolations: Violation[] = [];
  for (const file of files) {
    try {
      allViolations.push(...checkFile(file));
    } catch (err) {
      console.error(`check-sql-raw: failed to parse ${file}:`, err);
      process.exit(1);
    }
  }

  if (allViolations.length > 0) {
    console.error('\nUnsafe sql.raw() usage detected:\n');
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line}:${v.column}`);
      console.error(`    ${v.snippet}`);
      console.error(`    argument kind: ${v.argKind}`);
      console.error('');
    }
    console.error(`${allViolations.length} violation(s) across ${files.length} scanned file(s).`);
    console.error('');
    console.error("sql.raw() bypasses Drizzle's parameter binding and can introduce SQL injection.");
    console.error('');
    console.error('Fix options:');
    console.error('  1. Rewrite using the Drizzle query builder (eq, and, or, like, inArray, ...).');
    console.error('  2. Use the `sql\\`...\\`` template tag -- it binds identifiers safely and');
    console.error('     supports nested Drizzle expressions.');
    console.error('  3. If the call is provably safe (e.g. argument is regex-validated against');
    console.error('     a narrow allowlist), add this comment above the call:');
    console.error('       // eslint-disable-next-line no-unsafe-sql-raw');
    console.error('     together with a plain-text note explaining why the value is safe.');
    process.exit(1);
  }

  console.log(`check-sql-raw: scanned ${files.length} file(s), 0 violations.`);
}

main().catch((err) => {
  console.error('check-sql-raw failed:', err);
  process.exit(1);
});
