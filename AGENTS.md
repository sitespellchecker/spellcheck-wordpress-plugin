# Standing rules

Site Spell Checker for WordPress: a WordPress.org plugin that runs spell checking entirely in the browser. Each rule names its check. `npm test` runs `tests/*.test.js` locally; run `phpcs` (uses `phpcs.xml.dist`) yourself too. **CI is pending:** `.github/workflows/guardrails.yml` (Node tests, `php -l` on 7.4 and 8.4, PHPCS, package-contents check) is proposed in the PR that added this file and isn't in the repo yet, so nothing below runs on PRs until it lands. `tests/wp/smoke.php` runs inside a real WordPress (`wp eval-file tests/wp/smoke.php`) and isn't in CI.

| Rule | Check |
| --- | --- |
| Open PRs as drafts. Andy reviews and merges; never mark ready or merge yourself, and never tag or deploy to WordPress.org SVN. | Review |
| No `[DO NOT MERGE]` or similar in PR titles. Use a draft instead. | Review |
| Run `npm test` and say what ran. `node --test tests/` silently broke on Node 22 (it treats the directory as a module); the script is now `node --test tests/*.test.js`. | `npm test` (local until `guardrails.yml` lands) |
| The privacy promise in readme.txt is a product claim: no external HTTP requests, no analytics or telemetry, content never leaves the browser. Shipped JS may only fetch the plugin's own dictionary files and `/wp/v2/settings`; no server-side HTTP. | `tests/guardrails.test.js` |
| Never invent numbers, ratings or claims in readme.txt or README.md ("10,000+ sites", "99% accurate", ★★★★★). Every claim needs a source and Andy's OK. | `tests/guardrails.test.js` |
| Bump a version everywhere at once: the plugin header, `SITE_SPELL_CHECKER_VERSION`, readme `Stable tag` and changelog, `package.json`, `tests/wp/smoke.php`. Keep readme `Requires at least`/`Requires PHP` equal to the header. | `tests/guardrails.test.js` |
| Code must run on PHP 7.4 (the plugin's "Requires PHP") and pass WordPress Coding Standards. | `phpcs` (local); `guardrails.yml` once added |
| Anything the plugin loads ships in the zip, and dev files don't. Add new assets to `scripts/package.sh`. | `tests/guardrails.test.js`; `guardrails.yml` package job once added |
| Every tokenizer fix lands with a regression test in `tests/tokenizer.test.js` for the exact input from the review. | Review |
| No outreach or upsell beyond the existing opt-in links. No admin notices, banners or redirects (readme promise). | Review |
| Bring a branch up to date by merging its base. Never force-push or rewrite pushed history. | Review |
