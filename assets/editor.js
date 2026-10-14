(function (wp, config) {
  const { registerPlugin } = wp.plugins;
  const { PluginSidebar } = wp.editPost;
  const { createElement: h, useState } = wp.element;
  const { Button, Notice, Spinner } = wp.components;
  const { select } = wp.data;
  let checkerPromise;

  function getChecker() {
    if (!checkerPromise) {
      checkerPromise = Promise.all([fetch(config.affUrl), fetch(config.dictionaryUrl)]).then(async (responses) => {
        if (responses.some((response) => !response.ok)) throw new Error('Could not load the English dictionary.');
        const [aff, dic] = await Promise.all(responses.map((response) => response.text()));
        return new Typo('en_US', aff, dic);
      });
    }
    return checkerPromise;
  }

  function checkContent(markup, checker) {
    const doc = new DOMParser().parseFromString(markup || '', 'text/html');
    const text = (doc.body.textContent || '').replace(/\s+/g, ' ');
    const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
    const seen = new Set();
    const errors = [];
    for (const word of words) {
      const lower = word.toLowerCase();
      if (seen.has(lower) || /^[A-Z]{2,}$/.test(word) || /[a-z][A-Z]/.test(word)) continue;
      seen.add(lower);
      if (!checker.check(word)) {
        const index = text.indexOf(word);
        errors.push({ word, context: `${text.slice(Math.max(0, index - 28), index)}${word}${text.slice(index + word.length, index + word.length + 28)}`, suggestions: checker.suggest(word).slice(0, 3) });
        if (errors.length >= 50) break;
      }
    }
    return errors;
  }

  function CheckerPanel() {
    const [errors, setErrors] = useState(null);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState('');

    async function scan() {
      setBusy(true); setFailure('');
      try {
        const checker = await getChecker();
        const markup = select('core/editor').getEditedPostContent();
        setErrors(checkContent(markup, checker));
      } catch (error) {
        setFailure(error.message || 'Spell check could not be completed.');
      } finally { setBusy(false); }
    }

    return h(PluginSidebar, { name: 'site-spell-checker', title: 'Site Spell Checker' },
      h('div', { className: 'ssc-panel' },
        h('p', null, 'Check this post locally with the same Hunspell dictionary used by the Site Spell Checker browser extension.'),
        h(Button, { variant: 'primary', onClick: scan, disabled: busy }, busy ? 'Checking…' : 'Check spelling'),
        busy && h(Spinner),
        failure && h(Notice, { status: 'error', isDismissible: false }, failure),
        errors !== null && (errors.length === 0
          ? h(Notice, { status: 'success', isDismissible: false }, 'No spelling errors found.')
          : h('div', null,
            h('p', { className: 'ssc-count' }, `${errors.length}${errors.length === 50 ? '+' : ''} possible spelling error${errors.length === 1 ? '' : 's'}`),
            h('ul', { className: 'ssc-errors' }, errors.map((error, index) => h('li', { key: `${error.word}-${index}` },
              h('strong', null, error.word), h('span', null, error.context),
              error.suggestions.length > 0 && h('small', null, `Suggestions: ${error.suggestions.join(', ')}`))))
          )
        ),
        h('hr'),
        h('p', null, 'Need a report for every page on this site?'),
        h('a', { className: 'button button-secondary', href: config.siteScanUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Scan your whole website')
      )
    );
  }

  registerPlugin('site-spell-checker', { render: CheckerPanel, icon: 'editor-spellcheck' });
})(window.wp, window.siteSpellChecker);
