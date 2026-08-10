import { describe, it, expect } from 'vitest';
import { searchVendors, scoreVendor } from '../src/lib/vendorSearch.js';

const names = list => list.map(v => v.name);

const VENDORS = [
  {
    name: 'Sensirion AG', category: 'Humidity and flow sensor modules',
    type: 'International', departments: ['R&D', 'Production'],
    address: 'Stäfa, Switzerland', paymentTerms: 'Advance 50%', notes: ''
  },
  {
    name: 'Plantower', category: 'Particulate modules',
    type: 'International', departments: ['R&D'],
    address: 'Beijing, China', notes: 'Long lead times'
  },
  {
    name: 'Precision Sheet Metal Works', category: 'Enclosure fabrication',
    type: 'Domestic', departments: ['Production'],
    address: 'Ahmedabad, Gujarat', notes: 'Powder coating in house'
  },
  {
    name: 'Shakti Works', category: 'CNC machining',
    type: 'Domestic', departments: ['Production'],
    address: 'Rajkot, Gujarat', notes: ''
  },
  {
    name: 'NABL Calibration Services', category: 'Certification',
    type: 'Domestic', departments: ['QC'], address: 'Pune',
    notes: 'Reference analyser calibration'
  },
  {
    name: 'Ganesh Enterprise', category: 'Local hardware',
    type: 'Domestic', departments: ['Admin'], address: 'Ahmedabad, Gujarat',
    notes: '', accountNumber: '50100123456789', ifsc: 'HDFC0001234',
    swift: 'HDFCINBB', gstTaxId: '24AABCU9603R1ZM'
  }
];

describe('searchVendors — no query', () => {
  it('returns every vendor in the order given', () => {
    expect(names(searchVendors(VENDORS, ''))).toEqual(names(VENDORS));
  });

  it('treats a whitespace-only query as empty', () => {
    expect(searchVendors(VENDORS, '   ')).toHaveLength(VENDORS.length);
  });
});

describe('searchVendors — literal matching', () => {
  it('finds a vendor by an exact word in its name', () => {
    expect(names(searchVendors(VENDORS, 'sensirion'))).toEqual(['Sensirion AG']);
  });

  it('matches case-insensitively', () => {
    expect(names(searchVendors(VENDORS, 'SENSIRION'))).toEqual(['Sensirion AG']);
  });

  it('finds vendors by category', () => {
    expect(names(searchVendors(VENDORS, 'machining'))).toEqual(['Shakti Works']);
  });

  it('finds vendors by department', () => {
    expect(names(searchVendors(VENDORS, 'qc'))).toEqual(['NABL Calibration Services']);
  });
});

describe('searchVendors — typo tolerance', () => {
  it('finds Sensirion from a one-letter misspelling', () => {
    expect(names(searchVendors(VENDORS, 'sensiron'))).toContain('Sensirion AG');
  });

  it('does not fuzzy-match terms shorter than four characters', () => {
    // "snr" is within a small edit distance of plenty of words; at this length
    // that produces noise, not tolerance.
    expect(searchVendors(VENDORS, 'snr')).toEqual([]);
  });
});

describe('searchVendors — synonyms', () => {
  it('finds a particulate supplier that never uses the word "sensor"', () => {
    const hits = names(searchVendors(VENDORS, 'sensor'));
    expect(hits).toContain('Plantower');
  });

  it('finds a machine shop from "fab"', () => {
    expect(names(searchVendors(VENDORS, 'fab'))).toContain('Shakti Works');
  });

  it('expands "local" to domestic vendors', () => {
    expect(names(searchVendors(VENDORS, 'local'))).toContain('Ganesh Enterprise');
  });
});

describe('searchVendors — multiple terms', () => {
  it('requires every term to match (AND, not OR)', () => {
    // Ganesh is in Ahmedabad but does no fabrication; Precision is both.
    expect(names(searchVendors(VENDORS, 'ahmedabad fabrication')))
      .toEqual(['Precision Sheet Metal Works']);
  });

  it('returns nothing when one term matches nobody', () => {
    expect(searchVendors(VENDORS, 'ahmedabad zzzzzzz')).toEqual([]);
  });
});

describe('searchVendors — ranking', () => {
  it('ranks a name match above a notes-only match', () => {
    const hits = names(searchVendors(VENDORS, 'calibration'));
    expect(hits[0]).toBe('NABL Calibration Services');
  });

  it('ranks an exact match above a fuzzy one', () => {
    const pool = [
      { name: 'Sensiron Systems', category: '' },   // exact match for "sensiron"
      { name: 'Sensirion AG', category: '' }        // one edit away
    ];
    expect(names(searchVendors(pool, 'sensiron'))[0]).toBe('Sensiron Systems');
  });
});

describe('searchVendors — banking data is never indexed', () => {
  it('does not match an account number', () => {
    expect(searchVendors(VENDORS, '50100123456789')).toEqual([]);
  });

  it('does not match an IFSC, SWIFT or GST number', () => {
    expect(searchVendors(VENDORS, 'HDFC0001234')).toEqual([]);
    expect(searchVendors(VENDORS, 'HDFCINBB')).toEqual([]);
    expect(searchVendors(VENDORS, '24AABCU9603R1ZM')).toEqual([]);
  });
});

describe('scoreVendor', () => {
  it('scores zero when nothing matches', () => {
    expect(scoreVendor(VENDORS[0], 'zzzzzzz')).toBe(0);
  });

  it('scores a name hit higher than an address hit', () => {
    const byName = scoreVendor(VENDORS[2], 'precision');
    const byAddress = scoreVendor(VENDORS[2], 'ahmedabad');
    expect(byName).toBeGreaterThan(byAddress);
  });
});
