// Price generator and Finnish number-to-words utilities (MVP scope)
// Draft implementation: clear, small, and easily testable.

/**
 * @typedef {Object} CatalogItem
 * @property {string} id
 * @property {string} nameFi
 * @property {string} category
 * @property {[number, number]} priceRangeEuros
 * @property {string} centsBias // key into bias presets
 */

/**
 * @typedef {Object} Catalog
 * @property {number} version
 * @property {{id:string,nameFi:string}[]} categories
 * @property {Record<string, Record<string, number>>} centsBiasPresets
 * @property {CatalogItem[]} items
 */

/**
 * Fetch catalog.json from public path.
 * @returns {Promise<Catalog>}
 */
export async function fetchCatalog() {
  const res = await fetch('/prices/catalog.json');
  if (!res.ok) throw new Error(`catalog.json ${res.status}`);
  return /** @type {Catalog} */ (await res.json());
}

/**
 * Generate a random price (euros,cents) for a given item using bias.
 * @param {Catalog} catalog
 * @param {CatalogItem} item
 */
export function generatePrice(catalog, item) {
  const [minE, maxE] = item.priceRangeEuros;
  const euros = Math.floor(minE + Math.random() * (maxE - minE + 1));
  const bias = catalog.centsBiasPresets[item.centsBias] || catalog.centsBiasPresets['default'];
  const cents = pickCentsWithBias(bias);
  return { euros, cents };
}

/**
 * Pick cents using bias weights.
 * @param {Record<string, number>} bias
 */
function pickCentsWithBias(bias) {
  // candidates: 00, 90, 95, 99, any (uniform among others)
  const entries = Object.entries(bias);
  const total = entries.reduce((s, [, w]) => s + (w || 0), 0);
  let r = Math.random() * total;
  for (const [key, weight] of entries) {
    r -= weight;
    if (r <= 0) {
      if (key === 'any') {
        // uniform among 0..99 excluding the explicit keys
        const locked = new Set(['00','90','95','99']);
        let c = Math.floor(Math.random() * 100);
        if (locked.has(c.toString().padStart(2,'0'))) {
          c = (c + 1) % 100;
        }
        return c;
      }
      return Number(key);
    }
  }
  return 0;
}

// ---------------- Finnish number words (euros focus) ----------------

const SIMPLE = {
  0: 'nolla', 1: 'yksi', 2: 'kaksi', 3: 'kolme', 4: 'neljä', 5: 'viisi',
  6: 'kuusi', 7: 'seitsemän', 8: 'kahdeksan', 9: 'yhdeksän',
  10: 'kymmenen', 11: 'yksitoista', 12: 'kaksitoista', 13: 'kolmetoista', 14: 'neljätoista',
  15: 'viisitoista', 16: 'kuusitoista', 17: 'seitsemäntoista', 18: 'kahdeksantoista', 19: 'yhdeksäntoista'
};

/**
 * Convert number 0..9999 to Finnish cardinal words (basic, no hyphenation).
 * MVP: prioritizes clarity for price expressions.
 * @param {number} n
 */
export function numberToFinnishWords(n) {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return '';
  if (n < 20) return SIMPLE[n];
  if (n < 100) return tensToWords(n);
  if (n < 1000) return hundredsToWords(n);
  return thousandsToWords(n);
}

function tensToWords(n) {
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (unit === 0) {
    // 20,30,...90 → kaksikymmentä, kolmekymmentä, ...
    return (tens === 2 ? 'kaksi' : SIMPLE[tens]) + 'kymmentä';
  }
  if (tens === 1) return SIMPLE[n]; // 11..19 handled
  return (tens === 2 ? 'kaksi' : SIMPLE[tens]) + 'kymmentä ' + SIMPLE[unit];
}

function hundredsToWords(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? 'sata' : (SIMPLE[hundreds] + 'sataa');
  if (rest === 0) return head;
  if (rest < 100) return head + ' ' + (rest < 20 ? SIMPLE[rest] : tensToWords(rest));
  return head + ' ' + hundredsToWords(rest);
}

function thousandsToWords(n) {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const head = thousands === 1 ? 'tuhat' : (SIMPLE[thousands] + 'tuhatta');
  if (rest === 0) return head;
  if (rest < 100) return head + ' ' + (rest < 20 ? SIMPLE[rest] : tensToWords(rest));
  return head + ' ' + hundredsToWords(rest);
}

/**
 * Format full price as words. Rules (MVP):
 * - euros: 1 → "yksi euro", others → "X euroa"
 * - cents: 1 → "yksi sentti", others → "Y senttiä"
 * - if euros==0: only cents phrase
 * - if cents==0: only euros phrase
 */
export function priceToFinnishWords(euros, cents) {
  const e = Math.floor(Math.max(0, euros));
  const c = Math.floor(Math.max(0, Math.min(99, cents)));
  const parts = [];
  if (e > 0) {
    const eWord = numberToFinnishWords(e);
    parts.push(e === 1 ? `${eWord} euro` : `${eWord} euroa`);
  }
  if (c > 0) {
    const cWord = numberToFinnishWords(c);
    const centsPhrase = c === 1 ? `${cWord} sentti` : `${cWord} senttiä`;
    if (e > 0) {
      // Default include conjunction when both parts exist
      parts.push('ja ' + centsPhrase);
    } else {
      parts.push(centsPhrase);
    }
  }
  if (parts.length === 0) return 'nolla euroa';
  return parts.join(' ');
}

/**
 * Format price in numeric style with comma decimal and € sign.
 */
export function priceToNumeric(euros, cents) {
  const e = Math.floor(Math.max(0, euros));
  const c = Math.floor(Math.max(0, Math.min(99, cents)));
  return `${e},${c.toString().padStart(2, '0')} €`;
}

/**
 * Light validator: normalize user text and compare against accepted expressions.
 * @param {string} user
 * @param {string[]} accepted
 */
export function validateExpression(user, accepted) {
  const norm = normalize(user);
  return accepted.some(a => normalize(a) === norm);
}

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^\s|\s$/g, '')
    .replace(/€\s*$/g, '€')
    .replace(/\s*€$/g, '€')
    .replace(/\./g, ',');
}

// ---------------- Expression variants and guidance ----------------

const DIGIT_WORD = {
  0: 'nolla', 1: 'yksi', 2: 'kaksi', 3: 'kolme', 4: 'neljä', 5: 'viisi',
  6: 'kuusi', 7: 'seitsemän', 8: 'kahdeksan', 9: 'yhdeksän'
};

/**
 * Generate acceptable expressions and UI guidance patterns for a price.
 * Variants include numeric, worded forms, and special half/one-and-a-half.
 * Guidance provides placeholder templates to reduce迷茫.
 */
export function generatePriceExpressions(euros, cents) {
  const e = Math.floor(Math.max(0, euros));
  const c = Math.floor(Math.max(0, Math.min(99, cents)));

  /** @type {string[]} */
  const variants = [];
  /** @type {string[]} */
  const guidance = [];

  // Numeric
  const numeric = priceToNumeric(e, c);
  variants.push(numeric);
  variants.push(numeric.replace(' €', ' euroa')); // tolerant numeric + unit

  // Worded canonical (with 'ja' when both present)
  const words = priceToFinnishWords(e, c);
  variants.push(words);
  variants.push(`Se maksaa ${words}.`);
  variants.push(`Yhteensä ${words}.`);

  // Integer euros only
  if (c === 0 && e > 0) {
    guidance.push(e === 1 ? '__ euro' : '__ euroa');
  }

  // Cents only
  if (e === 0 && c > 0) {
    guidance.push(c === 1 ? '__ sentti' : '__ senttiä');
  }

  // Special: 0,50 → puoli euroa
  if (e === 0 && c === 50) {
    variants.push('puoli euroa');
    guidance.push('puoli euroa');
  }

  // Special: 1,50 → puolitoista euroa / yksi ja puoli euroa
  if (e === 1 && c === 50) {
    variants.push('puolitoista euroa');
    variants.push('yksi ja puoli euroa');
    guidance.push('__ euroa'); // puolitoista euroa 属于此模板
    guidance.push('__ ja __ euroa');
  }

  // General mixed euros + cents
  if (e > 0 && c > 0) {
    const centsWord = numberToFinnishWords(c) + (c === 1 ? ' sentti' : ' senttiä');
    const euroPart = numberToFinnishWords(e) + (e === 1 ? ' euro' : ' euroa');
    // also accept form without conjunction
    variants.push(`${euroPart} ja ${centsWord}`);
    variants.push(`${euroPart} ${centsWord}`);
    guidance.push('__ euro(a) ja __ sentti(ä)');

    // Colloquial: E pilkku D euroa (only for clean one-digit decimals .10,.20,...,.90)
    if (c % 10 === 0) {
      const digit = c / 10;
      const digitWord = DIGIT_WORD[digit] || '';
      if (digitWord) {
        variants.push(`${numberToFinnishWords(e)} pilkku ${digitWord} euroa`);
        guidance.push('__ pilkku __ euroa');
      }
    }
  }

  // De-duplicate
  const uniq = Array.from(new Set(variants.map(v => normalize(v))));
  const variantsClean = uniq.map(u => u); // already normalized strings; but keep original style? use normalized for compare

  return { variants: variantsClean, guidance };
}


