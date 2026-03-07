<?php
namespace SevenLS_VP;

/**
 * Post Type Registration
 * 
 * Registers custom post type and taxonomy
 */
class Post_Type {
    
    /**
     * Register custom post type and taxonomy
     */
    public static function register(): void {
        if (!Site_Profile::should_register_video_cpt()) {
            return;
        }

        self::register_post_type();
        self::register_taxonomy();
    }
    
    /**
     * Register video custom post type
     */
    private static function register_post_type(): void {
        $labels = [
            'name' => __('Videos', '7ls-video-publisher'),
            'singular_name' => __('Video', '7ls-video-publisher'),
            'menu_name' => __('Videos', '7ls-video-publisher'),
            'add_new' => __('Add New', '7ls-video-publisher'),
            'add_new_item' => __('Add New Video', '7ls-video-publisher'),
            'edit_item' => __('Edit Video', '7ls-video-publisher'),
            'new_item' => __('New Video', '7ls-video-publisher'),
            'view_item' => __('View Video', '7ls-video-publisher'),
            'search_items' => __('Search Videos', '7ls-video-publisher'),
            'not_found' => __('No videos found', '7ls-video-publisher'),
            'not_found_in_trash' => __('No videos found in trash', '7ls-video-publisher'),
        ];
        
        $args = [
            'labels' => $labels,
            'public' => true,
            'has_archive' => true,
            'publicly_queryable' => true,
            'show_ui' => true,
            'show_in_menu' => true,
            'show_in_rest' => true,
            'menu_icon' => 'dashicons-video-alt3',
            'supports' => ['title', 'editor', 'excerpt', 'thumbnail', 'custom-fields'],
            'rewrite' => ['slug' => 'videos'],
            'capability_type' => 'post',
        ];
        
        register_post_type('video', $args);
    }
    
    /**
     * Register video taxonomies
     */
    private static function register_taxonomy(): void {
        self::register_category_taxonomy();
        self::register_tag_taxonomy();
        self::register_actor_taxonomy();
    }

    /**
     * Register video_category taxonomy
     */
    private static function register_category_taxonomy(): void {
        $labels = [
            'name' => __('Video Categories', '7ls-video-publisher'),
            'singular_name' => __('Video Category', '7ls-video-publisher'),
            'search_items' => __('Search Categories', '7ls-video-publisher'),
            'all_items' => __('All Categories', '7ls-video-publisher'),
            'parent_item' => __('Parent Category', '7ls-video-publisher'),
            'parent_item_colon' => __('Parent Category:', '7ls-video-publisher'),
            'edit_item' => __('Edit Category', '7ls-video-publisher'),
            'update_item' => __('Update Category', '7ls-video-publisher'),
            'add_new_item' => __('Add New Category', '7ls-video-publisher'),
            'new_item_name' => __('New Category Name', '7ls-video-publisher'),
            'menu_name' => __('Categories', '7ls-video-publisher'),
        ];

        $args = [
            'labels' => $labels,
            'hierarchical' => true,
            'public' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'show_admin_column' => true,
            'rewrite' => ['slug' => 'video-category'],
        ];

        register_taxonomy('video_category', 'video', $args);
    }

    /**
     * Register video_tag taxonomy
     */
    private static function register_tag_taxonomy(): void {
        $labels = [
            'name' => __('Video Tags', '7ls-video-publisher'),
            'singular_name' => __('Video Tag', '7ls-video-publisher'),
            'search_items' => __('Search Tags', '7ls-video-publisher'),
            'all_items' => __('All Tags', '7ls-video-publisher'),
            'edit_item' => __('Edit Tag', '7ls-video-publisher'),
            'update_item' => __('Update Tag', '7ls-video-publisher'),
            'add_new_item' => __('Add New Tag', '7ls-video-publisher'),
            'new_item_name' => __('New Tag Name', '7ls-video-publisher'),
            'menu_name' => __('Tags', '7ls-video-publisher'),
        ];
        
        $args = [
            'labels' => $labels,
            'hierarchical' => false,
            'public' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'show_admin_column' => true,
            'rewrite' => ['slug' => 'video-tag'],
        ];
        
        register_taxonomy('video_tag', 'video', $args);
    }

    /**
     * Register video_actor taxonomy
     */
    private static function register_actor_taxonomy(): void {
        $labels = [
            'name' => __('Actors', '7ls-video-publisher'),
            'singular_name' => __('Actor', '7ls-video-publisher'),
            'search_items' => __('Search Actors', '7ls-video-publisher'),
            'all_items' => __('All Actors', '7ls-video-publisher'),
            'parent_item' => __('Parent Actor', '7ls-video-publisher'),
            'parent_item_colon' => __('Parent Actor:', '7ls-video-publisher'),
            'edit_item' => __('Edit Actor', '7ls-video-publisher'),
            'update_item' => __('Update Actor', '7ls-video-publisher'),
            'add_new_item' => __('Add New Actor', '7ls-video-publisher'),
            'new_item_name' => __('New Actor Name', '7ls-video-publisher'),
            'menu_name' => __('Actors', '7ls-video-publisher'),
        ];

        $args = [
            'labels' => $labels,
            'hierarchical' => true,
            'public' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'show_admin_column' => true,
            'rewrite' => ['slug' => 'video-actor'],
        ];

        register_taxonomy('video_actor', 'video', $args);

        self::ensure_actor_root_term();
    }

    private static function ensure_actor_root_term(): void {
        $slug = 'actors';
        $name = 'นักแสดง';

        $existing = term_exists($slug, 'video_actor');
        if (!$existing) {
            $existing = term_exists($name, 'video_actor');
        }

        if ($existing) {
            return;
        }

        wp_insert_term($name, 'video_actor', [
            'slug' => $slug,
        ]);
    }
}
