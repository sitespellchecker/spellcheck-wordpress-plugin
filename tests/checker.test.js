const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Typo = require('../assets/typo.js');
const { findIssues, htmlToText } = require('../assets/tokenizer.js');
const corpus = require('./corpus.js');

const dir = path.join(__dirname, '..', 'assets');
const typo = new Typo('en_US', fs.readFileSync(path.join(dir, 'en_US.aff'), 'utf8'), fs.readFileSync(path.join(dir, 'en_US.dic'), 'utf8'));
const issues = (text, opts) => findIssues(text, typo, opts).map((i) => i.word);

test('contractions, curly quotes and possessives are not flagged', () => {
  assert.deepEqual(issues("I don\u2019t know if it's Sarah's or the dogs' food. They'd've said O'Brien's car won't start."), []);
});

test('accented spellings are accepted when the plain spelling is valid', () => {
  assert.deepEqual(issues('The naïve café served façade and a résumé.'), []);
});

test('real misspellings are flagged with suggestions', () => {
  const found = findIssues('We recieve teh package tommorow.', typo);
  assert.deepEqual(found.map((i) => i.word), ['recieve', 'teh', 'tommorow']);
  assert.ok(found[0].suggestions.includes('receive'));
  assert.ok(found[0].context.includes('recieve'));
});

test('misspelling at sentence start is still flagged', () => {
  assert.deepEqual(issues('Teh cat sat.'), ['Teh']);
});

test('capitalized mid-sentence words are skipped by default, checked when option off', () => {
  assert.deepEqual(issues('We met Zorblax at Kubernetes day.'), []);
  assert.deepEqual(issues('We met Zorblax at day.', { skipCapitalized: false }), ['Zorblax']);
});

test('sentence-start proper noun is skipped when it also appears mid-sentence', () => {
  assert.deepEqual(issues('Kubernetes is great. We love Kubernetes.'), []);
});

test('ignore list is case-insensitive and accepts curly apostrophes', () => {
  assert.deepEqual(issues('Our Gutenbergy blocks are fab\u2019lous.', { ignore: ['gutenbergy', "fab'lous"] }), []);
});

test('each misspelling reported once with count', () => {
  const found = findIssues('wrod wrod Wrod', typo);
  assert.equal(found.length, 1);
  assert.equal(found[0].count, 3);
});

test('20-post corpus has zero false positives', () => {
  assert.equal(corpus.length, 20);
  const bad = [];
  for (const post of corpus) {
    const words = issues(htmlToText(post.content), { title: post.title });
    if (words.length) bad.push(`${post.title}: ${words.join(', ')}`);
  }
  assert.deepEqual(bad, []);
});

test('corpus with seeded typos flags exactly the seeded typos', () => {
  const seeded = ['recieve', 'definately', 'seperate', 'occured', 'accomodate'];
  const text = htmlToText(corpus[0].content) + ' ' + seeded.join(' and ') + '.';
  assert.deepEqual(issues(text).sort(), [...seeded].sort());
});

test('title-case titles are checked word by word, names in body still respected', () => {
  const found = findIssues('Kubernetes is great. We use Kubernetes daily.', typo, { title: 'Our Sourdough Recipie for Begginers and Kubernetes', suggestions: false });
  assert.deepEqual(found.map((i) => i.word), ['Recipie', 'Begginers']);
  assert.ok(found.every((i) => i.inTitle));
});

test('title issue context is the title only; body context never includes the title', () => {
  const found = findIssues('Teh body text.', typo, { title: 'A Recipie', suggestions: false });
  assert.deepEqual(found.map((i) => [i.word, i.context]), [['Recipie', 'A Recipie'], ['Teh', 'Teh body text.']]);
});
