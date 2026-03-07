<?php
/**
 * Settings Class
 * 
 * Handles plugin settings using WordPress Settings API
 */
class SevenLS_VP_Settings {
    
    /**
     * Register settings
     */
    public static function register(): void {
        register_setting('sevenls_vp_settings_group', 'sevenls_vp_settings', [
            'sanitize_callback' => [__CLASS__, 'sanitize_settings']
        ]);
        
        // API Settings Section
        add_settings_section(
            'sevenls_vp_api_section',
            __('API Configuration', '7ls-video-publisher'),
            [__CLASS__, 'render_api_section'],
            'sevenls-video-publisher'
        );
        
        add_settings_field(
            'content_mode',
            __('Content Mode', '7ls-video-publisher'),
            [__CLASS__, 'render_mode_field'],
            'sevenls-video-publisher',
            'sevenls_vp_api_section'
        );

        add_settings_field(
            'enable_retrotube_theme',
            __('RetroTube Compatibility', '7ls-video-publisher'),
            [__CLASS__, 'render_retrotube_theme_field'],
            'sevenls-video-publisher',
            'sevenls_vp_api_section'
        );

        add_settings_field(
            'api_base_url',
            __('API Base URL', '7ls-video-publisher'),
            [__CLASS__, 'render_text_field'],
            'sevenls-video-publisher',
            'sevenls_vp_api_section',
            ['field' => 'api_base_url', 'placeholder' => 'https://api.example.com']
        );
        
        add_settings_field(
            'api_key',
            __('API Key / Bearer Token', '7ls-video-publisher'),
            [__CLASS__, 'render_password_field'],
            'sevenls-video-publisher',
            'sevenls_vp_api_section',
            ['field' => 'api_key']
        );
        
        add_settings_field(
            'project_id',
            __('Project ID (Optional)', '7ls-video-publisher'),
            [__CLASS__, 'render_text_field'],
            'sevenls-video-publisher',
            'sevenls_vp_api_section',
            ['field' => 'project_id']
        );
        
        // Sync Settings Section
        add_settings_section(
            'sevenls_vp_sync_section',
            __('Sync Configuration', '7ls-video-publisher'),
            null,
            'sevenls-video-publisher'
        );
        
        add_settings_field(
            'sync_interval',
            __('Sync Interval', '7ls-video-publisher'),
            [__CLASS__, 'render_sync_interval_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );
        
        add_settings_field(
            'post_status',
            __('Post Status for Imported Videos', '7ls-video-publisher'),
            [__CLASS__, 'render_post_status_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );
        
        add_settings_field(
            'post_author',
            __('Post Author', '7ls-video-publisher'),
            [__CLASS__, 'render_author_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );
        
        // Logging Section
        add_settings_section(
            'sevenls_vp_logging_section',
            __('Logging', '7ls-video-publisher'),
            null,
            'sevenls-video-publisher'
        );
        
        add_settings_field(
            'logging_enabled',
            __('Enable Logging', '7ls-video-publisher'),
            [__CLASS__, 'render_checkbox_field'],
            'sevenls-video-publisher',
            'sevenls_vp_logging_section',
            ['field' => 'logging_enabled']
        );
        
        add_settings_field(
            'log_retention_days',
            __('Log Retention (Days)', '7ls-video-publisher'),
            [__CLASS__, 'render_number_field'],
            'sevenls-video-publisher',
            'sevenls_vp_logging_section',
            ['field' => 'log_retention_days', 'min' => 1, 'max' => 365]
        );
    }
    
    /**
     * Sanitize settings
     */
    public static function sanitize_settings(array $input): array {
        $sanitized = [];
        
        $valid_modes = ['thai_clip', 'av_movie'];
        $sanitized['content_mode'] = in_array($input['content_mode'] ?? 'thai_clip', $valid_modes, true)
            ? $input['content_mode']
            : 'thai_clip';
        $sanitized['enable_retrotube_theme'] = !empty($input['enable_retrotube_theme']);
        $sanitized['api_base_url'] = esc_url_raw($input['api_base_url'] ?? '');
        $sanitized['api_key'] = sanitize_text_field($input['api_key'] ?? '');
        $sanitized['project_id'] = sanitize_text_field($input['project_id'] ?? '');
        $sanitized['sync_interval'] = sanitize_text_field($input['sync_interval'] ?? 'hourly');
        $sanitized['post_status'] = in_array($input['post_status'] ?? 'publish', ['draft', 'publish', 'pending']) 
            ? $input['post_status'] 
            : 'publish';
        $sanitized['post_author'] = absint($input['post_author'] ?? get_current_user_id());
        $sanitized['logging_enabled'] = !empty($input['logging_enabled']);
        $sanitized['log_retention_days'] = absint($input['log_retention_days'] ?? 30);
        
        // Update cron schedule if changed
        $old_settings = get_option('sevenls_vp_settings', []);
        if (($old_settings['sync_interval'] ?? '') !== $sanitized['sync_interval']) {
            wp_clear_scheduled_hook('sevenls_vp_scheduled_sync');
            
            $schedules = ['five_minutes', 'fifteen_minutes', 'hourly', 'twicedaily', 'daily'];
            if (in_array($sanitized['sync_interval'], $schedules)) {
                wp_schedule_event(time(), $sanitized['sync_interval'], 'sevenls_vp_scheduled_sync');
            }
        }

        $old_retrotube_enabled = !empty($old_settings['enable_retrotube_theme']);
        if (!empty($old_settings) && $old_retrotube_enabled !== $sanitized['enable_retrotube_theme']) {
            flush_rewrite_rules();
        }

        return $sanitized;
    }
    
    /**
     * Render API section description
     */
    public static function render_api_section(): void {
        echo '<p>' . esc_html__('Configure your external media storage API connection.', '7ls-video-publisher') . '</p>';
    }
    
    /**
     * Render text field
     */
    public static function render_text_field(array $args): void {
        $settings = get_option('sevenls_vp_settings', []);
        $value = $settings[$args['field']] ?? '';
        $placeholder = $args['placeholder'] ?? '';
        
        printf(
            '<input type="text" name="sevenls_vp_settings[%1$s]" value="%2$s" class="regular-text" placeholder="%3$s" />',
            esc_attr($args['field']),
            esc_attr($value),
            esc_attr($placeholder)
        );
    }
    
    /**
     * Render password field
     */
    public static function render_password_field(array $args): void {
        $settings = get_option('sevenls_vp_settings', []);
        $value = $settings[$args['field']] ?? '';
        
        printf(
            '<input type="password" name="sevenls_vp_settings[%1$s]" value="%2$s" class="regular-text" autocomplete="new-password" />',
            esc_attr($args['field']),
            esc_attr($value)
        );
    }
    
    /**
     * Render number field
     */
    public static function render_number_field(array $args): void {
        $settings = get_option('sevenls_vp_settings', []);
        $value = $settings[$args['field']] ?? '';
        
        printf(
            '<input type="number" name="sevenls_vp_settings[%1$s]" value="%2$s" class="small-text" min="%3$d" max="%4$d" />',
            esc_attr($args['field']),
            esc_attr($value),
            $args['min'] ?? 0,
            $args['max'] ?? 999999
        );
    }
    
    /**
     * Render checkbox field
     */
    public static function render_checkbox_field(array $args): void {
        $settings = get_option('sevenls_vp_settings', []);
        $checked = !empty($settings[$args['field']]);
        
        printf(
            '<label><input type="checkbox" name="sevenls_vp_settings[%1$s]" value="1" %2$s /></label>',
            esc_attr($args['field']),
            checked($checked, true, false)
        );
    }
    
    /**
     * Render content mode dropdown
     */
    public static function render_mode_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $current  = $settings['content_mode'] ?? 'thai_clip';
        $modes    = SevenLS_VP\Mode_Factory::get_available_modes();

        echo '<select name="sevenls_vp_settings[content_mode]" id="sevenls_vp_content_mode">';
        foreach ($modes as $key => $label) {
            printf(
                '<option value="%1$s" %2$s>%3$s</option>',
                esc_attr($key),
                selected($current, $key, false),
                esc_html($label)
            );
        }
        echo '</select>';
        echo '<p class="description">';
        esc_html_e('Select the content type to sync from the API. Changing mode does not delete existing data.', '7ls-video-publisher');
        echo '</p>';
    }

    /**
     * Render RetroTube compatibility field.
     */
    public static function render_retrotube_theme_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $enabled = !empty($settings['enable_retrotube_theme']);

        printf(
            '<label><input type="checkbox" name="sevenls_vp_settings[enable_retrotube_theme]" value="1" %1$s /> %2$s</label>',
            checked($enabled, true, false),
            esc_html__('Enable RetroTube-specific post/meta/taxonomy mapping', '7ls-video-publisher')
        );

        echo '<p class="description">';
        esc_html_e('Opt-in only for sites using the RetroTube theme. Imported videos will sync into standard WordPress posts with RetroTube fields. Leave disabled for the main 7LS theme flow. Changing this setting does not migrate existing imported posts.', '7ls-video-publisher');
        echo '</p>';
    }

    /**
     * Render sync interval field
     */
    public static function render_sync_interval_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $value = $settings['sync_interval'] ?? 'hourly';
        
        $intervals = [
            'five_minutes' => __('Every 5 Minutes', '7ls-video-publisher'),
            'fifteen_minutes' => __('Every 15 Minutes', '7ls-video-publisher'),
            'hourly' => __('Hourly', '7ls-video-publisher'),
            'twicedaily' => __('Twice Daily', '7ls-video-publisher'),
            'daily' => __('Daily', '7ls-video-publisher'),
        ];
        
        echo '<select name="sevenls_vp_settings[sync_interval]">';
        foreach ($intervals as $key => $label) {
            printf(
                '<option value="%1$s" %2$s>%3$s</option>',
                esc_attr($key),
                selected($value, $key, false),
                esc_html($label)
            );
        }
        echo '</select>';
    }
    
    /**
     * Render post status field
     */
    public static function render_post_status_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $value = $settings['post_status'] ?? 'publish';
        
        $statuses = [
            'draft' => __('Draft', '7ls-video-publisher'),
            'publish' => __('Published', '7ls-video-publisher'),
            'pending' => __('Pending Review', '7ls-video-publisher'),
        ];
        
        echo '<select name="sevenls_vp_settings[post_status]">';
        foreach ($statuses as $key => $label) {
            printf(
                '<option value="%1$s" %2$s>%3$s</option>',
                esc_attr($key),
                selected($value, $key, false),
                esc_html($label)
            );
        }
        echo '</select>';
    }
    
    /**
     * Render author field
     */
    public static function render_author_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $value = $settings['post_author'] ?? get_current_user_id();
        
        wp_dropdown_users([
            'name' => 'sevenls_vp_settings[post_author]',
            'selected' => $value,
            'show_option_none' => __('Current User', '7ls-video-publisher'),
            'option_none_value' => 0
        ]);
    }
}

// Initialize settings
add_action('admin_init', ['SevenLS_VP_Settings', 'register']);
