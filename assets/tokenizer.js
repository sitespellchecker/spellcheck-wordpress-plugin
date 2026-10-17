/**
 * Site Spell Checker core: text extraction, tokenizing and issue finding.
 * Runs entirely in the browser (and in Node for tests). No network access.
 *
 * Proper-noun policy: by default, capitalized words in the middle of a
 * sentence are treated as names and skipped. Capitalized words at the start of
 * a sentence are checked, and so is every word of the post title (titles are
 * often Title Case), unless the same capitalized word also appears
 * mid-sentence elsewhere in the text (a strong signal it is a name).
 *
 * @license GPL-2.0-or-later
 */
(function (root, factory) {
	if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	} else {
		root.SiteSpellCheckerCore = factory();
	}
})(typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	var ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', ndash: '\u2013', mdash: '\u2014', hellip: '\u2026', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', laquo: '\u00ab', raquo: '\u00bb', shy: '\u00ad', szlig: '\u00df', aelig: '\u00e6', AElig: '\u00c6', oslash: '\u00f8', Oslash: '\u00d8', aring: '\u00e5', Aring: '\u00c5', ccedil: '\u00e7', Ccedil: '\u00c7', ntilde: '\u00f1', Ntilde: '\u00d1', eth: '\u00f0', ETH: '\u00d0', thorn: '\u00fe', THORN: '\u00de' };
	// Accented Latin letters: &eacute; &Uuml; &acirc; and so on.
	var ACCENTS = { acute: '\u0301', grave: '\u0300', circ: '\u0302', uml: '\u0308', tilde: '\u0303' };
	var INLINE_TAGS = /^(?:a|abbr|b|bdi|bdo|cite|del|dfn|em|i|ins|mark|q|s|small|span|strong|sub|sup|time|u)$/i;
	var TOKEN = /[\p{L}\p{M}\p{N}_]+(?:['\u2019][\p{L}\p{M}\p{N}_]+)*/gu;
	var CLITIC = /'(?:s|d|ll|ve|re|m)$/i;

	function decodeEntities(text) {
		return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, function (match, code) {
			if (code[0] === '#') {
				var n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
				var valid = isFinite(n) && n >= 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff);
				return valid ? String.fromCodePoint(n) : '\ufffd';
			}
			if (Object.prototype.hasOwnProperty.call(ENTITIES, code)) {
				return ENTITIES[code];
			}
			var lower = code.toLowerCase();
			if (Object.prototype.hasOwnProperty.call(ENTITIES, lower)) {
				return ENTITIES[lower];
			}
			var accent = /^([a-z])(acute|grave|circ|uml|tilde)$/i.exec(code);
			if (accent) {
				return (accent[1] + ACCENTS[accent[2].toLowerCase()]).normalize('NFC');
			}
			return domDecode(match);
		});
	}

	var decoder = null;
	function domDecode(entity) {
		if (typeof document === 'undefined' || !document.createElement) {
			return entity;
		}
		decoder = decoder || document.createElement('textarea');
		decoder.innerHTML = entity;
		return decoder.value;
	}

	function htmlToText(html) {
		return decodeEntities(
			String(html || '')
				.replace(/<!--[\s\S]*?-->/g, ' ')
				.replace(/<(pre|code|script|style|kbd|samp|var)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
				.replace(/<\/?(p|div|li|ul|ol|h[1-6]|blockquote|br|tr|td|th|figcaption|hr)\b[^>]*>/gi, '\n')
				// Footnote markers (<sup>1</sup>, <sup><a href="#n">*</a></sup>) are not part of the word
				// before them: joined, "recieve1" was dropped as a number and hid the typo.
				.replace(/<sup\b[^>]*>(?:\s|<[^>]*>|[\d*\u2020\u2021\u00a7,\[\]()-])*<\/sup>/gi, ' ')
				.replace(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi, function (m, tag) {
					// Inline formatting tags do not break a word: hel<strong>lo</strong> is "hello".
					return INLINE_TAGS.test(tag) ? '' : ' ';
				})
				.replace(/<[^>]*>/g, ' ')
		);
	}

	// Mask a matched address with spaces of equal length (so token offsets still
	// point into the original text), keeping trailing prose punctuation intact.
	function mask(m, isAddress) {
		var trail = /[.,;:!?)\]}'"\u2019\u201d]+$/.exec(m);
		var core = trail ? m.slice(0, m.length - trail[0].length) : m;
		if (isAddress && !isAddress(core)) {
			return m;
		}
		return core.replace(/[\s\S]/gu, function (c) { return c.length > 1 ? '  ' : ' '; }) + (trail ? trail[0] : '');
	}

	function isDomainLike(core) {
		return /[a-z0-9]\.[a-z]{2,}(?:[/?#:]|\.[a-z]|$)/i.test(core) || /[/?#=]/.test(core);
	}

	function stripNonWords(text) {
		return text
			.replace(/\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"]+/gi, function (m) { return mask(m); })
			.replace(/[^\s<>"@]+@[^\s<>"@]+\.[a-z]{2,}/gi, function (m) { return mask(m); })
			.replace(/[^\s<>"]*[a-z0-9]\.[a-z]{2,}[^\s<>"]*/gi, function (m) { return mask(m, isDomainLike); });
	}

	function tokenize(text, options) {
		var opts = options || {};
		var ignoreAllCaps = opts.ignoreAllCaps !== false;
		var source = stripNonWords(String(text || ''));
		var tokens = [];
		var lastEnd = 0;
		var sentenceStart = true;
		var match;
		TOKEN.lastIndex = 0;
		while ((match = TOKEN.exec(source)) !== null) {
			var between = source.slice(lastEnd, match.index);
			if (/[.!?\n]/.test(between)) {
				sentenceStart = true;
			}
			lastEnd = match.index + match[0].length;
			var raw = match[0];
			var atStart = sentenceStart;
			sentenceStart = false;
			if (/[\p{N}_]/u.test(raw)) {
				continue;
			}
			if (/[\p{Ll}][\p{Lu}]/u.test(raw)) {
				continue;
			}
			if (ignoreAllCaps && /^\p{Lu}{2,}(?:'?s)?$/u.test(raw)) {
				continue;
			}
			tokens.push({ word: raw.replace(/\u2019/g, "'"), index: match.index, sentenceStart: atStart });
		}
		return tokens;
	}

	function normalizeWord(word) {
		return String(word).trim().replace(/\u2019/g, "'").toLowerCase();
	}

	function stripDiacritics(word) {
		return word.normalize('NFD').replace(/\p{M}/gu, '');
	}

	function isValid(checker, word) {
		if (checker.check(word)) {
			return true;
		}
		var plain = stripDiacritics(word);
		if (plain !== word && checker.check(plain)) {
			return true;
		}
		var base = plain;
		while (CLITIC.test(base)) {
			base = base.replace(CLITIC, '');
			if (checker.check(base)) {
				return true;
			}
		}
		return false;
	}

	// Weighted Damerau-Levenshtein: a missing letter (0.9) or swapped pair (0.8)
	// is a more likely typo than a wrong letter (1).
	function typoDistance(a, b) {
		var d = [];
		for (var i = 0; i <= a.length; i++) {
			d[i] = [i];
		}
		for (var j = 1; j <= b.length; j++) {
			d[0][j] = j * 0.9;
		}
		for (i = 1; i <= a.length; i++) {
			for (j = 1; j <= b.length; j++) {
				var cost = a[i - 1] === b[j - 1] ? 0 : 1;
				d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 0.9, d[i - 1][j - 1] + cost);
				if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
					d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 0.8);
				}
			}
		}
		return d[a.length][b.length];
	}

	function rankSuggestions(word, list) {
		var lower = word.toLowerCase();
		var seen = new Set();
		return (list || [])
			.filter(function (s) {
				var k = s.toLowerCase();
				if (seen.has(k)) {
					return false;
				}
				seen.add(k);
				return true;
			})
			.map(function (s, i) {
				return { s: s, i: i, d: typoDistance(lower, s.toLowerCase()) };
			})
			.sort(function (x, y) {
				return x.d - y.d || x.i - y.i;
			})
			.map(function (x) {
				return x.s;
			});
	}

	function findIssues(text, checker, options) {
		var opts = options || {};
		var skipCapitalized = opts.skipCapitalized !== false;
		var max = opts.max || 200;
		var maxSuggestions = opts.suggestions === false ? 0 : opts.suggestions || 3;
		var ignore = new Set((opts.ignore || []).map(normalizeWord));
		var title = String(opts.title || '');
		var body = String(text || '');
		var source = title ? title + '\n' + body : body;
		var offset = title ? title.length + 1 : 0;
		var bodyTokens = tokenize(body, opts).map(function (t) {
			return { word: t.word, index: t.index + offset, sentenceStart: t.sentenceStart, inTitle: false };
		});
		var namesMidSentence = new Set();
		bodyTokens.forEach(function (t) {
			if (!t.sentenceStart && /^\p{Lu}/u.test(t.word)) {
				namesMidSentence.add(t.word.toLowerCase());
			}
		});
		// Titles are often Title Case, so every title word is checked like a sentence start.
		var tokens = tokenize(title, opts).map(function (t) {
			return { word: t.word, index: t.index, sentenceStart: true, inTitle: true };
		}).concat(bodyTokens);
		var verdicts = new Map();
		var found = new Map();
		for (var i = 0; i < tokens.length; i++) {
			var t = tokens[i];
			var key = t.word.toLowerCase();
			if (t.word.replace(/'/g, '').length < 2 || ignore.has(key)) {
				continue;
			}
			if (found.has(key)) {
				found.get(key).count++;
				found.get(key).inTitle = found.get(key).inTitle || t.inTitle;
				continue;
			}
			if (skipCapitalized && /^\p{Lu}/u.test(t.word) && (!t.sentenceStart || namesMidSentence.has(key))) {
				continue;
			}
			if (!verdicts.has(t.word)) {
				verdicts.set(t.word, isValid(checker, t.word));
			}
			if (verdicts.get(t.word)) {
				continue;
			}
			if (found.size >= max) {
				break;
			}
			found.set(key, {
				word: t.word,
				count: 1,
				inTitle: t.inTitle,
				context: (t.inTitle ? title : source.slice(Math.max(offset, t.index - 30), t.index + t.word.length + 30)).replace(/\s+/g, ' ').trim(),
				suggestions: [],
			});
		}
		var issues = Array.from(found.values());
		if (maxSuggestions) {
			issues.forEach(function (issue) {
				issue.suggestions = rankSuggestions(issue.word, checker.suggest(issue.word, 10)).slice(0, maxSuggestions);
			});
		}
		return issues;
	}

	return { htmlToText: htmlToText, tokenize: tokenize, findIssues: findIssues, rankSuggestions: rankSuggestions, normalizeWord: normalizeWord };
});
