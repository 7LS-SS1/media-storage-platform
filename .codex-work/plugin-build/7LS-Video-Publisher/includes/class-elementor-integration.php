<?php
namespace SevenLS_VP;

/**
 * Elementor integration for 7LS Video Publisher.
 */
class Elementor_Integration {

    /**
     * Constructor.
     */
    public function __construct() {
        add_action('elementor/init', [$this, 'on_elementor_init']);
        add_action('init', [$this, 'add_elementor_support'], 20);
        add_filter('elementor_pro/utils/get_public_post_types', [$this, 'add_video_post_type']);
    }

    /**
     * Register Elementor hooks once Elementor is loaded.
     */
    public function on_elementor_init(): void {
        add_action('elementor/widgets/register', [$this, 'register_widgets']);
        add_action('elementor/elements/categories_registered', [$this, 'register_category']);
    }

    /**
     * Enable Elementor editor support for the video post type.
     */
    public function add_elementor_support(): void {
        if (!post_type_exists('video')) {
            return;
        }

        if (!post_type_supports('video', 'elementor')) {
            add_post_type_support('video', 'elementor');
        }
    }

    /**
     * Ensure Elementor Pro includes the video post type in Theme Builder.
     *
     * @param array $post_types Post types
     * @return array
     */
    public function add_video_post_type(array $post_types): array {
        if (!in_array('video', $post_types, true)) {
            $post_types[] = 'video';
        }

        return $post_types;
    }

    /**
     * Register a custom Elementor category.
     *
     * @param \Elementor\Elements_Manager $elements_manager Elements manager
     */
    public function register_category($elements_manager): void {
        $elements_manager->add_category('sevenls-vp', [
            'title' => __('7LS Video Publisher', '7ls-video-publisher'),
            'icon' => 'fa fa-play'
        ]);
    }

    /**
     * Register Elementor widgets.
     *
     * @param \Elementor\Widgets_Manager $widgets_manager Widgets manager
     */
    public function register_widgets($widgets_manager): void {
        require_once SEVENLS_VP_PLUGIN_DIR . 'includes/class-elementor-widget-video-player.php';

        $widget = new Elementor_Widget_Video_Player();
        if (method_exists($widgets_manager, 'register')) {
            $widgets_manager->register($widget);
        } else {
            $widgets_manager->register_widget_type($widget);
        }
    }
}
