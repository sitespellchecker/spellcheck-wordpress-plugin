<?php
/**
 * Remove all plugin options on uninstall.
 *
 * @package SiteSpellChecker
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

foreach ( array( 'site_spell_checker_ignored_words', 'site_spell_checker_skip_capitalized', 'site_spell_checker_ignore_all_caps', 'site_spell_checker_show_credit' ) as $site_spell_checker_option ) {
	delete_option( $site_spell_checker_option );
}
