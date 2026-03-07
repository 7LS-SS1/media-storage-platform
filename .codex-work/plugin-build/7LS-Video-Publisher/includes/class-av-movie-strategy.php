<?php
namespace SevenLS_VP;

/**
 * AV Movie Strategy
 *
 * Handles field mapping, validation and endpoint configuration
 * for the "หนัง AV" content mode.
 */
class AV_Movie_Strategy implements Mode_Strategy {

    public function get_label(): string {
        return 'หนัง AV';
    }

    public function get_mode_key(): string {
        return 'av_movie';
    }

    public function get_videos_endpoint(): string {
        return '/videos';
    }

    public function get_single_video_endpoint(string $video_id): string {
        return '/videos/' . urlencode($video_id);
    }

    public function get_sync_trigger_endpoint(): string {
        return '/api/plugin/videos/sync';
    }

    public function get_default_params(): array {
        return ['type' => 'av_movie'];
    }

    public function map_fields(array $raw): array {
        if (isset($raw['video']) && is_array($raw['video'])) {
            $raw = $raw['video'];
        }

        $playback_url = $raw['playback_url'] ?? $raw['playbackUrl'] ?? '';
        $video_url    = $playback_url ?: ($raw['video_url'] ?? $raw['videoUrl'] ?? $raw['url'] ?? '');

        return [
            'external_id'   => sanitize_text_field($raw['id'] ?? $raw['video_id'] ?? $raw['videoId'] ?? ''),
            'title'          => sanitize_text_field($raw['title'] ?? $raw['name'] ?? 'Untitled Video'),
            'description'    => wp_kses_post($raw['description'] ?? $raw['desc'] ?? ''),
            'video_url'      => esc_url_raw($video_url),
            'playback_url'   => esc_url_raw($playback_url),
            'thumbnail_url'  => esc_url_raw($raw['thumbnail_url'] ?? $raw['thumbnailUrl'] ?? $raw['thumbUrl'] ?? ''),
            'duration'       => absint($raw['duration'] ?? 0),
            'categories'     => $this->normalize_terms($raw['categories'] ?? $raw['category'] ?? $raw['genre'] ?? []),
            'tags'           => $this->normalize_terms($raw['tags'] ?? []),
            'actors'         => $this->normalize_terms(
                $raw['actors'] ?? $raw['actress'] ?? $raw['actor'] ??
                $raw['casts'] ?? $raw['cast'] ?? $raw['performers'] ??
                $raw['starring'] ?? $raw['stars'] ?? $raw['actor_names'] ?? []
            ),
            'extra_meta'     => [
                'code'         => sanitize_text_field($raw['code'] ?? $raw['dvd_id'] ?? $raw['dvdId'] ?? ''),
                'studio'       => sanitize_text_field($raw['studio'] ?? $raw['maker'] ?? $raw['label'] ?? ''),
                'series'       => sanitize_text_field($raw['series'] ?? ''),
                'release_date' => sanitize_text_field($raw['release_date'] ?? $raw['releaseDate'] ?? ''),
            ],
            'created_at'     => sanitize_text_field($raw['created_at'] ?? $raw['createdAt'] ?? ''),
            'updated_at'     => sanitize_text_field($raw['updated_at'] ?? $raw['updatedAt'] ?? ''),
            'raw_payload'    => wp_json_encode($raw),
        ];
    }

    public function validate(array $raw): bool|\WP_Error {
        if (isset($raw['video']) && is_array($raw['video'])) {
            $raw = $raw['video'];
        }

        $id = $raw['id'] ?? $raw['video_id'] ?? $raw['videoId'] ?? null;
        if (empty($id)) {
            return new \WP_Error('missing_id', 'Video ID is required');
        }

        return true;
    }

    public function get_taxonomy_config(): array {
        return [
            'category_taxonomy' => 'video_category',
            'tag_taxonomy'      => 'video_tag',
            'actor_taxonomy'    => 'video_actor',
            'actor_parent_term' => 'นักแสดง',
        ];
    }

    // ─── Term normalisation helpers ─────────────────────────

    private function normalize_terms(mixed $value): array {
        $terms = [];

        if (is_string($value)) {
            $terms = $this->split_terms($value);
        } elseif (is_array($value)) {
            if ($value === []) {
                return [];
            }
            if ($this->is_assoc($value)) {
                $label = $this->extract_label($value);
                if ($label !== '') {
                    $terms = $this->split_terms($label);
                }
            } else {
                foreach ($value as $item) {
                    if (is_string($item)) {
                        $terms = array_merge($terms, $this->split_terms($item));
                    } elseif (is_array($item)) {
                        $label = $this->extract_label($item);
                        if ($label !== '') {
                            $terms = array_merge($terms, $this->split_terms($label));
                        }
                    }
                }
            }
        }

        $terms = array_map('sanitize_text_field', $terms);
        $terms = array_filter($terms, static fn ($t) => $t !== '');

        return array_values(array_unique($terms));
    }

    private function split_terms(string $value): array {
        $value = trim($value);
        if ($value === '') {
            return [];
        }
        if (str_contains($value, ',') || str_contains($value, '|')) {
            $parts = preg_split('/[,|]+/', $value);
            return array_values(array_filter(array_map('trim', $parts), static fn ($p) => $p !== ''));
        }
        return [$value];
    }

    private function extract_label(array $item): string {
        foreach (['name', 'title', 'label', 'slug'] as $key) {
            if (!empty($item[$key]) && is_string($item[$key])) {
                return $item[$key];
            }
        }
        return '';
    }

    private function is_assoc(array $arr): bool {
        if ($arr === []) {
            return false;
        }
        return array_keys($arr) !== range(0, count($arr) - 1);
    }
}
