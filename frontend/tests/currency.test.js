import { describe, it, expect } from 'vitest';
import { normCur, detectCur, parseAmtStr, fmtMoney, fmtCompact } from '../src/lib/currency.js';

describe('normCur', () => {
  it('maps tokens to ISO codes', () => {
    expect(normCur('USD')).toBe('USD');
    expect(normCur('rupee')).toBe('INR');
    expect(normCur('₹')).toBe('INR');
    expect(normCur('€')).toBe('EUR');
    expect(normCur('')).toBe(null);
    expect(normCur(null)).toBe(null);
  });
  it('passes through unknown 3-letter codes uppercased', () => {
    expect(normCur('sek')).toBe('SEK');
  });
});

describe('detectCur', () => {
  it('prefers currency column', () => {
    expect(detectCur('USD', '₹500')).toEqual({ cur: 'USD', auto: false });
  });
  it('falls back to amount string', () => {
    expect(detectCur('', '$120')).toEqual({ cur: 'USD', auto: true });
  });
  it('guesses INR for bare numbers', () => {
    expect(detectCur('', '4500')).toEqual({ cur: 'INR', auto: false, guess: true });
  });
});

describe('parseAmtStr', () => {
  it('parses numbers with commas', () => {
    expect(parseAmtStr('1,23,456.78').amt).toBe(123456.78);
  });
  it('returns empty for NA-like values', () => {
    expect(parseAmtStr('N/A')).toEqual({});
    expect(parseAmtStr('tbd')).toEqual({});
    expect(parseAmtStr(null)).toEqual({});
  });
  it('keeps note when no number found', () => {
    expect(parseAmtStr('pending quote').note).toBe('pending quote');
  });
});

describe('formatting', () => {
  it('formats INR with Indian locale', () => {
    expect(fmtMoney('INR', 123456)).toBe('₹1,23,456');
  });
  it('compacts INR to lakh/crore', () => {
    expect(fmtCompact('INR', 250000)).toBe('₹2.5L');
    expect(fmtCompact('INR', 30000000)).toBe('₹3.00 Cr');
  });
  it('compacts USD to K/M', () => {
    expect(fmtCompact('USD', 1500)).toBe('$1.5K');
  });
});
