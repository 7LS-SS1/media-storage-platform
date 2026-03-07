<?php
namespace SevenLS_VP;

/**
 * Site Profile Helper
 *
 * Centralizes site-level compatibility behavior so RetroTube support
 * stays opt-in and the default 7LS flow remains unchanged.
 */
class Site_Profile {

    /**
     * Determine whether RetroTube compatibility is enabled.
     */
    public static function is_retrotube_enabled(): bool {
        $settings = get_option('sevenls_vp_settings', []);
        return !empty($settings['enable_retrotube_theme']);
    }

    /**
     * Human-readable label for the current compatibility profile.
     */
    public static function get_label(): string {
        return self::is_retrotube_enabled()
            ? __('RetroTube Compatibility', '7ls-video-publisher')
            : __('Standard 7LS Theme', '7ls-video-publisher');
    }

    /**
     * WordPress post type used for imported videos on this site.
     */
    public static function get_import_post_type(): string {
        return self::is_retrotube_enabled() ? 'post' : 'video';
    }

    /**
     * Taxonomy configuration for imported videos on this site.
     *
     * @return array{
     *   category_taxonomy: string,
     *   tag_taxonomy: string,
     *   actor_taxonomy: string,
     *   actor_parent_term: string,
     *   actor_hierarchical: bool
     * }
     */
    public static function get_taxonomy_config(): array {
        if (self::is_retrotube_enabled()) {
            return [
                'category_taxonomy' => 'category',
                'tag_taxonomy' => 'post_tag',
                'actor_taxonomy' => 'actors',
                'actor_parent_term' => '',
                'actor_hierarchical' => false,
            ];
        }

        return [
            'category_taxonomy' => 'video_category',
            'tag_taxonomy' => 'video_tag',
            'actor_taxonomy' => 'video_actor',
            'actor_parent_term' => 'นักแสดง',
            'actor_hierarchical' => true,
        ];
    }

    /**
     * RetroTube sites should use the theme templates, not the plugin video template.
     */
    public static function should_use_plugin_video_template(): bool {
        return !self::is_retrotube_enabled();
    }

    /**
     * Register the plugin video CPT/taxonomies only for the standard profile.
     */
    public static function should_register_video_cpt(): bool {
        return !self::is_retrotube_enabled();
    }

    /**
     * Featured-image sideloading is only needed for the standard profile.
     */
    public static function should_sideload_featured_image(): bool {
        return !self::is_retrotube_enabled();
    }

    /**
     * Fallback archive URL for redirect helpers.
     */
    public static function get_archive_url(): string {
        $post_type = self::get_import_post_type();
        if ($post_type !== 'post') {
            return (string) get_post_type_archive_link($post_type);
        }

        $posts_page_id = (int) get_option('page_for_posts');
        if ($posts_page_id > 0) {
            $url = get_permalink($posts_page_id);
            if (is_string($url)) {
                return $url;
            }
        }

        return home_url('/');
    }
}
