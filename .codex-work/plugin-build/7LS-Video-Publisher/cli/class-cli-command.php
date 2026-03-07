<?php
namespace SevenLS_VP;

/**
 * WP-CLI Command Class
 *
 * Provides CLI commands for video sync operations.
 * All sync commands now use Sync_Controller (mode-aware).
 */
class CLI_Command {

    /**
     * Sync new videos (incremental, rolling 24h window).
     *
     * ## EXAMPLES
     *
     *     wp sevenls-vp sync
     *
     * @when after_wp_load
     */
    public function sync($args, $assoc_args) {
        $controller = new Sync_Controller();
        $mode_label = $controller->get_strategy()->get_label();

        \WP_CLI::line("Starting incremental sync (mode: {$mode_label})...");

        $result = $controller->update_new_videos();

        if (is_wp_error($result)) {
            \WP_CLI::error($result->get_error_message());
        }

        \WP_CLI::success(sprintf(
            'Sync completed (%s): %d videos processed (%d created, %d updated, %d errors) in %.1fs',
            $mode_label,
            $result['processed'],
            $result['created'],
            $result['updated'],
            $result['errors'],
            $result['duration']
        ));
    }

    /**
     * Force full sync of all videos (ignores last sync time).
     *
     * ## OPTIONS
     *
     * [--yes]
     * : Skip confirmation prompt.
     *
     * ## EXAMPLES
     *
     *     wp sevenls-vp full-sync
     *     wp sevenls-vp full-sync --yes
     *
     * @when after_wp_load
     */
    public function full_sync($args, $assoc_args) {
        $controller = new Sync_Controller();
        $mode_label = $controller->get_strategy()->get_label();

        \WP_CLI::confirm("This will force re-sync ALL videos (mode: {$mode_label}). Continue?", $assoc_args);

        \WP_CLI::line("Starting full sync (mode: {$mode_label})...");

        $result = $controller->initial_full_update();

        if (is_wp_error($result)) {
            \WP_CLI::error($result->get_error_message());
        }

        \WP_CLI::success(sprintf(
            'Full sync completed (%s): %d videos processed (%d created, %d updated, %d errors) in %.1fs',
            $mode_label,
            $result['processed'],
            $result['created'],
            $result['updated'],
            $result['errors'],
            $result['duration']
        ));
    }

    /**
     * Test API connection and token validity.
     *
     * ## EXAMPLES
     *
     *     wp sevenls-vp test-connection
     *
     * @when after_wp_load
     */
    public function test_connection($args, $assoc_args) {
        \WP_CLI::line('Testing API connection...');

        $controller = new Sync_Controller();
        $result     = $controller->test_api_connect();

        if ($result['success']) {
            \WP_CLI::success("API connection successful! Mode: {$result['label']}");
        } else {
            \WP_CLI::error("Connection failed: {$result['error']}");
        }
    }

    /**
     * Show or change the current content mode.
     *
     * ## OPTIONS
     *
     * [--set=<mode>]
     * : Set the content mode (thai_clip or av_movie).
     *
     * ## EXAMPLES
     *
     *     wp sevenls-vp mode
     *     wp sevenls-vp mode --set=av_movie
     *     wp sevenls-vp mode --set=thai_clip
     *
     * @when after_wp_load
     */
    public function mode($args, $assoc_args) {
        $settings = get_option('sevenls_vp_settings', []);

        if (isset($assoc_args['set'])) {
            $new_mode  = $assoc_args['set'];
            $available = Mode_Factory::get_available_modes();

            if (!isset($available[$new_mode])) {
                \WP_CLI::error('Invalid mode. Available: ' . implode(', ', array_keys($available)));
            }

            $settings['content_mode'] = $new_mode;
            update_option('sevenls_vp_settings', $settings);
            \WP_CLI::success("Mode set to: {$available[$new_mode]} ({$new_mode})");
        } else {
            $current  = $settings['content_mode'] ?? 'thai_clip';
            $strategy = Mode_Factory::create($current);
            \WP_CLI::line("Current mode: {$strategy->get_label()} ({$current})");
        }
    }

    /**
     * Clear all logs.
     *
     * ## EXAMPLES
     *
     *     wp sevenls-vp clear-logs
     *
     * @when after_wp_load
     */
    public function clear_logs($args, $assoc_args) {
        Logger::clear_logs();
        \WP_CLI::success('Logs cleared successfully.');
    }

    /**
     * Show sync statistics.
     *
     * ## EXAMPLES
     *
     *     wp sevenls-vp stats
     *
     * @when after_wp_load
     */
    public function stats($args, $assoc_args) {
        $post_type      = Site_Profile::get_import_post_type();
        $video_count    = wp_count_posts($post_type);
        $last_sync      = get_option('sevenls_vp_last_sync', 'Never');
        $last_full_sync = get_option('sevenls_vp_last_full_sync', 'Never');
        $settings       = get_option('sevenls_vp_settings', []);
        $current_mode   = $settings['content_mode'] ?? 'thai_clip';

        try {
            $strategy   = Mode_Factory::create($current_mode);
            $mode_label = $strategy->get_label();
        } catch (\InvalidArgumentException $e) {
            $mode_label = $current_mode;
        }

        \WP_CLI::line('=== Video Publisher Statistics ===');
        \WP_CLI::line('Content Mode: ' . $mode_label . ' (' . $current_mode . ')');
        \WP_CLI::line('Site Profile: ' . Site_Profile::get_label());
        \WP_CLI::line('Imported Post Type: ' . $post_type);
        \WP_CLI::line('Total Videos: ' . ($video_count->publish + $video_count->draft + $video_count->pending));
        \WP_CLI::line('Published: ' . $video_count->publish);
        \WP_CLI::line('Draft: ' . $video_count->draft);
        \WP_CLI::line('Pending: ' . $video_count->pending);
        \WP_CLI::line('Last Sync: ' . $last_sync);
        \WP_CLI::line('Last Full Sync: ' . $last_full_sync);

        if (Sync_Lock::is_locked()) {
            $info = Sync_Lock::get_info();
            \WP_CLI::warning(sprintf('Sync lock active (PID: %d, since: %s)', $info['pid'] ?? 0, date('Y-m-d H:i:s', $info['time'] ?? 0)));
        }
    }
}

\WP_CLI::add_command('sevenls-vp', 'SevenLS_VP\CLI_Command');
