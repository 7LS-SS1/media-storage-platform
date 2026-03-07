<?php
/**
 * Plugin Name: 7M Video Publisher
 * Plugin URI: https://example.com/7ls-video-publisher
 * Description: Syncs videos from external media-storage-api and publishes them into WordPress using the active site profile
 * Version: 2.0.4
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * Author: 7LS
 * Author URI: https://example.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: video-publisher
 * Domain Path: /languages
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('SEVENLS_VP_VERSION', '2.0.4');
define('SEVENLS_VP_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SEVENLS_VP_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SEVENLS_VP_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * PSR-4 Autoloader
 */
spl_autoload_register(function ($class) {
    $prefix = 'SevenLS_VP\\';
    $base_dir = SEVENLS_VP_PLUGIN_DIR . 'includes/';
    
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    
    $relative_class = substr($class, $len);
    $name = strtolower(str_replace('_', '-', $relative_class));

    // Support both class-*.php and interface-*.php naming
    foreach (['class-', 'interface-'] as $prefix) {
        $file = $base_dir . $prefix . $name . '.php';
        if (file_exists($file)) {
            require $file;
            return;
        }
    }
});

// Load admin classes
require_once SEVENLS_VP_PLUGIN_DIR . 'admin/class-admin.php';
require_once SEVENLS_VP_PLUGIN_DIR . 'admin/class-settings.php';

// Load CLI if WP-CLI is available
if (defined('WP_CLI') && WP_CLI) {
    require_once SEVENLS_VP_PLUGIN_DIR . 'cli/class-cli-command.php';
}

/**
 * Main plugin initialization
 */
function sevenls_vp_init() {
    // Load text domain
    load_plugin_textdomain('7ls-video-publisher', false, dirname(SEVENLS_VP_PLUGIN_BASENAME) . '/languages');
    
    // Initialize plugin
    SevenLS_VP\Plugin::get_instance();
}
add_action('plugins_loaded', 'sevenls_vp_init');

/**
 * Force update all videos via Sync_Controller (mode-aware).
 *
 * @return array|\WP_Error Sync summary or error.
 */
function sevenls_vp_force_sync(): array|\WP_Error {
    $controller = new SevenLS_VP\Sync_Controller();

    return $controller->initial_full_update();
}

/**
 * Activation / Upgrade hook
 */
register_activation_hook(__FILE__, function() {
    // Register CPT to flush rewrite rules
    SevenLS_VP\Post_Type::register();
    flush_rewrite_rules();

    // Set default options (fresh install)
    if (!get_option('sevenls_vp_settings')) {
        add_option('sevenls_vp_settings', [
            'content_mode' => 'thai_clip',
            'enable_retrotube_theme' => false,
            'api_base_url' => '',
            'api_key' => '',
            'project_id' => '',
            'sync_interval' => 'hourly',
            'post_status' => 'publish',
            'post_author' => get_current_user_id(),
            'logging_enabled' => true,
            'log_retention_days' => 30,
        ]);
    } else {
        // Upgrade: ensure content_mode exists in existing settings
        $settings = get_option('sevenls_vp_settings', []);
        if (!isset($settings['content_mode'])) {
            $settings['content_mode'] = 'thai_clip';
        }
        if (!isset($settings['enable_retrotube_theme'])) {
            $settings['enable_retrotube_theme'] = false;
        }
        update_option('sevenls_vp_settings', $settings);
    }

    // Backfill: tag existing video posts with default content_mode
    sevenls_vp_backfill_content_mode();

    // Schedule cron
    if (!wp_next_scheduled('sevenls_vp_scheduled_sync')) {
        wp_schedule_event(time(), 'hourly', 'sevenls_vp_scheduled_sync');
    }
});

/**
 * Backfill _sevenls_vp_content_mode meta for posts that don't have it.
 * Runs once during activation/upgrade. Safe to call multiple times.
 */
function sevenls_vp_backfill_content_mode(): void {
    global $wpdb;

    if (!$wpdb) {
        return;
    }

    $wpdb->query("
        INSERT INTO {$wpdb->postmeta} (post_id, meta_key, meta_value)
        SELECT p.ID, '_sevenls_vp_content_mode', 'thai_clip'
        FROM {$wpdb->posts} p
        WHERE p.post_type = 'video'
        AND NOT EXISTS (
            SELECT 1 FROM {$wpdb->postmeta} pm
            WHERE pm.post_id = p.ID
            AND pm.meta_key = '_sevenls_vp_content_mode'
        )
    ");
}

/**
 * Deactivation hook
 */
register_deactivation_hook(__FILE__, function() {
    wp_clear_scheduled_hook('sevenls_vp_scheduled_sync');
});
