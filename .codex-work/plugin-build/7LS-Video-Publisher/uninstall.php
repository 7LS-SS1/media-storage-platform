<?php
/**
 * Uninstall script
 * Fires when the plugin is uninstalled
 */

// Exit if not called from WordPress.
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

// Delete options.
delete_option('sevenls_vp_settings');
delete_option('sevenls_vp_last_sync');
delete_option('sevenls_vp_logs');

// Clear scheduled cron.
wp_clear_scheduled_hook('sevenls_vp_scheduled_sync');

// Optional: Delete all video posts and their meta.
// Uncomment if you want to remove all content on uninstall.
/*
$video_posts = get_posts([
    'post_type' => 'video',
    'numberposts' => -1,
    'post_status' => 'any',
]);

foreach ($video_posts as $post) {
    wp_delete_post($post->ID, true);
}
*/

// Optional: Delete custom taxonomy terms.
// Uncomment if you want to remove taxonomy data.
/*
$taxonomies = ['video_tag', 'video_category', 'video_actor'];

foreach ($taxonomies as $taxonomy) {
    $terms = get_terms([
        'taxonomy' => $taxonomy,
        'hide_empty' => false,
    ]);

    foreach ($terms as $term) {
        wp_delete_term($term->term_id, $taxonomy);
    }
}
*/
