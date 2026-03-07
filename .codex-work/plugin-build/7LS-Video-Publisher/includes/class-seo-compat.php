<?php
namespace SevenLS_VP;

/**
 * SEO compatibility for video post type.
 */
class SEO_Compat {
    /**
     * Register SEO plugin hooks.
     */
    public static function register(): void {
        add_filter('wpseo_accessible_post_types', [__CLASS__, 'add_video_post_type']);
        add_filter('wpseo_sitemap_post_types', [__CLASS__, 'add_video_post_type']);

        add_filter('rank_math/post_types', [__CLASS__, 'add_video_post_type']);
        add_filter('rank_math/metabox/post_types', [__CLASS__, 'add_video_post_type']);
        add_filter('rank_math/sitemap/post_types', [__CLASS__, 'add_video_post_type']);
        add_filter('rank_math/excluded_post_types', [__CLASS__, 'remove_video_from_excluded']);
    }

    /**
     * Ensure video post type is included.
     *
     * @param array $post_types
     * @return array
     */
    public static function add_video_post_type($post_types): array {
        if (!is_array($post_types)) {
            $post_types = [];
        }

        if (!in_array('video', $post_types, true)) {
            $post_types[] = 'video';
        }

        return $post_types;
    }

    /**
     * Ensure video post type is not excluded.
     *
     * @param array $post_types
     * @return array
     */
    public static function remove_video_from_excluded($post_types): array {
        if (!is_array($post_types) || empty($post_types)) {
            return is_array($post_types) ? $post_types : [];
        }

        return array_values(array_diff($post_types, ['video']));
    }
}
