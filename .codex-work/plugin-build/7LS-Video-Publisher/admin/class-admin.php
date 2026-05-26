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
        add_action('wp_ajax_sevenls_vp_start_sync', [$this, 'ajax_start_sync']);
        add_action('wp_ajax_sevenls_vp_get_sync_progress', [$this, 'ajax_get_sync_progress']);
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

        wp_localize_script('sevenls-vp-admin', 'sevenlsVpAdmin', [
            'ajaxUrl'          => admin_url('admin-ajax.php'),
            'syncNonce'        => wp_create_nonce('sevenls_vp_sync_ajax'),
            'syncPollInterval' => 1000,
            'syncStaleThreshold' => 180000,
            'labels'           => [
                'preparing'      => __('Preparing sync...', '7ls-video-publisher'),
                'queued'         => __('Queued', '7ls-video-publisher'),
                'running'        => __('Running', '7ls-video-publisher'),
                'completed'      => __('Completed', '7ls-video-publisher'),
                'error'          => __('Error', '7ls-video-publisher'),
                'stalled'        => __('Sync stopped reporting progress. The current request likely timed out while processing.', '7ls-video-publisher'),
                'close'          => __('Close', '7ls-video-publisher'),
                'close_refresh'  => __('Close & Refresh', '7ls-video-publisher'),
                'unknown_total'  => __('Unknown', '7ls-video-publisher'),
                'unknown_page'   => __('In progress', '7ls-video-publisher'),
                'success_alert'  => __('Sync completed successfully.', '7ls-video-publisher'),
                'running_alert'  => __('Sync is in progress.', '7ls-video-publisher'),
                'waiting_item'   => __('Waiting for the first item...', '7ls-video-publisher'),
                'no_pending'     => __('No pending items yet.', '7ls-video-publisher'),
                'no_results'     => __('No completed items yet.', '7ls-video-publisher'),
                'no_errors'      => __('No errors.', '7ls-video-publisher'),
                'created'        => __('Created', '7ls-video-publisher'),
                'updated'        => __('Updated', '7ls-video-publisher'),
                'completed_item' => __('Completed', '7ls-video-publisher'),
                'error_item'     => __('Error', '7ls-video-publisher'),
            ],
        ]);
    }
    
    /**
     * Handle admin actions
     */
    public function handle_admin_actions(): void {
        // Manual sync action (incremental — rolling 24h)
        if (isset($_POST['sevenls_vp_manual_sync']) && check_admin_referer('sevenls_vp_manual_sync')) {
            $this->handle_sync_form_submission('manual_sync');
        }

        // Manual force sync action (last 48h only)
        if (isset($_POST['sevenls_vp_force_recent_sync']) && check_admin_referer('sevenls_vp_force_recent_sync')) {
            $this->handle_sync_form_submission('force_recent_sync');
        }

        // Full sync action (force — all videos)
        if (isset($_POST['sevenls_vp_full_sync']) && check_admin_referer('sevenls_vp_full_sync')) {
            $this->handle_sync_form_submission('full_sync');
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
     * AJAX: run a sync action while frontend polls progress.
     */
    public function ajax_start_sync(): void {
        check_ajax_referer('sevenls_vp_sync_ajax', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error([
                'message' => __('Unauthorized', '7ls-video-publisher'),
            ], 403);
        }

        $sync_action = isset($_POST['sync_action']) ? sanitize_key(wp_unslash($_POST['sync_action'])) : '';
        $job_id      = $this->get_requested_job_id();

        if ($job_id === '') {
            $job_id = 'sync-' . sanitize_key(wp_generate_uuid4());
        }

        $config = $this->get_sync_action_config($sync_action);
        if (is_wp_error($config)) {
            wp_send_json_error([
                'message' => $config->get_error_message(),
            ], 400);
        }

        SevenLS_VP\Sync_Lock::start_progress($job_id, [
            'label'     => $config['operation_label'],
            'operation' => $sync_action,
            'message'   => sprintf(__('Preparing %s...', '7ls-video-publisher'), $config['operation_label']),
            'percent'   => 0,
        ]);

        ignore_user_abort(true);

        $outcome = $this->perform_sync_action($sync_action, $job_id);

        if (is_wp_error($outcome)) {
            SevenLS_VP\Sync_Lock::fail_progress($job_id, $outcome->get_error_message());

            wp_send_json_error([
                'job_id'   => $job_id,
                'message'  => $outcome->get_error_message(),
                'progress' => SevenLS_VP\Sync_Lock::get_progress($job_id),
            ], 500);
        }

        wp_send_json_success([
            'job_id'          => $job_id,
            'message'         => $outcome['message'],
            'operation_label' => $outcome['operation_label'],
            'result'          => $outcome['result'],
            'progress'        => SevenLS_VP\Sync_Lock::get_progress($job_id),
        ]);
    }

    /**
     * AJAX: poll current sync progress.
     */
    public function ajax_get_sync_progress(): void {
        check_ajax_referer('sevenls_vp_sync_ajax', 'nonce');

        if (!current_user_can('manage_options')) {
            wp_send_json_error([
                'message' => __('Unauthorized', '7ls-video-publisher'),
            ], 403);
        }

        $job_id = $this->get_requested_job_id();
        if ($job_id === '') {
            wp_send_json_error([
                'message' => __('Missing sync job ID.', '7ls-video-publisher'),
            ], 400);
        }

        $progress = SevenLS_VP\Sync_Lock::get_progress($job_id);

        if ($progress === null) {
            $progress = [
                'job_id'       => $job_id,
                'status'       => 'queued',
                'message'      => __('Preparing sync...', '7ls-video-publisher'),
                'label'        => '',
                'operation'    => '',
                'mode'         => '',
                'mode_label'   => '',
                'percent'      => 0,
                'processed'    => 0,
                'completed_items' => 0,
                'handled'      => 0,
                'created'      => 0,
                'updated'      => 0,
                'errors'       => 0,
                'current_page' => 0,
                'total_pages'  => null,
                'total_items'  => null,
                'started_at'   => 0,
                'finished_at'  => null,
                'updated_at'   => null,
                'duration'     => null,
                'current_item' => '',
                'pending_items' => [],
                'recent_results' => [],
                'error_items' => [],
            ];
        }

        wp_send_json_success($progress);
    }

    /**
     * Handle a non-AJAX sync form submission.
     */
    private function handle_sync_form_submission(string $sync_action): void {
        if (!current_user_can('manage_options')) {
            wp_die(__('Unauthorized', '7ls-video-publisher'));
        }

        $outcome = $this->perform_sync_action($sync_action);

        if (is_wp_error($outcome)) {
            set_transient('sevenls_vp_admin_notice', [
                'type'    => 'error',
                'message' => $outcome->get_error_message(),
            ], 30);
        } else {
            set_transient('sevenls_vp_admin_notice', [
                'type'    => 'success',
                'message' => $outcome['message'],
            ], 30);
        }

        wp_redirect(admin_url('admin.php?page=sevenls-video-publisher&tab=updates'));
        exit;
    }

    /**
     * Execute a sync action.
     *
     * @return array{sync_action: string, operation_label: string, mode_label: string, result: array, message: string}|\WP_Error
     */
    private function perform_sync_action(string $sync_action, ?string $progress_job_id = null): array|\WP_Error {
        $config = $this->get_sync_action_config($sync_action);
        if (is_wp_error($config)) {
            return $config;
        }

        $controller = new SevenLS_VP\Sync_Controller();
        $mode_label = $controller->get_strategy()->get_label();
        $method     = $config['controller_method'];
        $result     = $progress_job_id !== null
            ? $controller->{$method}($progress_job_id)
            : $controller->{$method}();

        if (is_wp_error($result)) {
            return $result;
        }

        return [
            'sync_action'     => $sync_action,
            'operation_label' => $config['operation_label'],
            'mode_label'      => $mode_label,
            'result'          => $result,
            'message'         => sprintf(
                $config['success_template'],
                $mode_label,
                $result['processed'],
                $result['created'],
                $result['updated'],
                $result['duration']
            ),
        ];
    }

    /**
     * @return array{operation_label: string, controller_method: string, success_template: string}|\WP_Error
     */
    private function get_sync_action_config(string $sync_action): array|\WP_Error {
        switch ($sync_action) {
            case 'manual_sync':
                return [
                    'operation_label'   => __('Update Latest/New Videos', '7ls-video-publisher'),
                    'controller_method' => 'update_new_videos',
                    'success_template'  => __('Sync completed (%s): %d videos processed (%d created, %d updated) in %.1fs', '7ls-video-publisher'),
                ];

            case 'force_recent_sync':
                return [
                    'operation_label'   => __('Force Latest 2 Days', '7ls-video-publisher'),
                    'controller_method' => 'force_recent_videos_update',
                    'success_template'  => __('Force sync completed for the last 2 days (%s): %d videos processed (%d created, %d updated) in %.1fs', '7ls-video-publisher'),
                ];

            case 'full_sync':
                return [
                    'operation_label'   => __('Full Sync (Force)', '7ls-video-publisher'),
                    'controller_method' => 'initial_full_update',
                    'success_template'  => __('Full sync completed (%s): %d videos processed (%d created, %d updated) in %.1fs', '7ls-video-publisher'),
                ];
        }

        return new \WP_Error('invalid_sync_action', __('Invalid sync action.', '7ls-video-publisher'));
    }

    private function get_requested_job_id(): string {
        $job_id = isset($_REQUEST['job_id']) ? (string) wp_unslash($_REQUEST['job_id']) : '';
        $job_id = preg_replace('/[^A-Za-z0-9_-]/', '', $job_id);

        return is_string($job_id) ? $job_id : '';
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
