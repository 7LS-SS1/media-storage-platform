<?php
namespace SevenLS_VP;

/**
 * Mode Strategy Interface
 *
 * Defines the contract for content-mode strategies (e.g. Thai Clip, AV Movie).
 * Each WordPress site selects exactly ONE mode at a time.
 */
interface Mode_Strategy {

    /**
     * Human-readable label for this mode.
     */
    public function get_label(): string;

    /**
     * Machine key stored in options (e.g. 'thai_clip', 'av_movie').
     */
    public function get_mode_key(): string;

    /**
     * API endpoint path appended to base_url for listing videos.
     */
    public function get_videos_endpoint(): string;

    /**
     * API endpoint path for fetching a single video.
     */
    public function get_single_video_endpoint(string $video_id): string;

    /**
     * API endpoint path for triggering server-side sync.
     */
    public function get_sync_trigger_endpoint(): string;

    /**
     * Default query parameters sent with every list request.
     */
    public function get_default_params(): array;

    /**
     * Map raw API response into a normalized structure.
     *
     * @param  array $raw Raw video data from API.
     * @return array Normalized video data.
     */
    public function map_fields(array $raw): array;

    /**
     * Validate that raw API data contains all required fields.
     *
     * @param  array $raw Raw video data from API.
     * @return bool|\WP_Error
     */
    public function validate(array $raw): bool|\WP_Error;

    /**
     * Taxonomy configuration for this mode.
     *
     * @return array{
     *   category_taxonomy: string,
     *   tag_taxonomy: string,
     *   actor_taxonomy: string,
     *   actor_parent_term: string
     * }
     */
    public function get_taxonomy_config(): array;
}
