// Repo guardrails: checks that keep the plugin's release metadata, package and privacy promise
// honest. See AGENTS.md. Run with `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const header = (name) => (new RegExp(`^ \\* ${name}:\\s*(.+)$`, 'm').exec(read('site-spell-checker.php')) || [])[1]?.trim();
const readmeField = (name) => (new RegExp(`^${name}:\\s*(.+)$`, 'm').exec(read('readme.txt')) || [])[1]?.trim();

test('every version number matches the plugin header', () => {
  const version = header('Version');
  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(/define\(\s*'SITE_SPELL_CHECKER_VERSION',\s*'([^']+)'/.exec(read('site-spell-checker.php'))[1], version, 'SITE_SPELL_CHECKER_VERSION');
  assert.equal(readmeField('Stable tag'), version, 'readme.txt Stable tag');
  assert.equal(JSON.parse(read('package.json')).version, version, 'package.json version');
  assert.match(read('tests/wp/smoke.php'), new RegExp(`'${version.replace(/\./g, '\\.')}' === SITE_SPELL_CHECKER_VERSION`), 'tests/wp/smoke.php version check');
  // Only the Changelog section counts (#3, Copilot): the Upgrade Notice has version headings too.
  const changelog = (/^== Changelog ==\n([\s\S]*?)(?=^== |(?![\s\S]))/m.exec(read('readme.txt')) || [])[1] || '';
  assert.equal((/^= (\d+\.\d+\.\d+) =$/m.exec(changelog) || [])[1], version, 'newest readme.txt Changelog entry');
});

test('readme requirements match the plugin header', () => {
  assert.equal(readmeField('Requires at least'), header('Requires at least'));
  assert.equal(readmeField('Requires PHP'), header('Requires PHP'));
  assert.match(readmeField('Tested up to') || '', /^\d+\.\d+$/);
});

test('the release zip ships every asset the plugin loads', () => {
  const php = read('site-spell-checker.php');
  const packaged = new Set((/assets\/\{([^}]+)\}/.exec(read('scripts/package.sh')) || [])[1].split(','));
  const loaded = [...php.matchAll(/\$base \. '([^']+)'/g), ...php.matchAll(/'assets\/([^']+)'/g)].map((m) => m[1]);
  assert.ok(loaded.length >= 4, 'expected the editor assets to be found in site-spell-checker.php');
  for (const file of loaded) {
    assert.ok(packaged.has(file), `${file} is loaded by the plugin but not copied by scripts/package.sh`);
    assert.ok(fs.existsSync(path.join(root, 'assets', file)), `assets/${file} is missing`);
  }
  for (const file of packaged) {
    assert.ok(fs.existsSync(path.join(root, 'assets', file)), `scripts/package.sh copies missing assets/${file}`);
  }
});

// readme.txt promises "no external HTTP requests", "no analytics or telemetry" and that content
// never leaves the browser. Keep the shipped code to that.
test('shipped JavaScript makes no third-party requests and has no tracking', () => {
  for (const file of ['assets/editor.js', 'assets/tokenizer.js']) {
    const code = read(file);
    assert.doesNotMatch(code, /https?:\/\//, `${file} must not contain absolute URLs`);
    assert.doesNotMatch(code, /sendBeacon|XMLHttpRequest|new Image\(|WebSocket|EventSource|gtag|umami|plausible|analytics/i, `${file} must not phone home`);
  }
  const editor = read('assets/editor.js');
  for (const call of editor.matchAll(/fetch\(\s*([^),]+)/g)) {
    assert.match(call[1].trim(), /^config\.(affUrl|dictionaryUrl)$|^\{\s*path:\s*'\/wp\/v2\/settings'/, `unexpected request: fetch(${call[1]})`);
  }
  for (const call of editor.matchAll(/apiFetch\(\s*\{\s*path:\s*'([^']+)'/g)) {
    assert.equal(call[1], '/wp/v2/settings', 'apiFetch may only call this site\'s settings endpoint');
  }
  assert.doesNotMatch(read('site-spell-checker.php'), /wp_remote_|curl_|file_get_contents\(\s*'https?:/, 'the plugin makes no server-side HTTP requests');
});

const CLAIMS = {
  'unsourced user count': /(?<![$\d,.])\b\d{1,3}(?:,\d{3})+\s*\+|(?<![$\d,.])\b\d+(?:\.\d+)?\s*[kK]\+|(?<![$\d,.-])\b\d{2,}\+?\s+(?:users|customers|sites|websites|teams|people|businesses|companies|subscribers|installs)\b/g,
  'unsourced accuracy or rate': /\b\d{2,3}(?:\.\d+)?\s*%\s*(?:accura|precis|uptime|satisf|success rate)/gi,
  'unsourced trust badge or rating': /(?:★){3,}|\b\d(?:\.\d)?\s*(?:\/\s*5|out of 5)\s*stars?\b|\btrusted by\b/gi,
  'template placeholder': /\[(?:TBD|TODO|PLACEHOLDER|YOUR [A-Z ]+)\]|lorem ipsum/gi,
  'dev host in public copy': /https?:\/\/[a-z0-9.-]+\.(?:test|local)\b|https?:\/\/(?:localhost|127\.0\.0\.1)\b/gi,
};

test('the WordPress.org listing has no invented numbers, ratings or placeholders', () => {
  const offenders = [];
  for (const file of ['readme.txt', 'README.md']) {
    for (const [name, pattern] of Object.entries(CLAIMS)) {
      const hits = read(file).match(pattern) || [];
      if (hits.length) offenders.push(`${file}: ${name}: ${hits.join(' | ')}`);
    }
  }
  assert.deepEqual(offenders, [], 'Every claim needs a source and Andy\'s OK');
});

test('the claims patterns catch past mistakes', () => {
  for (const [copy, name] of [['Loved by 1000+ users.', 'unsourced user count'], ['Used on 10,000+ sites', 'unsourced user count'], ['<h3>99% Accuracy</h3>', 'unsourced accuracy or rate'], ['★★★★★', 'unsourced trust badge or rating']]) {
    assert.ok((copy.match(CLAIMS[name]) || []).length > 0, `${name} should catch "${copy}"`);
  }
});

// Ops decision 2026-10-17: the readme said the plugin "collects no data" and "no data leaves your
// browser", but the whole-site scan link passes the site's domain and UTM parameters when clicked.
// The privacy copy must disclose exactly what the link carries, and not claim that nothing leaves.
test('readme privacy copy discloses what the scan link passes', () => {
  const readme = read('readme.txt');
  const plugin = read('site-spell-checker.php');
  const privacy = (/^= Privacy =\n([\s\S]*?)\n== /m.exec(readme) || [])[1] || '';
  assert.doesNotMatch(readme, /collects no data|no data leaves/i, 'the scan link passes the domain; say "your content" instead');
  const params = [...(/function site_spell_checker_scan_url[\s\S]*?array\(([\s\S]*?)\),\s*'https:/.exec(plugin) || [])[1].matchAll(/'([a-z_]+)'\s*=>/g)].map((m) => m[1]);
  assert.ok(params.length >= 5, 'found the scan URL parameters');
  for (const param of params) {
    assert.ok(privacy.includes(`${param}=`), `Privacy section must mention the ${param} parameter the scan link passes`);
  }
});
