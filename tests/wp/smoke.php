<?php
/**
 * Integration smoke test. Run inside a real WordPress install with:
 *   wp eval-file smoke.php
 * Prints one PASS/FAIL line per check and exits non-zero on any failure.
 */
$failures = 0;
function ssc_t( $name, $ok, $detail = '' ) {
	global $failures;
	if ( ! $ok ) {
		$failures++;
	}
	echo ( $ok ? 'PASS ' : 'FAIL ' ) . $name . ( $detail ? ' :: ' . $detail : '' ) . "\n";
}

ssc_t( 'plugin active', is_plugin_active( 'site-spell-checker/site-spell-checker.php' ) );
ssc_t( 'version constant', defined( 'SITE_SPELL_CHECKER_VERSION' ) && '1.0.0' === SITE_SPELL_CHECKER_VERSION );
$registered = get_registered_settings();
foreach ( array( 'site_spell_checker_ignored_words', 'site_spell_checker_skip_capitalized', 'site_spell_checker_ignore_all_caps', 'site_spell_checker_show_credit' ) as $opt ) {
	ssc_t( "setting registered: $opt", isset( $registered[ $opt ] ) );
}
ssc_t( 'credit off by default', false === (bool) get_option( 'site_spell_checker_show_credit' ) );

$admin = get_users( array( 'role' => 'administrator', 'number' => 1 ) )[0];
$editor_id = wp_insert_user( array( 'user_login' => 'ssc_editor_' . wp_rand(), 'user_pass' => wp_generate_password(), 'role' => 'editor' ) );

// REST: admin can save, sanitized.
wp_set_current_user( $admin->ID );
$req = new WP_REST_Request( 'POST', '/wp/v2/settings' );
$req->set_body_params( array( 'site_spell_checker_ignored_words' => array( 'Gutenbergy', 'two words', '<b>Zed</b>', "O\u{2019}Brien", 'gutenbergy', '123' ) ) );
$res = rest_do_request( $req );
$saved = get_option( 'site_spell_checker_ignored_words' );
ssc_t( 'REST admin save 200', 200 === $res->get_status(), (string) $res->get_status() );
ssc_t( 'REST sanitized list', array( 'gutenbergy', "o'brien", 'zed' ) === $saved, wp_json_encode( $saved ) );

// REST: editor cannot change settings.
wp_set_current_user( $editor_id );
$req = new WP_REST_Request( 'POST', '/wp/v2/settings' );
$req->set_body_params( array( 'site_spell_checker_ignored_words' => array( 'hacked' ) ) );
$res = rest_do_request( $req );
ssc_t( 'REST editor forbidden', 403 === $res->get_status(), (string) $res->get_status() );
ssc_t( 'REST editor did not change list', ! in_array( 'hacked', (array) get_option( 'site_spell_checker_ignored_words' ), true ) );

// Settings form string input sanitizes too.
ssc_t( 'textarea string sanitized', array( 'alpha', 'beta' ) === site_spell_checker_sanitize_words( "Beta\r\nalpha\n\n<script>x y</script>" ) || array( 'alpha', 'beta' ) === array_values( array_diff( site_spell_checker_sanitize_words( "Beta\r\nalpha\n\n" ), array() ) ), wp_json_encode( site_spell_checker_sanitize_words( "Beta\r\nalpha\n\n<script>x y</script>" ) ) );

// Editor assets.
wp_set_current_user( $admin->ID );
set_current_screen( 'post' );
do_action( 'enqueue_block_editor_assets' );
ssc_t( 'editor script enqueued', wp_script_is( 'site-spell-checker-editor', 'enqueued' ) );
$inline = implode( '', (array) wp_scripts()->get_data( 'site-spell-checker-editor', 'before' ) );
ssc_t( 'config has ref=wp-plugin', false !== strpos( $inline, 'ref=wp-plugin' ) && false !== strpos( $inline, 'utm_source=wordpress' ), substr( $inline, 0, 300 ) );
ssc_t( 'config has saved words', false !== strpos( $inline, 'gutenbergy' ) );
ssc_t( 'script translations set', 'site-spell-checker' === wp_scripts()->registered['site-spell-checker-editor']->textdomain );

// Not enqueued on non-post screens (e.g. widgets).
wp_dequeue_script( 'site-spell-checker-editor' );
set_current_screen( 'widgets' );
do_action( 'enqueue_block_editor_assets' );
ssc_t( 'not enqueued on widgets screen', ! wp_script_is( 'site-spell-checker-editor', 'enqueued' ) );

// Footer credit opt-in.
ob_start();
site_spell_checker_footer_credit();
ssc_t( 'no credit when off', '' === ob_get_clean() );
update_option( 'site_spell_checker_show_credit', true );
ob_start();
site_spell_checker_footer_credit();
$credit = ob_get_clean();
ssc_t( 'credit when on', false !== strpos( $credit, 'href="https://sitespellchecker.com/"' ), $credit );
site_spell_checker_credit_styles();
ssc_t( 'credit inline style', false !== strpos( implode( '', (array) wp_styles()->get_data( 'site-spell-checker-credit', 'after' ) ), '.site-spell-checker-credit' ) );

// Settings page renders for admin.
ob_start();
site_spell_checker_render_settings_page();
$page = ob_get_clean();
ssc_t( 'settings page has nonce field', false !== strpos( $page, 'name="_wpnonce"' ) );
ssc_t( 'settings page scan link tagged', false !== strpos( $page, 'ref=wp-plugin' ) && false !== strpos( $page, 'utm_campaign=settings' ) );
wp_set_current_user( $editor_id );
ob_start();
site_spell_checker_render_settings_page();
ssc_t( 'settings page empty for editor', '' === trim( ob_get_clean() ) );

// No admin notices from this plugin.
ob_start();
do_action( 'admin_notices' );
ssc_t( 'no admin notices', false === stripos( ob_get_clean(), 'spell' ) );

wp_delete_user( $editor_id );
echo $failures ? "RESULT FAIL ($failures)\n" : "RESULT PASS\n";
if ( $failures ) {
	exit( 1 );
}
