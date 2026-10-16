/**
 * Site Spell Checker block editor sidebar.
 * All checking happens in the browser. The only requests are for this
 * plugin's own dictionary files and, when an administrator clicks
 * "Add to dictionary", the site's own REST settings endpoint.
 *
 * @license GPL-2.0-or-later
 */
( function ( wp, config, Core ) {
	'use strict';
	if ( ! wp || ! config || ! Core || ! wp.plugins || ! wp.data ) {
		return;
	}
	var registerPlugin = wp.plugins.registerPlugin;
	var PluginSidebar = ( wp.editor && wp.editor.PluginSidebar ) || ( wp.editPost && wp.editPost.PluginSidebar );
	var PluginSidebarMoreMenuItem = ( wp.editor && wp.editor.PluginSidebarMoreMenuItem ) || ( wp.editPost && wp.editPost.PluginSidebarMoreMenuItem );
	if ( ! PluginSidebar ) {
		return;
	}
	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var useState = wp.element.useState;
	var components = wp.components;
	var i18n = wp.i18n;
	var __ = i18n.__;
	var _n = i18n._n;
	var sprintf = i18n.sprintf;
	var checkerPromise;
	var sessionIgnored = new Set();
	var siteIgnored = new Set( ( config.ignoredWords || [] ).map( Core.normalizeWord ) );

	function getChecker() {
		if ( ! checkerPromise ) {
			checkerPromise = Promise.all( [ window.fetch( config.affUrl ), window.fetch( config.dictionaryUrl ) ] )
				.then( function ( responses ) {
					if ( responses.some( function ( r ) { return ! r.ok; } ) ) {
						throw new Error( __( 'Could not load the English dictionary.', 'site-spell-checker' ) );
					}
					return Promise.all( responses.map( function ( r ) { return r.text(); } ) );
				} )
				.then( function ( files ) {
					return new window.Typo( 'en_US', files[ 0 ], files[ 1 ] );
				} )
				.catch( function ( error ) {
					checkerPromise = null;
					throw error;
				} );
		}
		return checkerPromise;
	}

	function getPostText() {
		var editor = wp.data.select( 'core/editor' );
		var title = editor.getEditedPostAttribute( 'title' ) || '';
		return { title: title, content: Core.htmlToText( editor.getEditedPostContent() || '' ) };
	}

	function runCheck( checker ) {
		var post = getPostText();
		var options = {
			ignore: Array.from( siteIgnored ).concat( Array.from( sessionIgnored ) ),
			skipCapitalized: config.skipCapitalized !== false,
			ignoreAllCaps: config.ignoreAllCaps !== false,
			suggestions: false,
		};
		options.title = post.title;
		return Core.findIssues( post.content, checker, options );
	}

	function IssueItem( props ) {
		var issue = props.issue;
		var suggestionState = useState( null );
		var suggestions = suggestionState[ 0 ];
		var setSuggestions = suggestionState[ 1 ];

		function suggest() {
			setSuggestions( [ __( 'Finding suggestions…', 'site-spell-checker' ) ] );
			window.setTimeout( function () {
				getChecker().then( function ( checker ) {
					var list = Core.rankSuggestions( issue.word, checker.suggest( issue.word, 10 ) ).slice( 0, 3 );
					setSuggestions( list.length ? list : [ __( 'No suggestions', 'site-spell-checker' ) ] );
				} );
			}, 30 );
		}

		return el( 'li', null,
			el( 'strong', null, issue.word ),
			issue.count > 1 && el( 'span', { className: 'ssc-badge' }, sprintf( /* translators: %d: number of times the word appears. */ __( '×%d', 'site-spell-checker' ), issue.count ) ),
			issue.inTitle && el( 'span', { className: 'ssc-badge' }, __( 'In title', 'site-spell-checker' ) ),
			el( 'span', { className: 'ssc-context' }, issue.context ),
			suggestions && el( 'small', null, sprintf( /* translators: %s: comma separated spelling suggestions. */ __( 'Suggestions: %s', 'site-spell-checker' ), suggestions.join( ', ' ) ) ),
			el( 'div', { className: 'ssc-actions' },
				! suggestions && el( components.Button, { variant: 'link', onClick: suggest }, __( 'Suggest', 'site-spell-checker' ) ),
				el( components.Button, { variant: 'link', onClick: function () { props.onIgnore( issue.word ); } }, __( 'Ignore', 'site-spell-checker' ) ),
				config.canManage && el( components.Button, { variant: 'link', onClick: function () { props.onAdd( issue.word ); } }, __( 'Add to dictionary', 'site-spell-checker' ) )
			)
		);
	}

	function CheckerPanel() {
		var issuesState = useState( null );
		var issues = issuesState[ 0 ];
		var setIssues = issuesState[ 1 ];
		var busyState = useState( false );
		var busy = busyState[ 0 ];
		var setBusy = busyState[ 1 ];
		var messageState = useState( null );
		var message = messageState[ 0 ];
		var setMessage = messageState[ 1 ];

		function check() {
			setBusy( true );
			setMessage( null );
			getChecker()
				.then( function ( checker ) {
					setIssues( runCheck( checker ) );
				} )
				.catch( function ( error ) {
					setMessage( { status: 'error', text: ( error && error.message ) || __( 'Spell check could not be completed.', 'site-spell-checker' ) } );
				} )
				.then( function () {
					setBusy( false );
				} );
		}

		function removeWord( word ) {
			var key = Core.normalizeWord( word );
			setIssues( function ( current ) {
				return ( current || [] ).filter( function ( i ) { return i.word.toLowerCase() !== key; } );
			} );
		}

		function ignore( word ) {
			sessionIgnored.add( Core.normalizeWord( word ) );
			removeWord( word );
		}

		function addToDictionary( word ) {
			var key = Core.normalizeWord( word );
			var next = Array.from( new Set( Array.from( siteIgnored ).concat( [ key ] ) ) );
			wp.apiFetch( { path: '/wp/v2/settings', method: 'POST', data: { site_spell_checker_ignored_words: next } } )
				.then( function ( response ) {
					siteIgnored = new Set( response.site_spell_checker_ignored_words || next );
					removeWord( word );
					/* translators: %s: the word added to the site dictionary. */
					setMessage( { status: 'success', text: sprintf( __( '"%s" added to the site dictionary.', 'site-spell-checker' ), key ) } );
				} )
				.catch( function () {
					setMessage( { status: 'error', text: __( 'Could not save the word. You can still ignore it for this session.', 'site-spell-checker' ) } );
				} );
		}

		var count = issues ? issues.length : 0;
		return el( 'div', { className: 'ssc-panel' },
			el( 'p', null, __( 'Checks this post’s title and content in your browser. Nothing is sent to any server.', 'site-spell-checker' ) ),
			el( components.Button, { variant: 'primary', onClick: check, disabled: busy, isBusy: busy }, busy ? __( 'Checking…', 'site-spell-checker' ) : __( 'Check spelling', 'site-spell-checker' ) ),
			busy && el( components.Spinner ),
			message && el( components.Notice, { status: message.status, isDismissible: true, onRemove: function () { setMessage( null ); } }, message.text ),
			issues !== null && el( Fragment, null,
				count === 0
					? el( components.Notice, { status: 'success', isDismissible: false }, __( 'No spelling issues found in this post.', 'site-spell-checker' ) )
					: el( 'ul', { className: 'ssc-errors' }, issues.map( function ( issue ) {
						return el( IssueItem, { key: issue.word.toLowerCase(), issue: issue, onIgnore: ignore, onAdd: addToDictionary } );
					} ) ),
				el( 'div', { className: 'ssc-cta' },
					el( 'p', null, count
						? sprintf( /* translators: %d: number of possible spelling issues. */ _n( '%d possible issue on this post. Other pages may have more.', '%d possible issues on this post. Other pages may have more.', count, 'site-spell-checker' ), count )
						: __( 'This post looks clean. What about the rest of your site?', 'site-spell-checker' ) ),
					el( 'a', { className: 'components-button is-secondary', href: config.siteScanUrl, target: '_blank', rel: 'noopener noreferrer' }, __( 'Scan every page of your site', 'site-spell-checker' ) )
				)
			)
		);
	}

	function Sidebar() {
		var title = __( 'Site Spell Checker', 'site-spell-checker' );
		return el( Fragment, null,
			PluginSidebarMoreMenuItem && el( PluginSidebarMoreMenuItem, { target: 'site-spell-checker', icon: 'editor-spellcheck' }, title ),
			el( PluginSidebar, { name: 'site-spell-checker', title: title, icon: 'editor-spellcheck' }, el( CheckerPanel ) )
		);
	}

	registerPlugin( 'site-spell-checker', { render: Sidebar, icon: 'editor-spellcheck' } );
} )( window.wp, window.siteSpellChecker, window.SiteSpellCheckerCore );
