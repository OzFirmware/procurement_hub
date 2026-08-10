// Vendor search that matches intent rather than substrings.
//
// A registry this size doesn't justify embeddings: they'd need an API key in
// Script Properties, cost per vendor, and vectors that go stale on every edit —
// for worse results than a tuned lexical matcher over short, structured
// records. What actually helps here is searching every descriptive field,
// tolerating typos in the long ones, and knowing that "fab" and "machining"
// describe the same shop.

// Weighted so a hit on the vendor's name outranks one buried in its notes.
const FIELDS = [
  { key: 'name', weight: 3 },
  { key: 'displayName', weight: 3 },
  { key: 'category', weight: 2 },
  { key: 'type', weight: 2 },
  { key: 'departments', weight: 2 },
  { key: 'contactPerson', weight: 1 },
  { key: 'address', weight: 1 },
  { key: 'paymentTerms', weight: 1 },
  { key: 'notes', weight: 1 }
];
// accountNumber, ifsc, swift and gstTaxId are deliberately absent: banking
// identifiers are not search terms, and indexing them would let anyone confirm
// an account number by typing it.

// Maps a concept someone might type to words that plausibly appear in the data.
// Never to vendor names — "sensor" → "Sensirion" would quietly stop being true
// the day a second sensor supplier is registered.
const SYNONYMS = {
  sensor: ['pm', 'gas', 'module', 'electrochemical', 'particulate'],
  sensors: ['pm', 'gas', 'module', 'electrochemical', 'particulate'],
  fab: ['fabrication', 'enclosure', 'sheet metal', 'machining'],
  fabrication: ['enclosure', 'sheet metal', 'machining'],
  enclosure: ['fabrication', 'sheet metal', 'machining'],
  calibration: ['nabl', 'certification', 'testing'],
  certification: ['nabl', 'calibration', 'testing'],
  electronics: ['components', 'distributor', 'semiconductor'],
  components: ['electronics', 'distributor', 'semiconductor'],
  local: ['india', 'domestic'],
  domestic: ['india', 'local'],
  foreign: ['international', 'import'],
  import: ['international', 'foreign']
};

// Match quality, best-first. A term scores by the strongest rule it satisfies.
const EXACT = 1, PREFIX = 0.7, SUBSTRING = 0.5, SYNONYM = 0.4, FUZZY = 0.3;

// Below four characters, edit distance stops being typo tolerance and starts
// matching everything.
const MIN_FUZZY_LEN = 4;
const fuzzyBudget = term => term.length >= 7 ? 2 : term.length >= MIN_FUZZY_LEN ? 1 : 0;

const norm = v => String(v == null ? '' : v).toLowerCase().trim();

function fieldText(vendor, key) {
  const raw = vendor[key];
  return norm(Array.isArray(raw) ? raw.join(' ') : raw);
}

export function terms(query) {
  return norm(query).split(/[\s,]+/).filter(Boolean);
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99; // caller never allows > 2
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
}

// How well one term matches one field's text, ignoring synonyms.
function literalQuality(text, term) {
  if (!text || !term) return 0;
  const words = text.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.includes(term)) return EXACT;
  if (words.some(w => w.startsWith(term))) return PREFIX;
  if (text.includes(term)) return SUBSTRING;
  const budget = fuzzyBudget(term);
  if (budget && words.some(w => levenshtein(w, term) <= budget)) return FUZZY;
  return 0;
}

// Literal match first; only if that fails does the term get expanded, so a
// synonym can never outrank the word someone actually typed.
function termQuality(text, term) {
  const literal = literalQuality(text, term);
  if (literal) return literal;
  const expansions = SYNONYMS[term];
  if (!expansions) return 0;
  const hit = expansions.some(syn => syn.includes(' ')
    ? text.includes(syn)
    : literalQuality(text, syn) >= SUBSTRING);
  return hit ? SYNONYM : 0;
}

// Every term must land somewhere (AND). One unmatched term drops the vendor —
// with OR, a second word could only ever widen the result set, which is the
// opposite of what typing more words means.
export function scoreVendor(vendor, query) {
  const list = Array.isArray(query) ? query : terms(query);
  if (!list.length) return 0;
  let total = 0;
  for (const term of list) {
    let best = 0;
    for (const { key, weight } of FIELDS) {
      best = Math.max(best, termQuality(fieldText(vendor, key), term) * weight);
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}

export function searchVendors(vendors, query) {
  const list = terms(query);
  if (!list.length) return [...(vendors || [])];
  return (vendors || [])
    .map(v => ({ v, score: scoreVendor(v, list) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score ||
      norm(a.v.displayName || a.v.name).localeCompare(norm(b.v.displayName || b.v.name)))
    .map(r => r.v);
}
