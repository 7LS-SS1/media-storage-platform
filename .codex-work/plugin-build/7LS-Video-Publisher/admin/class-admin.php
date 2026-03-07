<?php
/**
 * Admin Class
 * 
 * Handles admin interface and menus
 */
class SevenLS_VP_Admin {
    
    /**
     * Constructor
     */
    public function __construct() {
        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_admin_assets']);
        add_action('admin_init', [$this, 'handle_admin_actions']);
        add_filter('manage_video_posts_columns', [$this, 'add_custom_columns']);
        add_action('manage_video_posts_custom_column', [$this, 'render_custom_columns'], 10, 2);
        add_action('admin_notices', [$this, 'show_admin_notices']);
    }
    
    /**
     * Add admin menu
     */
    public function add_admin_menu(): void {
        add_menu_page(
            __('Video Publisher', '7ls-video-publisher'),
            __('Video Publisher', '7ls-video-publisher'),
            'manage_options',
            'sevenls-video-publisher',
            [$this, 'render_settings_page'],
            'dashicons-video-alt2',
            30
        );
        
        add_submenu_page(
            'sevenls-video-publisher',
            __('Settings', '7ls-video-publisher'),
            __('Settings', '7ls-video-publisher'),
            'manage_options',
            'sevenls-video-publisher',
            [$this, 'render_settings_page']
        );
        
        add_submenu_page(
            'sevenls-video-publisher',
            __('Logs', '7ls-video-publisher'),
            __('Logs', '7ls-video-publisher'),
            'manage_options',
            'sevenls-video-publisher-logs',
            [$this, 'render_logs_page']
        );
    }
    
    /**
     * Enqueue admin assets
     */
    public function enqueue_admin_assets(string $hook): void {
        if (strpos($hook, 'sevenls-video-publisher') === false) {
            return;
        }
        
        wp_enqueue_style(
            'sevenls-vp-admin',
            SEVENLS_VP_PLUGIN_URL . 'assets/admin.css',
            [],
            SEVENLS_VP_VERSION
        );

        wp_enqueue_script(
            'sevenls-vp-admin',
            SEVENLS_VP_PLUGIN_URL . 'assets/admin.js',
            [],
            SEVENLS_VP_VERSION,
            true
        );
    }
    
    /**
     * Handle admin actions
     */
    public function handle_admin_actions(): void {
        // Manual sync action (incremental — rolling 24h)
        if (isset($_POST['sevenls_vp_manual_sync']) && check_admin_referer('sevenls_vp_manual_sync')) {
            if (!current_user_can('manage_options')) {
                wp_die(__('Unauthorized', '7ls-video-publisher'));
            }

            $controller = new SevenLS_VP\Sync_Controller();
            $result     = $controller->update_new_videos();

            if (is_wp_error($result)) {
                set_transient('sevenls_vp_admin_notice', [
                    'type'    => 'error',
                    'message' => $result->get_error_message(),
                ], 30);
            } else {
                set_transient('sevenls_vp_admin_notice', [
                    'type'    => 'success',
                    'message' => sprintf(
                        __('Sync completed (%s): %d videos processed (%d created, %d updated) in %.1fs', '7ls-video-publisher'),
                        $controller->get_strategy()->get_label(),
                        $result['processed'],
                        $result['created'],
                        $result['updated'],
                        $result['duration']
                    ),
                ], 30);
            }

            wp_redirect(admin_url('admin.php?page=sevenls-video-publisher&tab=updates'));
            exit;
        }

        // Full sync action (force — all videos)
        if (isset($_POST['sevenls_vp_full_sync']) && check_admin_referer('sevenls_vp_full_sync')) {
            if (!current_user_can('manage_options')) {
                wp_die(__('Unauthorized', '7ls-video-publisher'));
            }

            $controller = new SevenLS_VP\Sync_Controller();
            $result     = $controller->initial_full_update();

            if (is_wp_error($result)) {
                set_transient('sevenls_vp_admin_notice', [
                    'type'    => 'error',
                    'message' => $result->get_error_message(),
                ], 30);
            } else {
                set_transient('sevenls_vp_admin_notice', [
                    'type'    => 'success',
                    'message' => sprintf(
                        __('Full sync completed (%s): %d videos processed (%d created, %d updated) in %.1fs', '7ls-video-publisher'),
                        $controller->get_strategy()->get_label(),
                        $result['processed'],
                        $result['created'],
                        $result['updated'],
                        $result['duration']
                    ),
                ], 30);
            }

            wp_redirect(admin_url('admin.php?page=sevenls-video-publisher&tab=updates'));
            exit;
        }
        
        // Clear logs action
        if (isset($_POST['sevenls_vp_clear_logs']) && check_admin_referer('sevenls_vp_clear_logs')) {
            if (!current_user_can('manage_options')) {
                wp_die(__('Unauthorized', '7ls-video-publisher'));
            }
            
            SevenLS_VP\Logger::clear_logs();
            
            set_transient('sevenls_vp_admin_notice', [
                'type' => 'success',
                'message' => __('Logs cleared successfully', '7ls-video-publisher')
            ], 30);
            
            wp_redirect(admin_url('admin.php?page=sevenls-video-publisher-logs'));
            exit;
        }
        
        // Test API connection (mode-aware)
        if (isset($_POST['sevenls_vp_test_connection']) && check_admin_referer('sevenls_vp_test_connection')) {
            if (!current_user_can('manage_options')) {
                wp_die(__('Unauthorized', '7ls-video-publisher'));
            }

            $controller = new SevenLS_VP\Sync_Controller();
            $result     = $controller->test_api_connect();

            if ($result['success']) {
                set_transient('sevenls_vp_admin_notice', [
                    'type'    => 'success',
                    'message' => sprintf(
                        __('API connection successful! Mode: %s', '7ls-video-publisher'),
                        $result['label']
                    ),
                ], 30);
            } else {
                set_transient('sevenls_vp_admin_notice', [
                    'type'    => 'error',
                    'message' => __('API connection failed: ', '7ls-video-publisher') . $result['error'],
                ], 30);
            }

            wp_redirect(admin_url('admin.php?page=sevenls-video-publisher&tab=updates'));
            exit;
        }
    }
    
    /**
     * Show admin notices
     */
    public function show_admin_notices(): void {
        $notice = get_transient('sevenls_vp_admin_notice');
        
        if ($notice) {
            $type = isset($notice['type']) ? sanitize_key($notice['type']) : 'info';
            $message = isset($notice['message']) ? $notice['message'] : '';
            
            printf(
                '<div class="notice notice-%1$s is-dismissible"><p>%2$s</p></div>',
                esc_attr($type),
                esc_html($message)
            );
            
            delete_transient('sevenls_vp_admin_notice');
        }
    }
    
    /**
     * Render settings page
     */
    public function render_settings_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', '7ls-video-publisher'));
        }
        
        require_once SEVENLS_VP_PLUGIN_DIR . 'admin/views/settings-page.php';
    }
    
    /**
     * Render logs page
     */
    public function render_logs_page(): void {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', '7ls-video-publisher'));
        }
        
        require_once SEVENLS_VP_PLUGIN_DIR . 'admin/views/logs-page.php';
    }
    
    /**
     * Add custom columns to video list table
     */
    public function add_custom_columns(array $columns): array {
        $new_columns = [];
        
        foreach ($columns as $key => $value) {
            $new_columns[$key] = $value;
            
            if ($key === 'title') {
                $new_columns['external_id'] = __('External ID', '7ls-video-publisher');
                $new_columns['duration'] = __('Duration', '7ls-video-publisher');
                $new_columns['updated_at'] = __('API Updated', '7ls-video-publisher');
            }
        }
        
        return $new_columns;
    }
    
    /**
     * Render custom columns
     */
    public function render_custom_columns(string $column, int $post_id): void {
        switch ($column) {
            case 'external_id':
                $external_id = get_post_meta($post_id, '_sevenls_vp_external_id', true);
                echo esc_html($external_id ?: '—');
                break;
                
            case 'duration':
                $duration = get_post_meta($post_id, '_sevenls_vp_duration', true);
                if ($duration) {
                    echo esc_html(gmdate('H:i:s', $duration));
                } else {
                    echo '—';
                }
                break;
                
            case 'updated_at':
                $updated_at = get_post_meta($post_id, '_sevenls_vp_source_updated_at', true);
                echo esc_html($updated_at ?: '—');
                break;
        }
    }
}
