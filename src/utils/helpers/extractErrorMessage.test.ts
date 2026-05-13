import { extractErrorMessage } from './index.js';

describe('extractErrorMessage', () => {
  it('returns Error.message for Error instances', () => {
    expect(extractErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('returns the .error string when present on a plain object', () => {
    expect(extractErrorMessage({ error: 'something failed' })).toBe(
      'something failed',
    );
  });

  it('JSON-stringifies plain objects without an .error string', () => {
    expect(extractErrorMessage({ code: 42 })).toBe('{"code":42}');
  });

  it('falls back to String() when the object is circular (no throw)', () => {
    const circular: Record<string, unknown> = { code: 1 };
    circular.self = circular;

    expect(() => extractErrorMessage(circular)).not.toThrow();
    const result = extractErrorMessage(circular);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('coerces primitives via String()', () => {
    expect(extractErrorMessage('plain text')).toBe('plain text');
    expect(extractErrorMessage(123)).toBe('123');
    expect(extractErrorMessage(null)).toBe('null');
    expect(extractErrorMessage(undefined)).toBe('undefined');
  });
});
