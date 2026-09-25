import { describe, expect, it } from 'vitest';
import { crossBorderProblem, normalizeCountry } from './crossBorder';

describe('normalizeCountry', () => {
  it('folds the ways people write Indonesia into one', () => {
    for (const input of ['Indonesia', ' indonesia ', 'ID', 'idn', 'Republik Indonesia', 'RI']) {
      expect(normalizeCountry(input)).toBe('indonesia');
    }
  });

  it('returns empty for nothing', () => {
    expect(normalizeCountry(undefined)).toBe('');
    expect(normalizeCountry('   ')).toBe('');
  });
});

describe('crossBorderProblem', () => {
  it('allows a buyer abroad buying from Indonesia', () => {
    expect(crossBorderProblem('Singapore', 'Indonesia')).toBeNull();
    expect(crossBorderProblem('Japan', 'ID')).toBeNull();
  });

  it('allows Indonesia buying from abroad', () => {
    expect(crossBorderProblem('Indonesia', 'Malaysia')).toBeNull();
  });

  it('refuses two parties inside Indonesia, citing the law', () => {
    expect(crossBorderProblem('Indonesia', 'indonesia')).toMatch(/Law 4\/2026/);
    expect(crossBorderProblem('ID', 'Republik Indonesia')).toMatch(/Law 4\/2026/);
  });

  it('refuses when either side has not said where they are', () => {
    expect(crossBorderProblem('', 'Indonesia')).toMatch(/Add your country/);
    expect(crossBorderProblem('Singapore', undefined)).toMatch(/has not said/);
  });

  it('refuses two parties in the same other country', () => {
    expect(crossBorderProblem('Singapore', 'singapore')).toMatch(/cross a border/);
  });
});
