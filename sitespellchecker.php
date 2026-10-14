<?php
/**
 * Plugin Name: Site Spell Checker
 * Plugin URI: https://sitespellchecker.com/
 * Description: Check WordPress post content for spelling errors with a local Hunspell dictionary.
 * Version: 1.0.0
 * Author: Site Spell Checker
 * Author URI: https://sitespellchecker.com/
 * License: GPL-2.0-or-later
 * Text Domain: site-spell-checker
 * Requires at least: 6.0
 * Requires PHP: 7.4
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SSC_PLUGIN_VERSION', '1.0.0');
define('SSC_PLUGIN_URL', plugin_dir_url(__FILE__));

function ssc_enqueue_editor_assets(): void
{
    $base = SSC_PLUGIN_URL . 'assets/';
    wp_enqueue_script('ssc-typo', $base . 'typo.js', [], SSC_PLUGIN_VERSION, true);
    wp_enqueue_script('ssc-editor', $base . 'editor.js', ['wp-plugins', 'wp-edit-post', 'wp-element', 'wp-data', 'wp-components', 'ssc-typo'], SSC_PLUGIN_VERSION, true);
    wp_enqueue_style('ssc-editor', $base . 'editor.css', [], SSC_PLUGIN_VERSION);
    wp_localize_script('ssc-editor', 'siteSpellChecker', [
        'affUrl' => $base . 'en_US.aff',
        'dictionaryUrl' => $base . 'en_US.dic',
        'siteScanUrl' => 'https://sitespellchecker.com/site-scans/checkout?domain=' . rawurlencode(wp_parse_url(home_url(), PHP_URL_HOST)),
    ]);
}
add_action('enqueue_block_editor_assets', 'ssc_enqueue_editor_assets');

function ssc_add_settings_page(): void
{
    add_options_page('Site Spell Checker', 'Site Spell Checker', 'manage_options', 'site-spell-checker', 'ssc_render_settings_page');
}
add_action('admin_menu', 'ssc_add_settings_page');

function ssc_register_settings(): void
{
    register_setting('ssc_settings', 'ssc_show_credit', ['type' => 'boolean', 'sanitize_callback' => 'rest_sanitize_boolean', 'default' => 0]);
}
add_action('admin_init', 'ssc_register_settings');

function ssc_render_settings_page(): void
{
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('Site Spell Checker', 'site-spell-checker'); ?></h1>
        <p><?php esc_html_e('Check spelling in the WordPress block editor. Text is checked in your browser and is never sent to Site Spell Checker.', 'site-spell-checker'); ?></p>
        <p><a class="button button-primary" href="<?php echo esc_url('https://sitespellchecker.com/site-scans/checkout?domain=' . rawurlencode(wp_parse_url(home_url(), PHP_URL_HOST))); ?>" target="_blank" rel="noopener noreferrer"><?php esc_html_e('Scan your entire website', 'site-spell-checker'); ?></a></p>
        <form action="options.php" method="post">
            <?php settings_fields('ssc_settings'); ?>
            <input type="hidden" name="ssc_show_credit" value="0">
            <label><input type="checkbox" name="ssc_show_credit" value="1" <?php checked((bool) get_option('ssc_show_credit', 0)); ?>>
                <?php esc_html_e('Show a small “Spell checked with Site Spell Checker” link in the site footer.', 'site-spell-checker'); ?></label>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

function ssc_footer_credit(): void
{
    if (is_admin() || !get_option('ssc_show_credit', 0)) {
        return;
    }
    echo '<p class="ssc-credit">Spell checked with <a href="https://sitespellchecker.com/">Site Spell Checker</a></p>';
}
add_action('wp_footer', 'ssc_footer_credit');

function ssc_credit_styles(): void
{
    if (!is_admin() && get_option('ssc_show_credit', 0)) {
        echo '<style>.ssc-credit{display:block;margin-top:1em;font-size:.75em;opacity:.7}</style>';
    }
}
add_action('wp_head', 'ssc_credit_styles');
