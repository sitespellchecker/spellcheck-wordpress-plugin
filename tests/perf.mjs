// Perf: time to check a ~1,000-word post after the dictionary is loaded.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Typo = require('../assets/typo.js');
const { findIssues, htmlToText, tokenize } = require('../assets/tokenizer.js');
const corpus = require('./corpus.js');

const dir = new URL('../assets/', import.meta.url);
let t = performance.now();
const typo = new Typo('en_US', readFileSync(new URL('en_US.aff', dir), 'utf8'), readFileSync(new URL('en_US.dic', dir), 'utf8'));
const loadMs = performance.now() - t;

let text = '';
for (let i = 0; tokenize(text).length < 1000; i++) text += htmlToText(corpus[i % corpus.length].content) + '\n';
text += ' We recieve teh package tommorow and it was definately seperate.';
const wordCount = tokenize(text).length;

const time = (fn, runs = 5) => { const r = []; for (let i = 0; i < runs; i++) { const s = performance.now(); fn(); r.push(performance.now() - s); } return Math.max(...r); };
const cold = (() => { const s = performance.now(); findIssues(text, typo, { suggestions: false }); return performance.now() - s; })();
const noSugg = time(() => findIssues(text, typo, { suggestions: false }));
const withSugg = time(() => findIssues(text, typo), 1);
const issues = findIssues(text, typo, { suggestions: false }).map((i) => i.word);
console.log(JSON.stringify({ wordCount, dictionaryLoadMs: +loadMs.toFixed(1), firstCheckMs: +cold.toFixed(1), worstOf5CheckMs: +noSugg.toFixed(1), checkWithSuggestionsMs: +withSugg.toFixed(1), issues }, null, 2));
if (Math.max(cold, noSugg) >= 1000) { console.error('FAIL: check took >= 1s'); process.exit(1); }
