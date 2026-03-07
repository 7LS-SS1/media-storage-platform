<?php
/**
 * Single Video Template
 *
 * Can be overridden by copying to your theme: single-video.php
 */

if (!defined('ABSPATH')) {
    exit;
}

wp_enqueue_style(
    'sevenls-vp-single-video',
    SEVENLS_VP_PLUGIN_URL . 'assets/single-video.css',
    [],
    SEVENLS_VP_VERSION
);

get_header();

while (have_posts()) :
    the_post();

    $post_id = get_the_ID();
    $categories = get_the_terms($post_id, 'video_category');
    $tags = get_the_terms($post_id, 'video_tag');
    $actors = get_the_terms($post_id, 'video_actor');
    $external_id = get_post_meta($post_id, '_sevenls_vp_external_id', true);
    $thumbnail_url = get_post_meta($post_id, '_sevenls_vp_thumbnail_url', true);
    $published = get_the_date(get_option('date_format'), $post_id);
    $description = apply_filters('the_content', get_the_content());

    wp_enqueue_script(
        'sevenls-vp-video-like',
        SEVENLS_VP_PLUGIN_URL . 'assets/video-like.js',
        [],
        SEVENLS_VP_VERSION,
        true
    );

    wp_localize_script('sevenls-vp-video-like', 'SevenLSVP_Likes', [
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('sevenls-vp-like-video'),
        'postId' => $post_id
    ]);

    $related_args = [
        'post_type' => 'video',
        'post_status' => 'publish',
        'posts_per_page' => 6,
        'post__not_in' => [$post_id],
        'orderby' => 'date',
        'order' => 'DESC',
        'no_found_rows' => true
    ];

    if (!empty($tags) && !is_wp_error($tags)) {
        $related_args['tax_query'] = [
            [
                'taxonomy' => 'video_tag',
                'field' => 'term_id',
                'terms' => wp_list_pluck($tags, 'term_id')
            ]
        ];
    }

    $related_query = new WP_Query($related_args);
    ?>

    <div class="sevenls-vp-page">
        <header class="sevenls-vp-hero">
            <div class="sevenls-vp-hero-title">
                <h1 class="sevenls-vp-title"><?php the_title(); ?></h1>
                <div class="sevenls-vp-meta">
                    <?php if ($published) : ?>
                        <span class="sevenls-vp-meta-item"><?php echo esc_html($published); ?></span>
                    <?php endif; ?>
                    <?php if ($external_id) : ?>
                        <span class="sevenls-vp-meta-item"><?php echo esc_html($external_id); ?></span>
                    <?php endif; ?>
                </div>
            </div>
            <div class="sevenls-vp-hero-actions">
                <button class="sevenls-vp-action-btn" type="button"><?php esc_html_e('Save', '7ls-video-publisher'); ?></button>
                <button class="sevenls-vp-action-btn is-primary" type="button"><?php esc_html_e('Share', '7ls-video-publisher'); ?></button>
            </div>
        </header>

        <div class="sevenls-vp-layout">
            <main class="sevenls-vp-main">
                <section id="sevenls-main-player" class="sevenls-vp-player-card">
                    <div class="sevenls-vp-player-embed">
                        <?php
                        echo do_shortcode(
                            '[sevenls_video_post id="' . $post_id . '" height="70vh" min_height="420px" max_height="720px" fit="contain" radius="14px" shadow="strong"]'
                        );
                        ?>
                    </div>
                </section>

                <section class="sevenls-vp-panel">
                    <h2 class="sevenls-vp-section-title"><?php esc_html_e('About this video', '7ls-video-publisher'); ?></h2>
                    <div class="sevenls-vp-description">
                        <?php echo $description ? wp_kses_post($description) : esc_html__('No description provided.', '7ls-video-publisher'); ?>
                    </div>

                    <?php if (!empty($categories) && !is_wp_error($categories)) : ?>
                        <div class="sevenls-vp-tags sevenls-vp-categories">
                            <?php foreach ($categories as $category) : ?>
                                <a class="sevenls-vp-tag" href="<?php echo esc_url(get_term_link($category)); ?>">
                                    <?php echo esc_html($category->name); ?>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($tags) && !is_wp_error($tags)) : ?>
                        <div class="sevenls-vp-tags">
                            <?php foreach ($tags as $tag) : ?>
                                <a class="sevenls-vp-tag" href="<?php echo esc_url(get_term_link($tag)); ?>">
                                    <?php echo esc_html($tag->name); ?>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                    <?php if (!empty($actors) && !is_wp_error($actors)) : ?>
                        <div class="sevenls-vp-tags sevenls-vp-actors">
                            <?php foreach ($actors as $actor) : ?>
                                <a class="sevenls-vp-tag" href="<?php echo esc_url(get_term_link($actor)); ?>">
                                    <?php echo esc_html($actor->name); ?>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
            </main>

            <aside class="sevenls-vp-sidebar">
                <section class="sevenls-vp-panel">
                    <div class="sevenls-vp-panel-header">
                        <h2 class="sevenls-vp-section-title"><?php esc_html_e('More like this', '7ls-video-publisher'); ?></h2>
                    </div>

                    <?php if ($related_query->have_posts()) : ?>
                        <div class="sevenls-vp-related-list">
                            <?php while ($related_query->have_posts()) : $related_query->the_post(); ?>
                                <?php
                                $thumb = get_the_post_thumbnail_url(get_the_ID(), 'medium');
                                if (!$thumb) {
                                    $thumb = get_post_meta(get_the_ID(), '_sevenls_vp_thumbnail_url', true);
                                }
                                ?>
                                <a class="sevenls-vp-related-card" href="<?php the_permalink(); ?>">
                                    <div class="sevenls-vp-related-thumb" style="background-image: url('<?php echo esc_url($thumb ?: $thumbnail_url); ?>');"></div>
                                    <div class="sevenls-vp-related-info">
                                        <div class="sevenls-vp-related-title"><?php the_title(); ?></div>
                                        <div class="sevenls-vp-related-meta"><?php echo esc_html(get_the_date(get_option('date_format'))); ?></div>
                                    </div>
                                </a>
                            <?php endwhile; ?>
                        </div>
                    <?php else : ?>
                        <p class="sevenls-vp-muted"><?php esc_html_e('No related videos yet.', '7ls-video-publisher'); ?></p>
                    <?php endif; ?>
                    <?php wp_reset_postdata(); ?>
                </section>
            </aside>
        </div>
    </div>
<?php endwhile; ?>

<?php
get_footer();
