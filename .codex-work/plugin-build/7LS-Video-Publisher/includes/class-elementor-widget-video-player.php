<?php
namespace SevenLS_VP;

use Elementor\Controls_Manager;
use Elementor\Widget_Base;

/**
 * Elementor widget: Video Player.
 */
class Elementor_Widget_Video_Player extends Widget_Base {

    public function get_name(): string {
        return 'sevenls-vp-video-player';
    }

    public function get_title(): string {
        return __('7LS Video Player', '7ls-video-publisher');
    }

    public function get_icon(): string {
        return 'eicon-play';
    }

    public function get_categories(): array {
        return ['sevenls-vp'];
    }

    public function get_keywords(): array {
        return ['video', 'player', 'sevenls', '7ls'];
    }

    protected function register_controls(): void {
        $this->start_controls_section('section_source', [
            'label' => __('Source', '7ls-video-publisher')
        ]);

        $this->add_control('source', [
            'label' => __('Source', '7ls-video-publisher'),
            'type' => Controls_Manager::SELECT,
            'options' => [
                'current' => __('Current Video', '7ls-video-publisher'),
                'post_id' => __('Post ID', '7ls-video-publisher'),
                'external_id' => __('External ID', '7ls-video-publisher')
            ],
            'default' => 'current'
        ]);

        $this->add_control('post_id', [
            'label' => __('Video Post ID', '7ls-video-publisher'),
            'type' => Controls_Manager::NUMBER,
            'min' => 1,
            'condition' => [
                'source' => 'post_id'
            ]
        ]);

        $this->add_control('external_id', [
            'label' => __('External Video ID', '7ls-video-publisher'),
            'type' => Controls_Manager::TEXT,
            'condition' => [
                'source' => 'external_id'
            ]
        ]);

        $this->end_controls_section();

        $this->start_controls_section('section_presentation', [
            'label' => __('Presentation', '7ls-video-publisher')
        ]);

        $this->add_control('height', [
            'label' => __('Height', '7ls-video-publisher'),
            'type' => Controls_Manager::TEXT,
            'placeholder' => 'auto, 360px, 60vh'
        ]);

        $this->add_control('min_height', [
            'label' => __('Min Height', '7ls-video-publisher'),
            'type' => Controls_Manager::TEXT,
            'placeholder' => '240px'
        ]);

        $this->add_control('max_height', [
            'label' => __('Max Height', '7ls-video-publisher'),
            'type' => Controls_Manager::TEXT,
            'placeholder' => '720px'
        ]);

        $this->add_control('aspect', [
            'label' => __('Aspect Ratio', '7ls-video-publisher'),
            'type' => Controls_Manager::TEXT,
            'placeholder' => '16/9'
        ]);

        $this->add_control('fit', [
            'label' => __('Object Fit', '7ls-video-publisher'),
            'type' => Controls_Manager::SELECT,
            'options' => [
                '' => __('Default', '7ls-video-publisher'),
                'contain' => __('Contain', '7ls-video-publisher'),
                'cover' => __('Cover', '7ls-video-publisher'),
                'fill' => __('Fill', '7ls-video-publisher'),
                'none' => __('None', '7ls-video-publisher'),
                'scale-down' => __('Scale Down', '7ls-video-publisher')
            ],
            'default' => ''
        ]);

        $this->add_control('radius', [
            'label' => __('Border Radius', '7ls-video-publisher'),
            'type' => Controls_Manager::TEXT,
            'placeholder' => '12px'
        ]);

        $this->add_control('shadow', [
            'label' => __('Shadow', '7ls-video-publisher'),
            'type' => Controls_Manager::SELECT,
            'options' => [
                '' => __('Default', '7ls-video-publisher'),
                'soft' => __('Soft', '7ls-video-publisher'),
                'strong' => __('Strong', '7ls-video-publisher'),
                'none' => __('None', '7ls-video-publisher')
            ],
            'default' => ''
        ]);

        $this->add_control('extra_class', [
            'label' => __('Extra CSS Class', '7ls-video-publisher'),
            'type' => Controls_Manager::TEXT
        ]);

        $this->end_controls_section();
    }

    protected function render(): void {
        $settings = $this->get_settings_for_display();

        $atts = [
            'height' => $settings['height'] ?? '',
            'min_height' => $settings['min_height'] ?? '',
            'max_height' => $settings['max_height'] ?? '',
            'aspect' => $settings['aspect'] ?? '',
            'fit' => $settings['fit'] ?? '',
            'radius' => $settings['radius'] ?? '',
            'shadow' => $settings['shadow'] ?? '',
            'class' => $settings['extra_class'] ?? ''
        ];

        $presentation = Shortcodes::build_player_presentation($atts);
        $output = '';

        switch ($settings['source'] ?? 'current') {
            case 'post_id':
                $output = Shortcodes::render_player_by_post_id((int) ($settings['post_id'] ?? 0), $presentation);
                break;
            case 'external_id':
                $output = Shortcodes::render_player_by_external_id((string) ($settings['external_id'] ?? ''), $presentation);
                break;
            case 'current':
            default:
                $output = Shortcodes::render_player_by_post_id(0, $presentation);
                break;
        }

        echo $output;
    }
}
