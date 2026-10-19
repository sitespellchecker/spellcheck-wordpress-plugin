# Site Spell Checker for WordPress

Free WordPress.org plugin (slug `site-spell-checker`). It adds a spell-check sidebar to the block editor that checks the post **title and content** in the browser, using [Typo.js](https://github.com/cfinke/Typo.js) and the SCOWL en_US Hunspell dictionary. It makes no outbound requests and has no telemetry or admin notices. The only thing that reaches sitespellchecker.com is the whole-site scan link, and only when a user clicks it: the URL carries the site's domain and UTM parameters (see the readme.txt Privacy section).

## Features
- Handles contractions and possessives with straight or curly apostrophes, and accented letters (an accented word passes when its plain spelling is valid).
- Skips numbers, URLs, emails, `code`/`pre` blocks, and (optionally) ALL-CAPS acronyms.
- **Proper nouns:** capitalized words mid-sentence are skipped by default. Words at the start of a sentence and every title word are checked, unless the same capitalized word also appears mid-sentence in the body. This can be toggled in settings.
- Per-site dictionary (`site_spell_checker_ignored_words`). It is exposed to the core `/wp/v2/settings` REST endpoint (requires `manage_options`) and editable in Settings → Site Spell Checker. Per-session **Ignore** is available too.
- The whole-site scan link is tagged with `ref=wp-plugin&utm_source=wordpress&utm_medium=plugin&utm_campaign=editor-sidebar|settings`.

## Layout
| Path | Shipped |
|---|---|
| `site-spell-checker.php`, `uninstall.php`, `readme.txt`, `LICENSE` | yes |
| `assets/` (typo.js unminified, tokenizer.js, editor.js/css, dictionary + licenses) | yes |
| `tests/` (node:test unit + corpus + perf, `tests/wp/smoke.php` WP integration) | no |
| `.wordpress-org/` (banners, icons, screenshots for SVN `/assets`) | no |
| `scripts/package.sh` (builds the release zip) | no |

## Develop
```sh
npm test          # tokenizer + checker + 20-post corpus
npm run perf      # 1,000-word check timing
bash scripts/package.sh   # -> dist/site-spell-checker-1.0.0.zip
# in a WP install: wp eval-file tests/wp/smoke.php
```
