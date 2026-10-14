# Site Spell Checker for WordPress

A WordPress plugin that checks spelling in the post currently open in the Gutenberg block editor. It uses Typo.js and a bundled English Hunspell dictionary, matching the local spell-checking approach in the Site Spell Checker browser extension.

## Features

- Scan the edited post from the **Site Spell Checker** editor sidebar.
- Review possible misspellings, surrounding context, and up to three suggestions.
- Check content locally in the browser. Post text is not sent to SiteSpellChecker.com.
- Open a site-wide scan for the current site's domain from the editor or plugin settings.
- Configure the SiteSpellChecker attribution link in the frontend footer under **Settings → Site Spell Checker**.

The editor integration currently supports the Gutenberg block editor. It does not add a checker to the Classic Editor.

## Install

### Build an installable ZIP

From this repository, run:

```sh
./scripts/package.sh
```

The script creates `../dist/site-spell-checker-<version>.zip`. In WordPress, go to **Plugins → Add New Plugin → Upload Plugin**, select the ZIP, then activate the plugin.

### Install manually

Copy the `spellcheck-wordpress-plugin` directory into your site's `wp-content/plugins/` directory, then activate **Site Spell Checker** from the WordPress Plugins screen.

## Use

1. Open a post in the Gutenberg editor.
2. Open the **Site Spell Checker** panel from the editor sidebar.
3. Choose **Check spelling**. Results appear in the panel.
4. To check the entire website, choose **Scan your whole website**.

## Development

Requirements: PHP 7.4 or later and Node.js for syntax and dictionary checks.

Quick validation commands:

```sh
php -l sitespellchecker.php
node --check assets/editor.js
node --check assets/typo.js
bash -n scripts/package.sh
```

To smoke-check the bundled dictionary and suggestions:

```sh
node <<'NODE'
const fs = require('node:fs');
const Typo = require('./assets/typo.js');
const checker = new Typo(
  'en_US',
  fs.readFileSync('./assets/en_US.aff', 'utf8'),
  fs.readFileSync('./assets/en_US.dic', 'utf8'),
);
if (!checker.check('spelling')) throw new Error('Expected "spelling" to be recognized');
if (checker.check('speling')) throw new Error('Expected "speling" to be flagged');
if (!checker.suggest('speling').includes('spelling')) throw new Error('Expected spelling suggestion');
console.log('Dictionary smoke check passed');
NODE
```

There is not yet a WordPress integration test suite. The commands above validate syntax and dictionary behavior; they do not test activation or editor behavior in a running WordPress site.

## Privacy

The edited post is read and checked in the browser. The dictionary files are served from the WordPress installation. Content is not transmitted to SiteSpellChecker.com. The whole-site scan link opens that service only when a user chooses it.

## License

The plugin declares GPL-2.0-or-later in its main PHP file. The bundled [Typo.js library](https://github.com/cfinke/Typo.js) is BSD-3-Clause. The [Hunspell dictionary source](https://chromium.googlesource.com/chromium/deps/hunspell_dictionaries/) includes separate SCOWL and Ispell notices; preserve the applicable upstream notices when redistributing the dictionary. Verify and bundle all applicable third-party notices before submitting to the WordPress.org Plugin Directory.
