<?php
namespace SevenLS_VP;

/**
 * Main Plugin Class
 * 
 * Coordinates all plugin components
 */
class Plugin {
    
    /**
     * Singleton instance
     */
    private static ?Plugin $instance = null;
    
    /**
     * Get singleton instance
     */
    public static function get_instance(): Plugin {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    /**
     * Constructor
     */
    private function __construct() {
        $this->init_hooks();
        $this->init_components();
    }
    
    /**
     * Initialize WordPress hooks
     */
    private function init_hooks(): void {
        // Register custom post type
        add_action('init', [Post_Type::class, 'register']);
        
        // Register shortcodes
        add_action('init', [Shortcodes::class, 'register']);

        // SEO plugin compatibility
        add_action('init', [SEO_Compat::class, 'register']);
        
        // Add custom cron schedules
        add_filter('cron_schedules', [$this, 'add_cron_schedules']);
        
        // Handle scheduled sync
        add_action('sevenls_vp_scheduled_sync', [$this, 'run_scheduled_sync']);
        
        // Template override for single video
        add_filter('template_include', [$this, 'load_video_template']);

        // Register ?sevenls_video=ID query var and redirect
        add_filter('query_vars', [$this, 'register_query_vars']);
        add_action('template_redirect', [$this, 'handle_video_redirect']);

        // Handle like button ajax
        add_action('wp_ajax_sevenls_vp_like_video', [$this, 'handle_like_video']);
        add_action('wp_ajax_nopriv_sevenls_vp_like_video', [$this, 'handle_like_video']);
    }
    
    /**
     * Initialize plugin components
     */
    private function init_components(): void {
        // Initialize admin interface
        if (is_admin()) {
            new \SevenLS_VP_Admin();
        }

        new Elementor_Integration();
    }
    
    /**
     * Add custom cron schedules
     */
    public function add_cron_schedules(array $schedules): array {
        $schedules['five_minutes'] = [
            'interval' => 300,
            'display' => __('Every 5 Minutes', '7ls-video-publisher')
        ];
        
        $schedules['fifteen_minutes'] = [
            'interval' => 900,
            'display' => __('Every 15 Minutes', '7ls-video-publisher')
        ];
        
        return $schedules;
    }
    
    /**
     * Run scheduled sync via Sync_Controller (mode-aware).
     */
    public function run_scheduled_sync(): void {
        $settings = get_option('sevenls_vp_settings', []);

        if (empty($settings['api_base_url']) || empty($settings['api_key'])) {
            Logger::log('Scheduled sync skipped: API not configured', 'warning');
            return;
        }

        $controller = new Sync_Controller();
        $result     = $controller->update_new_videos();

        if (is_wp_error($result)) {
            Logger::log('Scheduled sync failed: ' . $result->get_error_message(), 'error');
        }
    }
    
    /**
     * Load custom template for single video posts
     */
    public function load_video_template(string $template): string {
        if (!Site_Profile::should_use_plugin_video_template()) {
            return $template;
        }

        if (is_singular(Site_Profile::get_import_post_type())) {
            if ($this->should_bypass_template_override()) {
                return $template;
            }

            // Check if theme has override
            $theme_template = locate_template(['single-video.php']);
            
            if ($theme_template) {
                return $theme_template;
            }
            
            // Use plugin template
            $plugin_template = SEVENLS_VP_PLUGIN_DIR . 'templates/single-video.php';
            if (file_exists($plugin_template)) {
                return $plugin_template;
            }
        }
        
        return $template;
    }

    /**
     * Determine if Elementor should control the template output.
     */
    private function should_bypass_template_override(): bool {
        if (!did_action('elementor/loaded')) {
            return false;
        }

        if (class_exists('\Elementor\Plugin')) {
            $elementor = \Elementor\Plugin::$instance;
            if ($elementor->preview->is_preview_mode() || $elementor->editor->is_edit_mode()) {
                return true;
            }
        }

        if (defined('ELEMENTOR_PRO_VERSION')) {
            return true;
        }

        return false;
    }

    /**
     * Register custom query vars.
     */
    public function register_query_vars(array $vars): array {
        $vars[] = 'sevenls_video';
        return $vars;
    }

    /**
     * Handle ?sevenls_video=ID redirect to video permalink.
     * Accepts post ID (numeric) or external_id (string).
     */
    public function handle_video_redirect(): void {
        $video_id = get_query_var('sevenls_video', '');

        if ($video_id === '') {
            return;
        }

        $video_id = sanitize_text_field($video_id);
        $post = null;

        // Try as post ID first
        if (ctype_digit($video_id)) {
            $candidate = get_post((int) $video_id);
            if ($candidate && $candidate->post_type === Site_Profile::get_import_post_type() && $candidate->post_status === 'publish') {
                $post = $candidate;
            }
        }

        // Try as external ID
        if (!$post) {
            $query = new \WP_Query([
                'post_type'      => Site_Profile::get_import_post_type(),
                'post_status'    => 'publish',
                'posts_per_page' => 1,
                'no_found_rows'  => true,
                'meta_query'     => [
                    [
                        'key'     => '_sevenls_vp_external_id',
                        'value'   => $video_id,
                        'compare' => '=',
                    ],
                ],
            ]);

            if ($query->have_posts()) {
                $post = $query->posts[0];
            }
        }

        if ($post) {
            wp_redirect(get_permalink($post), 301);
            exit;
        }

        // Not found — redirect to video archive or trigger 404
        $archive_url = Site_Profile::get_archive_url();
        if ($archive_url) {
            wp_redirect($archive_url, 302);
            exit;
        }

        global $wp_query;
        $wp_query->set_404();
        status_header(404);
    }

    /**
     * Handle like button requests.
     */
    public function handle_like_video(): void {
        if (!check_ajax_referer('sevenls-vp-like-video', 'nonce', false)) {
            wp_send_json_error(['message' => __('Invalid request.', '7ls-video-publisher')], 403);
        }

        $post_id = isset($_POST['post_id']) ? absint($_POST['post_id']) : 0;
        if (!$post_id || get_post_type($post_id) !== 'video') {
            wp_send_json_error(['message' => __('Video not found.', '7ls-video-publisher')], 404);
        }

        $count = (int) get_post_meta($post_id, '_sevenls_vp_like_count', true);
        $count++;
        update_post_meta($post_id, '_sevenls_vp_like_count', $count);

        wp_send_json_success(['count' => $count]);
    }
}
