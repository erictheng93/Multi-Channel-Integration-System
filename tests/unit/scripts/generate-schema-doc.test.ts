// db:doc:schema:check comparison (scripts/generate-schema-doc.ts), offline: no database involved.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isSchemaDocCurrent } from '../../../scripts/generate-schema-doc';

// The committed doc, normalised to LF: what render() would emit for the same database.
const generated = readFileSync(resolve(__dirname, '../../../docs/architecture/SCHEMA.md'), 'utf8').replace(/\r\n/g, '\n');

describe('isSchemaDocCurrent', () => {
  it('accepts an identical doc', () => {
    expect(isSchemaDocCurrent(generated, generated)).toBe(true);
  });

  it('accepts a CRLF working copy (core.autocrlf=true) of an LF render', () => {
    const crlf = generated.replace(/\n/g, '\r\n');
    expect(crlf).not.toBe(generated);
    expect(isSchemaDocCurrent(crlf, generated)).toBe(true);
  });

  it('ignores the generation timestamp and source lines', () => {
    const regenerated = generated
      .replace(/^> \*\*產生時間\*\*.*$/m, '> **產生時間**：2099-01-01T00:00:00.000Z')
      .replace(/^> \*\*資料來源\*\*.*$/m, '> **資料來源**：somewhere else');
    expect(regenerated).not.toBe(generated);
    expect(isSchemaDocCurrent(generated.replace(/\n/g, '\r\n'), regenerated)).toBe(true);
  });

  it('still reports a real difference, with either line ending', () => {
    const changed = generated.replace('customers_platform_platform_user_id_unique', 'customers_renamed_unique');
    expect(changed).not.toBe(generated);
    expect(isSchemaDocCurrent(generated, changed)).toBe(false);
    expect(isSchemaDocCurrent(generated.replace(/\n/g, '\r\n'), changed)).toBe(false);
  });
});
