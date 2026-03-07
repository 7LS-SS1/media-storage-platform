<?php
namespace SevenLS_VP;

/**
 * Shortcodes Class
 * 
 * Handles shortcode registration and rendering
 */
class Shortcodes {
    
    /**
     * Register shortcodes
     */
    public static function register(): void {
        add_shortcode('sevenls_video', [__CLASS__, 'render_video_by_external_id']);
        add_shortcode('sevenls_video_post', [__CLASS__, 'render_video_by_post_id']);
    }

    /**
     * Normalize shortcode attributes for player rendering.
     *
     * @param array $atts Shortcode attributes
     * @return array
     */
    private static function normalize_shortcode_atts(array $atts): array {
        return shortcode_atts([
            'id' => '',
            'height' => '',
            'min_height' => '',
            'max_height' => '',
            'aspect' => '',
            'fit' => '',
            'radius' => '',
            'shadow' => '',
            'class' => ''
        ], $atts);
    }
    
    /**
     * Render video by external ID
     * 
     * Usage: [sevenls_video id="12345"]
     */
    public static function render_video_by_external_id(array $atts): string {
        $atts = self::normalize_shortcode_atts($atts);
        
        if (empty($atts['id'])) {
            return '<div class="sevenls-video-message">' . esc_html__('Video ID is required', '7ls-video-publisher') . '</div>';
        }
        
        // Find post by external ID
        $args = [
            'post_type' => Site_Profile::get_import_post_type(),
            'post_status' => 'publish',
            'posts_per_page' => 1,
            'meta_query' => [
                [
                    'key' => '_sevenls_vp_external_id',
                    'value' => sanitize_text_field($atts['id']),
                    'compare' => '='
                ]
            ]
        ];
        
        $query = new \WP_Query($args);
        
        if (!$query->have_posts()) {
            return '<div class="sevenls-video-message">' . esc_html__('Video not found', '7ls-video-publisher') . '</div>';
        }
        
        $post = $query->posts[0];
        $presentation = self::build_player_presentation($atts);

        return self::render_video($post->ID, $presentation);
    }
    
    /**
     * Render video by post ID
     * 
     * Usage: [sevenls_video_post id="123"]
     */
    public static function render_video_by_post_id(array $atts): string {
        $atts = self::normalize_shortcode_atts($atts);
        
        $post_id = absint($atts['id']);
        if (!$post_id) {
            $post_id = (int) get_queried_object_id();
        }
        if (!$post_id) {
            $post_id = (int) get_the_ID();
        }
        if (!$post_id) {
            return '<div class="sevenls-video-message">' . esc_html__('Post ID is required', '7ls-video-publisher') . '</div>';
        }

        $post = get_post($post_id);
        
        if (!$post || $post->post_type !== Site_Profile::get_import_post_type()) {
            return '<div class="sevenls-video-message">' . esc_html__('Video not found', '7ls-video-publisher') . '</div>';
        }

        $presentation = self::build_player_presentation($atts);

        return self::render_video($post_id, $presentation);
    }

    /**
     * Render only the video player by post ID.
     *
     * @param int $post_id Post ID
     * @param array $presentation Player presentation styles
     * @return string
     */
    public static function render_player_by_post_id(int $post_id, array $presentation = []): string {
        if (!$post_id) {
            $post_id = (int) get_queried_object_id();
        }
        if (!$post_id) {
            $post_id = (int) get_the_ID();
        }
        if (!$post_id) {
            return '<div class="sevenls-video-message">' . esc_html__('Post ID is required', '7ls-video-publisher') . '</div>';
        }

        $post = get_post($post_id);
        if (!$post || $post->post_type !== Site_Profile::get_import_post_type()) {
            return '<div class="sevenls-video-message">' . esc_html__('Video not found', '7ls-video-publisher') . '</div>';
        }

        $video_url = get_post_meta($post_id, '_sevenls_vp_video_url', true);
        $playback_url = self::get_playback_url($post_id);
        $thumbnail_url = get_post_meta($post_id, '_sevenls_vp_thumbnail_url', true);
        $title = get_the_title($post_id);

        self::enqueue_assets();

        $refreshed = self::maybe_refresh_video_source($post_id, $video_url, $thumbnail_url);
        $video_url = $refreshed['video_url'];
        $thumbnail_url = $refreshed['thumbnail_url'];
        if ($playback_url !== '') {
            $video_url = $playback_url;
        }

        $player = self::render_video_player($video_url, $thumbnail_url, $title);
        $player_class = 'sevenls-video-player';
        if (!empty($presentation['class'])) {
            $player_class .= ' ' . $presentation['class'];
        }
        $player_style = !empty($presentation['style']) ? ' style="' . esc_attr($presentation['style']) . '"' : '';

        return sprintf(
            '<div class="%1$s"%2$s>%3$s</div>',
            esc_attr($player_class),
            $player_style,
            $player
        );
    }

    /**
     * Render only the video player by external ID.
     *
     * @param string $external_id External video ID
     * @param array $presentation Player presentation styles
     * @return string
     */
    public static function render_player_by_external_id(string $external_id, array $presentation = []): string {
        $external_id = sanitize_text_field($external_id);
        if ($external_id === '') {
            return '<div class="sevenls-video-message">' . esc_html__('Video ID is required', '7ls-video-publisher') . '</div>';
        }

        $post_id = self::find_post_id_by_external_id($external_id);
        if (!$post_id) {
            return '<div class="sevenls-video-message">' . esc_html__('Video not found', '7ls-video-publisher') . '</div>';
        }

        return self::render_player_by_post_id($post_id, $presentation);
    }
    
    /**
     * Render video HTML
     * 
     * @param int $post_id Post ID
     * @return string HTML output
     */
    private static function render_video(int $post_id, array $presentation = []): string {
        $video_url = get_post_meta($post_id, '_sevenls_vp_video_url', true);
        $playback_url = self::get_playback_url($post_id);
        $thumbnail_url = get_post_meta($post_id, '_sevenls_vp_thumbnail_url', true);
        $duration = get_post_meta($post_id, '_sevenls_vp_duration', true);
        $title = get_the_title($post_id);
        $description = get_post_field('post_content', $post_id);

        self::enqueue_assets();

        $refreshed = self::maybe_refresh_video_source($post_id, $video_url, $thumbnail_url);
        $video_url = $refreshed['video_url'];
        $thumbnail_url = $refreshed['thumbnail_url'];
        if ($playback_url !== '') {
            $video_url = $playback_url;
        }

        // Get terms
        $tax_config = Site_Profile::get_taxonomy_config();
        $categories = get_the_terms($post_id, $tax_config['category_taxonomy']);
        $tags = get_the_terms($post_id, $tax_config['tag_taxonomy']);
        $actors = get_the_terms($post_id, $tax_config['actor_taxonomy']);
        
        ob_start();
        $player = self::render_video_player($video_url, $thumbnail_url, $title);
        $duration_text = $duration ? self::format_duration((int) $duration) : '';
        $description = $description ? apply_filters('the_content', $description) : '';
        $category_links = self::build_term_links($categories, 'sevenls-video-tag sevenls-video-category');
        $tag_links = self::build_term_links($tags, 'sevenls-video-tag');
        $actor_links = self::build_term_links($actors, 'sevenls-video-tag sevenls-video-actor');

        $player_class = 'sevenls-video-player';
        if (!empty($presentation['class'])) {
            $player_class .= ' ' . $presentation['class'];
        }
        $player_style = !empty($presentation['style']) ? ' style="' . esc_attr($presentation['style']) . '"' : '';
        ?>
        <div class="sevenls-video-container">
            <div class="<?php echo esc_attr($player_class); ?>"<?php echo $player_style; ?>>
                <?php echo $player; ?>
            </div>
            <?php if ($duration_text) : ?>
                <div class="sevenls-video-duration"><?php echo esc_html($duration_text); ?></div>
            <?php endif; ?>
            
        </div>
        <?php
        
        return ob_get_clean();
    }

    private static function build_term_links($terms, string $class): array {
        $links = [];

        if (!empty($terms) && !is_wp_error($terms)) {
            foreach ($terms as $term) {
                $link = get_term_link($term);
                if (!is_wp_error($link)) {
                    $links[] = sprintf(
                        '<a class="%1$s" href="%2$s">%3$s</a>',
                        esc_attr($class),
                        esc_url($link),
                        esc_html($term->name)
                    );
                }
            }
        }

        return $links;
    }

    /**
     * Enqueue frontend assets for the video player
     */
    private static function enqueue_assets(): void {
        static $enqueued = false;

        if ($enqueued) {
            return;
        }

        $enqueued = true;

        wp_enqueue_style(
            'sevenls-vp-video-player',
            SEVENLS_VP_PLUGIN_URL . 'assets/video-player.css',
            [],
            SEVENLS_VP_VERSION
        );

        wp_enqueue_script(
            'sevenls-vp-hls',
            'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js',
            [],
            '1.5.8',
            true
        );

        wp_enqueue_script(
            'sevenls-vp-video-player',
            SEVENLS_VP_PLUGIN_URL . 'assets/video-player.js',
            ['sevenls-vp-hls'],
            SEVENLS_VP_VERSION,
            true
        );
    }

    private static function maybe_refresh_video_source(int $post_id, string $video_url, string $thumbnail_url): array {
        $external_id = get_post_meta($post_id, '_sevenls_vp_external_id', true);
        if (empty($external_id)) {
            return [
                'video_url' => $video_url,
                'thumbnail_url' => $thumbnail_url
            ];
        }

        $should_refresh = empty($video_url) || self::is_signed_url_expired($video_url);
        if (!$should_refresh) {
            return [
                'video_url' => $video_url,
                'thumbnail_url' => $thumbnail_url
            ];
        }

        $lock_key = 'sevenls_vp_refresh_' . $post_id;
        if (get_transient($lock_key)) {
            return [
                'video_url' => $video_url,
                'thumbnail_url' => $thumbnail_url
            ];
        }

        set_transient($lock_key, 1, 60);

        $api_client = new API_Client();
        $response = $api_client->fetch_video((string) $external_id);

        if (is_wp_error($response)) {
            return [
                'video_url' => $video_url,
                'thumbnail_url' => $thumbnail_url
            ];
        }

        $normalized = self::normalize_video_payload($response);
        $new_video_url = self::extract_video_url($normalized);
        $new_thumbnail_url = self::extract_thumbnail_url($normalized);

        if (!empty($new_video_url) && $new_video_url !== $video_url) {
            update_post_meta($post_id, '_sevenls_vp_video_url', esc_url_raw($new_video_url));
            $video_url = $new_video_url;
        }

        if (!empty($new_thumbnail_url) && $new_thumbnail_url !== $thumbnail_url) {
            update_post_meta($post_id, '_sevenls_vp_thumbnail_url', esc_url_raw($new_thumbnail_url));
            $thumbnail_url = $new_thumbnail_url;
        }

        return [
            'video_url' => $video_url,
            'thumbnail_url' => $thumbnail_url
        ];
    }

    private static function normalize_video_payload(array $payload): array {
        if (isset($payload['video']) && is_array($payload['video'])) {
            return $payload['video'];
        }

        if (isset($payload['data']) && is_array($payload['data'])) {
            return $payload['data'];
        }

        return $payload;
    }

    private static function extract_video_url(array $payload): string {
        return $payload['playback_url']
            ?? $payload['playbackUrl']
            ?? $payload['video_url']
            ?? $payload['videoUrl']
            ?? $payload['url']
            ?? '';
    }

    private static function extract_playback_url(array $payload): string {
        return $payload['playback_url']
            ?? $payload['playbackUrl']
            ?? '';
    }

    private static function extract_thumbnail_url(array $payload): string {
        return $payload['thumbnail_url']
            ?? $payload['thumbnailUrl']
            ?? $payload['thumbUrl']
            ?? '';
    }

    private static function is_signed_url_expired(string $url): bool {
        $query = parse_url($url, PHP_URL_QUERY);
        if (!$query) {
            return false;
        }

        parse_str($query, $params);
        $params = array_change_key_case($params, CASE_LOWER);
        $date = $params['x-amz-date'] ?? '';
        $expires = isset($params['x-amz-expires']) ? (int) $params['x-amz-expires'] : 0;

        if ($date === '' || $expires <= 0) {
            return false;
        }

        $date = preg_replace('/[^0-9TZ]/', '', $date);
        $dt = \DateTime::createFromFormat('Ymd\THis\Z', $date, new \DateTimeZone('UTC'));
        if (!$dt) {
            return false;
        }

        $expires_at = $dt->getTimestamp() + $expires;

        return time() >= ($expires_at - 60);
    }

    private static function get_playback_url(int $post_id): string {
        $playback_url = get_post_meta($post_id, '_sevenls_vp_playback_url', true);
        if ($playback_url !== '') {
            return $playback_url;
        }

        $raw_payload = get_post_meta($post_id, '_sevenls_vp_raw_payload', true);
        if ($raw_payload === '') {
            return '';
        }

        $payload = json_decode($raw_payload, true);
        if (!is_array($payload)) {
            return '';
        }

        $payload = self::normalize_video_payload($payload);
        $playback_url = self::extract_playback_url($payload);
        if ($playback_url !== '') {
            update_post_meta($post_id, '_sevenls_vp_playback_url', esc_url_raw($playback_url));
        }

        return $playback_url;
    }

    /**
     * Render video player based on URL type
     * 
     * @param string $video_url Video URL
     * @param string $thumbnail_url Thumbnail URL
     * @param string $title Video title
     * @return string HTML output
     */
    private static function render_video_player(string $video_url, string $thumbnail_url, string $title): string {
        if (empty($video_url)) {
            return '<div class="sevenls-video-message">' . esc_html__('No video URL available', '7ls-video-publisher') . '</div>';
        }
        
        // Check if it's a YouTube video
        if (preg_match('/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/', $video_url, $matches)) {
            $video_id = $matches[1];
            return sprintf(
                '<iframe src="https://www.youtube.com/embed/%1$s" title="%2$s" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
                esc_attr($video_id)
                ,
                esc_attr($title)
            );
        }
        
        // Check if it's a Vimeo video
        if (preg_match('/vimeo\.com\/(\d+)/', $video_url, $matches)) {
            $video_id = $matches[1];
            return sprintf(
                '<iframe src="https://player.vimeo.com/video/%1$s" title="%2$s" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>',
                esc_attr($video_id)
                ,
                esc_attr($title)
            );
        }
        
        // Default: HTML5 video player
        $poster_attr = $thumbnail_url ? ' poster="' . esc_url($thumbnail_url) . '"' : '';
        $path = parse_url($video_url, PHP_URL_PATH);
        $extension = $path ? strtolower(pathinfo($path, PATHINFO_EXTENSION)) : '';
        $fallback = esc_html__('Your browser does not support the video tag.', '7ls-video-publisher');
        $video_attrs = sprintf(
            'class="sevenls-video-html5" controls playsinline preload="metadata" controlslist="nodownload noplaybackrate" disablepictureinpicture disableremoteplayback%1$s data-video-url="%2$s"',
            $poster_attr,
            esc_url($video_url)
        );

        if ($extension === 'm3u8') {
            $video_tag = sprintf(
                '<video %1$s data-hls-src="%2$s">%3$s</video>',
                $video_attrs,
                esc_url($video_url),
                $fallback
            );
        } elseif ($extension === 'ts') {
            $video_tag = sprintf(
                '<video %1$s><source src="%2$s" type="video/mp2t">%3$s</video>',
                $video_attrs,
                esc_url($video_url),
                $fallback
            );
        } elseif ($extension === 'mp4') {
            $video_tag = sprintf(
                '<video %1$s><source src="%2$s" type="video/mp4">%3$s</video>',
                $video_attrs,
                esc_url($video_url),
                $fallback
            );
        } else {
            $video_tag = sprintf(
                '<video %1$s src="%2$s">%3$s</video>',
                $video_attrs,
                esc_url($video_url),
                $fallback
            );
        }

        return $video_tag . '<div class="sevenls-video-error" data-video-error></div>';
    }

    /**
     * Build player presentation styles based on shortcode attributes.
     *
     * @param array $atts Shortcode attributes
     * @return array
     */
    public static function build_player_presentation(array $atts): array {
        $styles = [];

        $height = self::sanitize_css_unit($atts['height'] ?? '');
        if ($height !== '') {
            $styles[] = '--sevenls-vp-height:' . $height;
        }

        $min_height = self::sanitize_css_unit($atts['min_height'] ?? '');
        if ($min_height !== '') {
            $styles[] = '--sevenls-vp-min-height:' . $min_height;
        }

        $max_height = self::sanitize_css_unit($atts['max_height'] ?? '');
        if ($max_height !== '') {
            $styles[] = '--sevenls-vp-max-height:' . $max_height;
        }

        $aspect = self::sanitize_aspect_ratio($atts['aspect'] ?? '');
        if ($aspect !== '') {
            $styles[] = '--sevenls-vp-aspect:' . $aspect;
        }

        $fit = self::sanitize_fit($atts['fit'] ?? '');
        if ($fit !== '') {
            $styles[] = '--sevenls-vp-fit:' . $fit;
        }

        $radius = self::sanitize_css_unit($atts['radius'] ?? '');
        if ($radius !== '') {
            $styles[] = '--sevenls-vp-radius:' . $radius;
        }

        $shadow = self::sanitize_shadow($atts['shadow'] ?? '');
        if ($shadow !== '') {
            $styles[] = '--sevenls-vp-shadow:' . $shadow;
        }

        $style = $styles ? implode('; ', $styles) . ';' : '';
        $class = self::sanitize_class_list($atts['class'] ?? '');

        return [
            'style' => $style,
            'class' => $class
        ];
    }

    /**
     * Sanitize CSS unit values.
     *
     * @param string $value Raw value
     * @return string
     */
    private static function sanitize_css_unit(string $value): string {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (is_numeric($value)) {
            return rtrim(rtrim($value, '0'), '.') . 'px';
        }

        if (preg_match('/^\d+(\.\d+)?(px|%|vh|vw|rem|em)$/', $value)) {
            return $value;
        }

        return '';
    }

    /**
     * Sanitize aspect ratio value.
     *
     * @param string $value Raw value
     * @return string
     */
    private static function sanitize_aspect_ratio(string $value): string {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        if (preg_match('/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/', $value)) {
            return preg_replace('/\s+/', '', $value);
        }

        if (preg_match('/^\d+(\.\d+)?$/', $value)) {
            return $value;
        }

        return '';
    }

    /**
     * Sanitize object-fit value.
     *
     * @param string $value Raw value
     * @return string
     */
    private static function sanitize_fit(string $value): string {
        $value = strtolower(trim($value));
        $allowed = ['contain', 'cover', 'fill', 'none', 'scale-down'];

        return in_array($value, $allowed, true) ? $value : '';
    }

    /**
     * Sanitize shadow presets.
     *
     * @param string $value Raw value
     * @return string
     */
    private static function sanitize_shadow(string $value): string {
        $value = strtolower(trim($value));

        if ($value === '') {
            return '';
        }

        if (in_array($value, ['0', 'none', 'false'], true)) {
            return 'none';
        }

        if (in_array($value, ['1', 'true', 'soft', 'default'], true)) {
            return '0 18px 40px rgba(0, 0, 0, 0.35)';
        }

        if ($value === 'strong') {
            return '0 28px 60px rgba(0, 0, 0, 0.45)';
        }

        return '';
    }

    /**
     * Sanitize a space-separated class list.
     *
     * @param string $value Raw value
     * @return string
     */
    private static function sanitize_class_list(string $value): string {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        $classes = preg_split('/\s+/', $value);
        $sanitized = [];

        foreach ($classes as $class) {
            $clean = sanitize_html_class($class);
            if ($clean !== '') {
                $sanitized[] = $clean;
            }
        }

        return implode(' ', $sanitized);
    }

    /**
     * Format duration in seconds to human-readable format
     * 
     * @param int $seconds Duration in seconds
     * @return string Formatted duration
     */
    private static function format_duration(int $seconds): string {
        $hours = floor($seconds / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $seconds = $seconds % 60;
        
        if ($hours > 0) {
            return sprintf('%d:%02d:%02d', $hours, $minutes, $seconds);
        }
        
        return sprintf('%d:%02d', $minutes, $seconds);
    }

    /**
     * Find post ID by external video ID.
     *
     * @param string $external_id External video ID
     * @return int
     */
    private static function find_post_id_by_external_id(string $external_id): int {
        $query = new \WP_Query([
            'post_type' => Site_Profile::get_import_post_type(),
            'post_status' => 'publish',
            'posts_per_page' => 1,
            'meta_query' => [
                [
                    'key' => '_sevenls_vp_external_id',
                    'value' => $external_id,
                    'compare' => '='
                ]
            ]
        ]);

        if (!$query->have_posts()) {
            return 0;
        }

        $post = $query->posts[0] ?? null;
        return $post ? (int) $post->ID : 0;
    }
}
