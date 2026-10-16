=== Site Spell Checker ===
Contributors: sitespellchecker
Tags: spell check, spelling, proofreading, typos, block editor
Requires at least: 6.0
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Private spell checking for the block editor. Checks titles and content in your browser with a per-site dictionary. No data leaves your browser.

== Description ==

Site Spell Checker adds a spelling panel to the block editor. Click **Check spelling** and it reviews the post title and content using an English (US) Hunspell dictionary, right in your browser.

* **Private.** Your content is never sent to any server, including ours. There is no account, no API key and no tracking.
* **Fewer false alarms.** Contractions and possessives (don't, it's, O'Brien, Sarah's) work with straight or curly apostrophes. Accented words (café, naïve) are accepted. Numbers, links, email addresses, code blocks and ALL-CAPS acronyms are skipped.
* **Names stay quiet.** Capitalized words in the middle of a sentence are treated as names and skipped. You can turn this off.
* **Per-site dictionary.** Add product names and jargon from the sidebar with **Add to dictionary**, or edit the list under Settings → Site Spell Checker. Use **Ignore** to hide a word just for this editing session.
* **Lightweight.** No admin notices, no banners, no redirects. Assets load only in the post editor, and the dictionary loads only when you run a check.

= Need to check your whole site? =

The plugin checks one post at a time. If you want every page checked at once, the separate paid service at [sitespellchecker.com](https://sitespellchecker.com/) crawls your public site and sends you a report. The plugin only links to it. Every plugin feature works without it.

= Privacy =

The plugin makes no external HTTP requests and collects no data. Spell checking runs in JavaScript in your browser. The only requests are for the plugin's own dictionary files on your site and, when an administrator uses **Add to dictionary**, the WordPress REST API on your own site.

== Installation ==

1. In your admin, go to Plugins → Add New, search for "Site Spell Checker", then install and activate it. You can also upload the `site-spell-checker` folder to `/wp-content/plugins/`.
2. Open any post or page in the block editor.
3. Click the spell check icon in the top toolbar (or open Options → Site Spell Checker), then click **Check spelling**.
4. Optional: go to Settings → Site Spell Checker to edit the site dictionary and preferences.

== Frequently Asked Questions ==

= Does this plugin send my content anywhere? =

No. Checking happens entirely in your browser, and no data leaves it. The plugin makes no requests to sitespellchecker.com or any other third-party service, and it has no analytics or telemetry.

= Which languages are supported? =

English (US) only in version 1.0.

= Does it work with the Classic Editor or page builders? =

Not yet. Version 1.0 supports the block editor only.

= Why aren't names flagged? =

Capitalized words in the middle of a sentence are usually names, so they are skipped by default. Capitalized words at the start of a sentence are still checked. You can change this under Settings → Site Spell Checker.

= Who can add words to the site dictionary? =

Users with the `manage_options` capability (administrators). Other users can still click **Ignore** to hide a word for their current editing session.

= Is it free? =

Yes. All plugin features are free. The whole-site scan at sitespellchecker.com is a separate, optional paid service.

= What happens when I uninstall? =

Deleting the plugin removes all of its settings, including the site dictionary.

== Screenshots ==

1. Spelling issues listed in the block editor sidebar, with Suggest, Ignore and Add to dictionary actions.
2. A clean post. Your text is checked in the browser.
3. The settings page: site dictionary, options for names and acronyms, and the optional footer credit.

== Changelog ==

= 1.0.0 =
* Initial release.
* Checks post title and content in the browser with Typo.js and an en_US Hunspell dictionary.
* Handles contractions, possessives, curly apostrophes and accented letters.
* Skips numbers, URLs, email addresses, code and preformatted blocks, and ALL-CAPS acronyms.
* Adds a per-site dictionary (settings page and sidebar), plus a per-session Ignore action.
* Optional footer credit, off by default.

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== Third-party libraries ==

* [Typo.js](https://github.com/cfinke/Typo.js) by Christopher Finke, Modified BSD License (GPL-compatible). Included unminified in `assets/typo.js`. License: `assets/LICENSE-typo.txt`.
* en_US Hunspell dictionary from [SCOWL](http://wordlist.aspell.net/) by Kevin Atkinson and contributors, under a permissive MIT/BSD-style license (GPL-compatible). Files: `assets/en_US.aff` and `assets/en_US.dic`. License and credits: `assets/README_en_US.txt`.
