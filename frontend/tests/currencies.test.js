import { describe, it, expect } from 'vitest';
import { CURRENCIES, searchCurrencies, isCurrency, currencyLabel } from '../src/lib/currencies.js';

describe('currencyLabel', () => {
  it('formats code with name and symbol, passes unknowns through', () => {
    expect(currencyLabel('inr')).toBe('INR — Indian Rupee ₹');
    expect(currencyLabel('WAT')).toBe('WAT');
    expect(currencyLabel('')).toBe('');
  });
});

describe('CURRENCIES', () => {
  it('covers major world currencies with symbols', () => {
    const codes = CURRENCIES.map(c => c.code);
    for (const c of ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AED', 'CHF', 'BRL', 'ZAR', 'KRW', 'MXN']) {
      expect(codes).toContain(c);
    }
    expect(CURRENCIES.length).toBeGreaterThan(140);
    expect(CURRENCIES.find(c => c.code === 'INR').sym).toBe('₹');
  });
});

describe('isCurrency', () => {
  it('accepts known codes case-insensitively, rejects unknown', () => {
    expect(isCurrency('inr')).toBe(true);
    expect(isCurrency('USD')).toBe(true);
    expect(isCurrency('XXX-NOPE')).toBe(false);
    expect(isCurrency('')).toBe(false);
  });
});

describe('searchCurrencies', () => {
  it('matches by code substring', () => {
    expect(searchCurrencies('inr').map(c => c.code)).toContain('INR');
  });
  it('matches by name substring', () => {
    const codes = searchCurrencies('rupee').map(c => c.code);
    expect(codes).toContain('INR');
    expect(codes).toContain('PKR');
  });
  it('matches by symbol', () => {
    expect(searchCurrencies('₹').map(c => c.code)).toContain('INR');
  });
  it('ranks common codes first, then prefix matches', () => {
    const res = searchCurrencies('', ['USD', 'INR']);
    expect(res.slice(0, 2).map(c => c.code).sort()).toEqual(['INR', 'USD']);
    const kr = searchCurrencies('kr').map(c => c.code);
    expect(kr.indexOf('KRW')).toBeLessThan(kr.indexOf('DKK')); // prefix beats substring ('krone')
  });
  it('empty query returns full list', () => {
    expect(searchCurrencies('').length).toBe(CURRENCIES.length);
  });
});
