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
            __('การตั้งค่า API', '7ls-video-publisher'),
            [__CLASS__, 'render_api_section'],
            'sevenls-video-publisher'
        );
        
        add_settings_field(
            'content_mode',
            __('ประเภทเนื้อหา', '7ls-video-publisher'),
            [__CLASS__, 'render_mode_field'],
            'sevenls-video-publisher',
            'sevenls_vp_api_section'
        );

        add_settings_field(
            'enable_retrotube_theme',
            __('รองรับธีม RetroTube', '7ls-video-publisher'),
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
            __('Project ID (ไม่บังคับ)', '7ls-video-publisher'),
            [__CLASS__, 'render_text_field'],
            'sevenls-video-publisher',
            'sevenls_vp_api_section',
            ['field' => 'project_id']
        );

        add_settings_field(
            'allow_self_signed_ssl',
            __('อนุญาต SSL แบบ Self-Signed', '7ls-video-publisher'),
            [__CLASS__, 'render_insecure_ssl_field'],
            'sevenls-video-publisher',
            'sevenls_vp_api_section'
        );
        
        // Sync Settings Section
        add_settings_section(
            'sevenls_vp_sync_section',
            __('การตั้งค่าการซิงก์', '7ls-video-publisher'),
            null,
            'sevenls-video-publisher'
        );
        
        add_settings_field(
            'sync_interval',
            __('ช่วงเวลาซิงก์อัตโนมัติ', '7ls-video-publisher'),
            [__CLASS__, 'render_sync_interval_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );
        
        add_settings_field(
            'post_status',
            __('สถานะโพสต์ของวิดีโอที่นำเข้า', '7ls-video-publisher'),
            [__CLASS__, 'render_post_status_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );
        
        add_settings_field(
            'post_author',
            __('ผู้เขียนโพสต์', '7ls-video-publisher'),
            [__CLASS__, 'render_author_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );

        add_settings_field(
            'sync_batch_size',
            __('จำนวนวิดีโอต่อแบตช์', '7ls-video-publisher'),
            [__CLASS__, 'render_batch_size_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );

        add_settings_field(
            'download_featured_images',
            __('ดาวน์โหลดรูปภาพเด่น', '7ls-video-publisher'),
            [__CLASS__, 'render_download_featured_images_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );

        add_settings_field(
            'save_raw_payload',
            __('บันทึก Raw Payload', '7ls-video-publisher'),
            [__CLASS__, 'render_save_raw_payload_field'],
            'sevenls-video-publisher',
            'sevenls_vp_sync_section'
        );
        
        // Logging Section
        add_settings_section(
            'sevenls_vp_logging_section',
            __('บันทึกเหตุการณ์', '7ls-video-publisher'),
            null,
            'sevenls-video-publisher'
        );
        
        add_settings_field(
            'logging_enabled',
            __('เปิดการบันทึกเหตุการณ์', '7ls-video-publisher'),
            [__CLASS__, 'render_checkbox_field'],
            'sevenls-video-publisher',
            'sevenls_vp_logging_section',
            ['field' => 'logging_enabled']
        );
        
        add_settings_field(
            'log_retention_days',
            __('จำนวนวันเก็บ log', '7ls-video-publisher'),
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
        $sanitized['allow_self_signed_ssl'] = !empty($input['allow_self_signed_ssl']);
        $sanitized['sync_interval'] = sanitize_text_field($input['sync_interval'] ?? 'hourly');
        $sanitized['post_status'] = in_array($input['post_status'] ?? 'publish', ['draft', 'publish', 'pending']) 
            ? $input['post_status'] 
            : 'publish';
        $sanitized['post_author'] = absint($input['post_author'] ?? get_current_user_id());
        $sanitized['sync_batch_size'] = max(10, min(250, absint($input['sync_batch_size'] ?? 100)));
        $sanitized['download_featured_images'] = !empty($input['download_featured_images']);
        $sanitized['save_raw_payload'] = !empty($input['save_raw_payload']);
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
        echo '<p>' . esc_html__('ตั้งค่าการเชื่อมต่อกับ API ภายนอกของระบบจัดเก็บมีเดีย', '7ls-video-publisher') . '</p>';
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
        esc_html_e('เลือกประเภทเนื้อหาที่ต้องการซิงก์จาก API การเปลี่ยนโหมดจะไม่ลบข้อมูลเดิมที่นำเข้าไว้แล้ว', '7ls-video-publisher');
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
            esc_html__('เปิดใช้การแมป post/meta/taxonomy สำหรับ RetroTube โดยเฉพาะ', '7ls-video-publisher')
        );

        echo '<p class="description">';
        esc_html_e('เปิดใช้เฉพาะเว็บไซต์ที่ใช้ธีม RetroTube เท่านั้น วิดีโอที่นำเข้าจะถูกซิงก์เป็นโพสต์มาตรฐานของ WordPress พร้อมฟิลด์ที่ RetroTube ใช้งาน หากเป็นธีม 7LS ปกติให้ปิดไว้ การเปลี่ยนค่านี้จะไม่ย้ายโพสต์ที่นำเข้าไว้ก่อนหน้า', '7ls-video-publisher');
        echo '</p>';
    }

    /**
     * Render self-signed SSL compatibility field.
     */
    public static function render_insecure_ssl_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $enabled = !empty($settings['allow_self_signed_ssl']);

        printf(
            '<label><input type="checkbox" name="sevenls_vp_settings[allow_self_signed_ssl]" value="1" %1$s /> %2$s</label>',
            checked($enabled, true, false),
            esc_html__('ปิดการตรวจสอบใบรับรอง SSL สำหรับคำขอ API', '7ls-video-publisher')
        );

        echo '<p class="description">';
        esc_html_e('ควรใช้เฉพาะในเครื่อง local หรือ staging ที่ใช้ใบรับรองแบบ self-signed เท่านั้น บน production ควรปิดไว้', '7ls-video-publisher');
        echo '</p>';
    }

    /**
     * Render sync interval field
     */
    public static function render_sync_interval_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $value = $settings['sync_interval'] ?? 'hourly';
        
        $intervals = [
            'five_minutes' => __('ทุก 5 นาที', '7ls-video-publisher'),
            'fifteen_minutes' => __('ทุก 15 นาที', '7ls-video-publisher'),
            'hourly' => __('ทุกชั่วโมง', '7ls-video-publisher'),
            'twicedaily' => __('วันละ 2 ครั้ง', '7ls-video-publisher'),
            'daily' => __('ทุกวัน', '7ls-video-publisher'),
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
            'draft' => __('ฉบับร่าง', '7ls-video-publisher'),
            'publish' => __('เผยแพร่', '7ls-video-publisher'),
            'pending' => __('รอตรวจสอบ', '7ls-video-publisher'),
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
            'show_option_none' => __('ผู้ใช้ปัจจุบัน', '7ls-video-publisher'),
            'option_none_value' => 0
        ]);
    }

    public static function render_batch_size_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $value = isset($settings['sync_batch_size']) ? (int) $settings['sync_batch_size'] : 100;

        printf(
            '<input type="number" name="sevenls_vp_settings[sync_batch_size]" value="%1$d" class="small-text" min="10" max="250" step="10" />',
            max(10, min(250, $value))
        );

        echo '<p class="description">';
        esc_html_e('กำหนดจำนวนวิดีโอที่ประมวลผลต่อหนึ่งแบตช์ ยิ่งมากยิ่งเร็ว แต่จะใช้หน่วยความจำของเซิร์ฟเวอร์ต่อ request มากขึ้น', '7ls-video-publisher');
        echo '</p>';
    }

    public static function render_download_featured_images_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $enabled = !empty($settings['download_featured_images']);

        printf(
            '<label><input type="checkbox" name="sevenls_vp_settings[download_featured_images]" value="1" %1$s /> %2$s</label>',
            checked($enabled, true, false),
            esc_html__('ดาวน์โหลดรูปภาพปกเข้า Media Library และตั้งเป็นรูปภาพเด่น', '7ls-video-publisher')
        );

        echo '<p class="description">';
        esc_html_e('แนะนำให้ปิดไว้หากต้องการซิงก์เร็วที่สุด ปลั๊กอินยังสามารถแสดงรูปภาพจาก URL ต้นทางได้ แม้จะไม่ได้ดาวน์โหลดมาเป็นรูปภาพเด่น', '7ls-video-publisher');
        echo '</p>';
    }

    public static function render_save_raw_payload_field(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $enabled = !empty($settings['save_raw_payload']);

        printf(
            '<label><input type="checkbox" name="sevenls_vp_settings[save_raw_payload]" value="1" %1$s /> %2$s</label>',
            checked($enabled, true, false),
            esc_html__('บันทึกข้อมูลตอบกลับดิบจาก API ไว้ใน post meta เพื่อใช้ debug', '7ls-video-publisher')
        );

        echo '<p class="description">';
        esc_html_e('แนะนำให้ปิดไว้เพื่อให้ซิงก์ได้เร็วขึ้นและลดขนาดฐานข้อมูล เปิดเฉพาะเวลาที่ต้องตรวจสอบความแตกต่างของ payload', '7ls-video-publisher');
        echo '</p>';
    }
}

// Initialize settings
add_action('admin_init', ['SevenLS_VP_Settings', 'register']);
