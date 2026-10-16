<?php
/**
 * Plugin Name:       Site Spell Checker
 * Plugin URI:        https://sitespellchecker.com/
 * Description:       Check spelling in the block editor, privately in your browser, with a per-site dictionary. Nothing is sent to any server.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Site Spell Checker
 * Author URI:        https://sitespellchecker.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       site-spell-checker
 *
 * @package SiteSpellChecker
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SITE_SPELL_CHECKER_VERSION', '1.0.0' );
define( 'SITE_SPELL_CHECKER_URL', plugin_dir_url( __FILE__ ) );

/**
 * Option names used by the plugin. Kept in one place so uninstall.php can remove them.
 *
 * @return string[]
 */
function site_spell_checker_option_names() {
	return array(
		'site_spell_checker_ignored_words',
		'site_spell_checker_skip_capitalized',
		'site_spell_checker_ignore_all_caps',
		'site_spell_checker_show_credit',
	);
}

/**
 * Build the whole-site scan URL with attribution parameters. The link is only
 * followed when a user clicks it; the plugin itself never contacts this host.
 *
 * @param string $campaign Where the link was shown (editor-sidebar or settings).
 * @return string
 */
function site_spell_checker_scan_url( $campaign ) {
	$host = wp_parse_url( home_url(), PHP_URL_HOST );
	return add_query_arg(
		array(
			'domain'       => rawurlencode( (string) $host ),
			'ref'          => 'wp-plugin',
			'utm_source'   => 'wordpress',
			'utm_medium'   => 'plugin',
			'utm_campaign' => rawurlencode( $campaign ),
		),
		'https://sitespellchecker.com/site-scans/checkout'
	);
}

/**
 * Sanitize the ignore list. Accepts an array (REST) or newline/comma separated string (settings form).
 *
 * @param mixed $value Raw value.
 * @return string[]
 */
function site_spell_checker_sanitize_words( $value ) {
	if ( is_string( $value ) ) {
		$value = preg_split( '/[\r\n,]+/', $value );
	}
	if ( ! is_array( $value ) ) {
		return array();
	}
	$words = array();
	foreach ( $value as $word ) {
		if ( ! is_scalar( $word ) ) {
			continue;
		}
		$word = str_replace( "\u{2019}", "'", sanitize_text_field( (string) $word ) );
		$word = function_exists( 'mb_strtolower' ) ? mb_strtolower( $word, 'UTF-8' ) : strtolower( $word );
		$word = trim( $word, " \t'-" );
		if ( '' === $word || ! preg_match( "/^[\p{L}\p{M}][\p{L}\p{M}'\-]{0,63}$/u", $word ) ) {
			continue;
		}
		$words[ $word ] = true;
		if ( count( $words ) >= 2000 ) {
			break;
		}
	}
	$words = array_keys( $words );
	sort( $words );
	return array_values( array_map( 'strval', $words ) );
}

/**
 * Register settings. Exposed to the core REST settings endpoint
 * (/wp/v2/settings), which requires the manage_options capability and a REST nonce.
 */
function site_spell_checker_register_settings() {
	register_setting(
		'site_spell_checker',
		'site_spell_checker_ignored_words',
		array(
			'type'              => 'array',
			'description'       => __( 'Words Site Spell Checker should never flag on this site.', 'site-spell-checker' ),
			'sanitize_callback' => 'site_spell_checker_sanitize_words',
			'default'           => array(),
			'show_in_rest'      => array(
				'schema' => array(
					'type'  => 'array',
					'items' => array( 'type' => 'string' ),
				),
			),
		)
	);
	register_setting(
		'site_spell_checker',
		'site_spell_checker_skip_capitalized',
		array(
			'type'              => 'boolean',
			'sanitize_callback' => 'rest_sanitize_boolean',
			'default'           => true,
			'show_in_rest'      => true,
		)
	);
	register_setting(
		'site_spell_checker',
		'site_spell_checker_ignore_all_caps',
		array(
			'type'              => 'boolean',
			'sanitize_callback' => 'rest_sanitize_boolean',
			'default'           => true,
			'show_in_rest'      => true,
		)
	);
	register_setting(
		'site_spell_checker',
		'site_spell_checker_show_credit',
		array(
			'type'              => 'boolean',
			'sanitize_callback' => 'rest_sanitize_boolean',
			'default'           => false,
		)
	);
}
add_action( 'init', 'site_spell_checker_register_settings' );

/**
 * Enqueue the editor sidebar on post editing screens that use the block editor.
 */
function site_spell_checker_enqueue_editor_assets() {
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( ! $screen || 'post' !== $screen->base || ! current_user_can( 'edit_posts' ) ) {
		return;
	}
	$base = SITE_SPELL_CHECKER_URL . 'assets/';
	wp_enqueue_script( 'site-spell-checker-typo', $base . 'typo.js', array(), SITE_SPELL_CHECKER_VERSION, true );
	wp_enqueue_script( 'site-spell-checker-core', $base . 'tokenizer.js', array(), SITE_SPELL_CHECKER_VERSION, true );
	wp_enqueue_script(
		'site-spell-checker-editor',
		$base . 'editor.js',
		array( 'wp-plugins', 'wp-edit-post', 'wp-element', 'wp-data', 'wp-components', 'wp-i18n', 'wp-api-fetch', 'site-spell-checker-typo', 'site-spell-checker-core' ),
		SITE_SPELL_CHECKER_VERSION,
		true
	);
	wp_set_script_translations( 'site-spell-checker-editor', 'site-spell-checker' );
	wp_enqueue_style( 'site-spell-checker-editor', $base . 'editor.css', array(), SITE_SPELL_CHECKER_VERSION );

	$config = array(
		'affUrl'          => $base . 'en_US.aff',
		'dictionaryUrl'   => $base . 'en_US.dic',
		'siteScanUrl'     => site_spell_checker_scan_url( 'editor-sidebar' ),
		'canManage'       => current_user_can( 'manage_options' ),
		'ignoredWords'    => (array) get_option( 'site_spell_checker_ignored_words', array() ),
		'skipCapitalized' => (bool) get_option( 'site_spell_checker_skip_capitalized', true ),
		'ignoreAllCaps'   => (bool) get_option( 'site_spell_checker_ignore_all_caps', true ),
	);
	wp_add_inline_script( 'site-spell-checker-editor', 'window.siteSpellChecker = ' . wp_json_encode( $config ) . ';', 'before' );
}
add_action( 'enqueue_block_editor_assets', 'site_spell_checker_enqueue_editor_assets' );

/**
 * Add the settings page under Settings.
 */
function site_spell_checker_add_settings_page() {
	add_options_page(
		__( 'Site Spell Checker', 'site-spell-checker' ),
		__( 'Site Spell Checker', 'site-spell-checker' ),
		'manage_options',
		'site-spell-checker',
		'site_spell_checker_render_settings_page'
	);
}
add_action( 'admin_menu', 'site_spell_checker_add_settings_page' );

/**
 * Add a Settings link on the Plugins screen.
 *
 * @param string[] $links Existing links.
 * @return string[]
 */
function site_spell_checker_action_links( $links ) {
	$url = admin_url( 'options-general.php?page=site-spell-checker' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Settings', 'site-spell-checker' ) . '</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'site_spell_checker_action_links' );

/**
 * Render the settings page. Saving goes through options.php, which checks the
 * settings nonce and the manage_options capability.
 */
function site_spell_checker_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$words = (array) get_option( 'site_spell_checker_ignored_words', array() );
	?>
	<div class="wrap">
		<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
		<p><?php esc_html_e( 'Open any post in the block editor and choose the Site Spell Checker icon in the toolbar to check the title and content. Text is checked in your browser and is never sent to any server.', 'site-spell-checker' ); ?></p>
		<form action="options.php" method="post">
			<?php settings_fields( 'site_spell_checker' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="site-spell-checker-ignored-words"><?php esc_html_e( 'Site dictionary', 'site-spell-checker' ); ?></label></th>
					<td>
						<textarea id="site-spell-checker-ignored-words" name="site_spell_checker_ignored_words" rows="10" cols="40" class="large-text code"><?php echo esc_textarea( implode( "\n", $words ) ); ?></textarea>
						<p class="description"><?php esc_html_e( 'One word per line. These words are never flagged on this site, for example product names or industry terms.', 'site-spell-checker' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Names and acronyms', 'site-spell-checker' ); ?></th>
					<td>
						<input type="hidden" name="site_spell_checker_skip_capitalized" value="0">
						<label><input type="checkbox" name="site_spell_checker_skip_capitalized" value="1" <?php checked( (bool) get_option( 'site_spell_checker_skip_capitalized', true ) ); ?>> <?php esc_html_e( 'Skip capitalized words in the middle of a sentence (usually names)', 'site-spell-checker' ); ?></label><br>
						<input type="hidden" name="site_spell_checker_ignore_all_caps" value="0">
						<label><input type="checkbox" name="site_spell_checker_ignore_all_caps" value="1" <?php checked( (bool) get_option( 'site_spell_checker_ignore_all_caps', true ) ); ?>> <?php esc_html_e( 'Skip words in ALL CAPS (usually acronyms)', 'site-spell-checker' ); ?></label>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'Footer credit', 'site-spell-checker' ); ?></th>
					<td>
						<input type="hidden" name="site_spell_checker_show_credit" value="0">
						<label><input type="checkbox" name="site_spell_checker_show_credit" value="1" <?php checked( (bool) get_option( 'site_spell_checker_show_credit', false ) ); ?>> <?php esc_html_e( 'Show a small "Spell checked with Site Spell Checker" link in the site footer (off by default)', 'site-spell-checker' ); ?></label>
					</td>
				</tr>
			</table>
			<?php submit_button(); ?>
		</form>
		<hr>
		<h2><?php esc_html_e( 'Check every page at once', 'site-spell-checker' ); ?></h2>
		<p><?php esc_html_e( 'This plugin checks one post at a time. The optional paid Site Spell Checker service crawls every page of your public site and emails you a report.', 'site-spell-checker' ); ?></p>
		<p><a class="button" href="<?php echo esc_url( site_spell_checker_scan_url( 'settings' ) ); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Scan every page of your site', 'site-spell-checker' ); ?></a></p>
	</div>
	<?php
}

/**
 * Add inline styles for the optional footer credit.
 */
function site_spell_checker_credit_styles() {
	if ( ! get_option( 'site_spell_checker_show_credit', false ) ) {
		return;
	}
	wp_register_style( 'site-spell-checker-credit', false, array(), SITE_SPELL_CHECKER_VERSION );
	wp_enqueue_style( 'site-spell-checker-credit' );
	wp_add_inline_style( 'site-spell-checker-credit', '.site-spell-checker-credit{display:block;margin:1em auto;font-size:.75em;opacity:.7;text-align:center}' );
}
add_action( 'wp_enqueue_scripts', 'site_spell_checker_credit_styles' );

/**
 * Print the optional footer credit (opt-in, off by default).
 */
function site_spell_checker_footer_credit() {
	if ( ! get_option( 'site_spell_checker_show_credit', false ) ) {
		return;
	}
	printf(
		'<p class="site-spell-checker-credit">%s</p>',
		wp_kses(
			sprintf(
				/* translators: %s: link to Site Spell Checker. */
				__( 'Spell checked with %s', 'site-spell-checker' ),
				'<a href="' . esc_url( 'https://sitespellchecker.com/' ) . '">' . esc_html__( 'Site Spell Checker', 'site-spell-checker' ) . '</a>'
			),
			array( 'a' => array( 'href' => array() ) )
		)
	);
}
add_action( 'wp_footer', 'site_spell_checker_footer_credit' );
