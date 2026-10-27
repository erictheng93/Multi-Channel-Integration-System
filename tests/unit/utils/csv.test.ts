import { describe, it, expect } from 'vitest';
import { escapeCsvField } from '@/utils/csv';

describe('escapeCsvField', () => {
  it.each(['=', '+', '-', '@', '\t', '\r'])('prefixes a value starting with %j', (ch) => {
    expect(escapeCsvField(`${ch}1+1`)).toBe(`"'${ch}1+1"`);
  });

  it('leaves normal text untouched apart from quoting', () => {
    expect(escapeCsvField('hello world')).toBe('"hello world"');
    expect(escapeCsvField('a=b')).toBe('"a=b"');
  });

  it('still doubles embedded quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('=A1&"x"')).toBe('"\'=A1&""x"""');
  });

  it('handles null, undefined and numbers', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
    expect(escapeCsvField(-5)).toBe('-5');
  });
});
