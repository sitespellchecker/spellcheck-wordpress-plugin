const test = require('node:test');
const assert = require('node:assert/strict');
const { tokenize, htmlToText } = require('../assets/tokenizer.js');
const Core = require('../assets/tokenizer.js');

const words = (text, opts) => tokenize(text, opts).map((t) => t.word);

test('keeps straight-apostrophe contractions whole', () => {
  assert.deepEqual(words("I don't think it's wrong, we'll see"), ['I', "don't", 'think', "it's", 'wrong', "we'll", 'see']);
});

test('keeps curly-apostrophe contractions whole and normalizes to straight', () => {
  assert.deepEqual(words('You don\u2019t know it\u2019s mine'), ['You', "don't", 'know', "it's", 'mine']);
});

test('keeps names with apostrophes and possessives', () => {
  assert.deepEqual(words("O'Brien took the dog's bone and the dogs' toys"), ["O'Brien", 'took', 'the', "dog's", 'bone', 'and', 'the', 'dogs', 'toys']);
});

test('does not treat single quotes as part of words', () => {
  assert.deepEqual(words("He said 'hello' and \u2018goodbye\u2019"), ['He', 'said', 'hello', 'and', 'goodbye']);
});

test('keeps accented and Unicode letters inside words', () => {
  assert.deepEqual(words('A naïve café owner from Zürich'), ['A', 'naïve', 'café', 'owner', 'from', 'Zürich']);
});

test('splits hyphenated compounds into parts', () => {
  assert.deepEqual(words('a well-known state-of-the-art tool'), ['a', 'well', 'known', 'state', 'of', 'the', 'art', 'tool']);
});

test('ignores numbers, words with digits, URLs and emails', () => {
  assert.deepEqual(words('Call 555-1234 about mp3 files at https://example.com/pathh?x=1 or www.exmple.org or mail bob@exmaple.com today'), ['Call', 'about', 'files', 'at', 'or', 'or', 'mail', 'today']);
});

test('flags all-caps acronyms only when option is off', () => {
  assert.deepEqual(words('The NASA API is fine'), ['The', 'is', 'fine']);
  assert.deepEqual(words('The NASA API is fine', { ignoreAllCaps: false }), ['The', 'NASA', 'API', 'is', 'fine']);
});

test('marks sentence starts', () => {
  const t = tokenize('Hello there. Again! Why? yes and');
  assert.deepEqual(t.map((x) => x.sentenceStart), [true, false, true, true, true, false]);
});

test('htmlToText drops code, pre, script and style blocks and decodes entities', () => {
  const html = '<p>Don&#8217;t&nbsp;stop &amp; go</p><pre>sudo apt-gett</pre><p>Use <code>wp_enqeue</code> now</p><script>varr x</script><style>.foo{colr:red}</style>';
  const text = htmlToText(html);
  assert.ok(!/apt-gett|wp_enqeue|varr|colr/.test(text), text);
  assert.deepEqual(words(text), ["Don't", 'stop', 'go', 'Use', 'now']);
});

test('rankSuggestions prefers missing letters and transpositions, dedupes case', () => {
  const { rankSuggestions } = require('../assets/tokenizer.js');
  assert.equal(rankSuggestions('befor', ['befog', 'bear', 'beer', 'bettor', 'boor', 'before', 'bebop', 'befit', 'Befog', 'befogs'])[0], 'before');
  assert.equal(rankSuggestions('recieve', ['relieve', 'receive', 'recipe', 'recite'])[0], 'receive');
  assert.deepEqual(rankSuggestions('definately', ['definitely', 'defiantly', 'Definitely', 'delicately']), ['definitely', 'defiantly', 'delicately']);
  assert.equal(rankSuggestions('Begginers', ['Beginners', 'Legginess'])[0], 'Beginners');
});

test('invalid numeric entities do not throw', () => {
	assert.doesNotThrow(() => Core.htmlToText('a &#1114112; b &#xD800; c'));
	assert.match(Core.htmlToText('x&#1114112;y'), /x\uFFFDy/);
});

test('named accents decode and inline tags keep words whole', () => {
	assert.equal(Core.htmlToText('caf&eacute;').trim(), 'café');
	assert.equal(Core.htmlToText('<p>hel<strong>lo</strong></p>').trim(), 'hello');
	assert.match(Core.htmlToText('<p>one</p><p>two</p>'), /one\s+two/);
});

test('URL trailing punctuation keeps the sentence boundary and offsets', () => {
	const text = 'See https://example.com. Teh cat sat.';
	const t = Core.tokenize(text).find((x) => x.word === 'Teh');
	assert.ok(t && t.sentenceStart);
	assert.equal(text.slice(t.index, t.index + 3), 'Teh');
});

test('domain followed by a comma is excluded', () => {
	const words = Core.tokenize('Visit exmple.org, today').map((x) => x.word);
	assert.deepEqual(words, ['Visit', 'today']);
});

test('sentence boundary counts before any kept token', () => {
	const t = Core.tokenize('NASA. Teh cat sat.').find((x) => x.word === 'Teh');
	assert.ok(t.sentenceStart);
});
