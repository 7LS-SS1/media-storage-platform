<?php
namespace SevenLS_VP;

/**
 * Sync Engine Class
 *
 * Handles synchronisation of videos from API to WordPress.
 * Now strategy-aware: field mapping and taxonomy handling are
 * delegated to the active Mode_Strategy.
 */
class Sync_Engine {

    private API_Client     $api_client;
    private ?Mode_Strategy $strategy;
    private array          $settings;
    /** @var array<string, \WP_Post|null> */
    private array          $existing_post_cache = [];
    /** @var array<int, array<string, mixed>> */
    private array          $post_meta_cache = [];
    /** @var array<string, int|null> */
    private array          $actor_term_cache = [];
    /** @var array<string, int|null> */
    private array          $actor_parent_cache = [];

    private const PROGRESS_UPDATE_INTERVAL = 10;
    private const PROGRESS_PENDING_ITEMS_LIMIT = 8;
    private const PROGRESS_RECENT_RESULTS_LIMIT = 10;
    private const DEFAULT_BATCH_SIZE = 100;
    private const MAX_SYNC_PAGES = 0;
    private const SYNC_TIME_LIMIT_SECONDS = 0;
    private const THUMBNAIL_DOWNLOAD_TIMEOUT = 20;

    /**
     * @param Mode_Strategy|null $strategy Strategy to use.
     *                                     Null = auto-detect from options (backward compat).
     */
    public function __construct(?Mode_Strategy $strategy = null) {
        $this->strategy   = $strategy;
        $this->api_client = new API_Client($this->strategy);
        $this->settings   = get_option('sevenls_vp_settings', []);
    }

    /**
     * Run sync.
     *
     * @param array $options Sync options (full_sync, bypass_cache, since, progress_*).
     * @return array|\WP_Error Sync results or error.
     */
    public function sync(array $options = []): array|\WP_Error {
        $this->extend_execution_time_limit();

        $start_time = microtime(true);
        $full_sync      = !empty($options['full_sync']);
        $since_override = $options['since'] ?? null;
        $last_sync = $full_sync ? null : ($since_override ?: get_option('sevenls_vp_last_sync', null));

        if ($full_sync) {
            $this->clear_sync_transients();
        }

        $mode_label = $this->strategy ? $this->strategy->get_label() : 'legacy';
        Logger::log(
            ($full_sync ? 'Starting full sync' : 'Starting sync')
            . " (mode: {$mode_label})"
            . ($last_sync ? " (since {$last_sync})" : ''),
            'info'
        );

        $state = [
            'page'           => 1,
            'per_page'       => $this->resolve_batch_size($options['per_page'] ?? null),
            'processed'      => 0,
            'created'        => 0,
            'updated'        => 0,
            'errors'         => 0,
            'recent_results' => [],
            'error_items'    => [],
            'total_items'    => null,
            'total_pages'    => null,
        ];

        while (true) {
            $batch = $this->sync_batch(array_merge($options, [
                'page'             => $state['page'],
                'per_page'         => $state['per_page'],
                'since'            => $last_sync,
                'processed'        => $state['processed'],
                'created'          => $state['created'],
                'updated'          => $state['updated'],
                'errors'           => $state['errors'],
                'recent_results'   => $state['recent_results'],
                'error_items'      => $state['error_items'],
                'total_items'      => $state['total_items'],
                'total_pages'      => $state['total_pages'],
                'clear_sync_cache' => false,
            ]));

            if (is_wp_error($batch)) {
                return $batch;
            }

            $state['processed']      = $batch['processed'];
            $state['created']        = $batch['created'];
            $state['updated']        = $batch['updated'];
            $state['errors']         = $batch['errors'];
            $state['recent_results'] = $batch['recent_results'];
            $state['error_items']    = $batch['error_items'];
            $state['total_items']    = $batch['total_items'];
            $state['total_pages']    = $batch['total_pages'];

            if (empty($batch['has_more'])) {
                break;
            }

            $next_page = isset($batch['next_page']) ? (int) $batch['next_page'] : 0;
            if ($next_page < 1) {
                break;
            }

            $state['page'] = $next_page;
        }

        update_option('sevenls_vp_last_sync', current_time('mysql'));

        $duration = round(microtime(true) - $start_time, 2);

        $summary = [
            'processed' => $state['processed'],
            'created'   => $state['created'],
            'updated'   => $state['updated'],
            'errors'    => $state['errors'],
            'duration'  => $duration,
        ];

        Logger::log(sprintf(
            'Sync completed: %d processed (%d created, %d updated, %d errors) in %s seconds',
            $state['processed'], $state['created'], $state['updated'], $state['errors'], $duration
        ), 'info');

        return $summary;
    }

    /**
     * Process exactly one API page in a bounded request.
     *
     * @param array $options Sync batch options.
     * @return array|\WP_Error
     */
    public function sync_batch(array $options = []): array|\WP_Error {
        $this->extend_execution_time_limit();

        $page = max(1, (int) ($options['page'] ?? 1));
        $per_page = $this->resolve_batch_size($options['per_page'] ?? null);
        $full_sync = !empty($options['full_sync']);
        $bypass_cache = !empty($options['bypass_cache']) || $full_sync;
        $since = isset($options['since']) && is_string($options['since']) ? $options['since'] : null;
        $progress_job_id = isset($options['progress_job_id']) && is_string($options['progress_job_id'])
            ? $options['progress_job_id']
            : null;
        $progress_min_percent = isset($options['progress_min_percent']) ? (int) $options['progress_min_percent'] : 0;
        $progress_max_percent = isset($options['progress_max_percent']) ? (int) $options['progress_max_percent'] : 99;
        $processed = max(0, (int) ($options['processed'] ?? 0));
        $created = max(0, (int) ($options['created'] ?? 0));
        $updated = max(0, (int) ($options['updated'] ?? 0));
        $errors = max(0, (int) ($options['errors'] ?? 0));
        $total_items = isset($options['total_items']) && $options['total_items'] !== null
            ? max(0, (int) $options['total_items'])
            : null;
        $progress_total_pages = isset($options['total_pages']) && $options['total_pages'] !== null
            ? max(0, (int) $options['total_pages'])
            : null;
        $recent_results = isset($options['recent_results']) && is_array($options['recent_results'])
            ? $options['recent_results']
            : [];
        $error_items = isset($options['error_items']) && is_array($options['error_items'])
            ? $options['error_items']
            : [];

        if ($full_sync && !empty($options['clear_sync_cache'])) {
            $this->clear_sync_transients();
        }

        Sync_Lock::refresh();
        $transient_key = 'sevenls_vp_page_' . $page;
        $cached_data   = $bypass_cache ? false : get_transient($transient_key);

        if ($cached_data !== false) {
            $response = $cached_data;
        } else {
            $response = $this->api_client->fetch_videos([
                'page'     => $page,
                'per_page' => $per_page,
                'since'    => $since,
            ]);

            if (is_wp_error($response)) {
                Logger::log("Sync failed on page {$page}: {$response->get_error_message()}", 'error');
                return $response;
            }

            if (!$bypass_cache) {
                set_transient($transient_key, $response, 300);
            }
        }

        $pagination    = $response['pagination'] ?? [];
        $videos        = $response['data'] ?? [];
        $video_count   = count($videos);
        $this->prime_existing_post_cache($videos);
        $page_label    = $this->build_page_progress_label($page, $pagination, $video_count, $per_page);
        $pending_items = $this->build_pending_progress_items($videos, 0);

        if (isset($pagination['total']) && $pagination['total'] !== null) {
            $total_items = max(0, (int) $pagination['total']);
        }

        $resolved_total_pages = $this->resolve_progress_total_pages($pagination, $video_count, $per_page);
        if ($resolved_total_pages !== null) {
            $progress_total_pages = $resolved_total_pages;
        }

        $this->update_sync_progress($progress_job_id, [
            'status'       => 'running',
            'message'      => sprintf(__('กำลังประมวลผล%s...', '7ls-video-publisher'), $page_label),
            'percent'      => $this->build_progress_percent(
                handled: $processed + $errors,
                total_items: $total_items,
                current_page: $page,
                total_pages: $progress_total_pages,
                current_page_position: 0,
                current_page_total: $video_count,
                min_percent: $progress_min_percent,
                max_percent: $progress_max_percent
            ),
            'processed'    => $processed,
            'handled'      => $processed + $errors,
            'created'      => $created,
            'updated'      => $updated,
            'errors'       => $errors,
            'completed_items' => $processed,
            'current_page' => $page,
            'total_pages'  => $progress_total_pages,
            'total_items'  => $total_items,
            'current_item' => '',
            'pending_items' => $pending_items,
            'recent_results' => $recent_results,
            'error_items' => $error_items,
        ]);

        foreach ($videos as $index => $video_data) {
            Sync_Lock::refresh();
            $item_label = $this->build_progress_video_label($video_data);
            $result = $this->process_video($video_data);

            if (is_wp_error($result)) {
                $errors++;
                $vid_id = $video_data['id'] ?? $video_data['video_id'] ?? 'unknown';
                Logger::log("Failed to process video {$vid_id}: {$result->get_error_message()}", 'error');
                $entry = [
                    'title'  => $item_label,
                    'status' => 'error',
                    'detail' => $result->get_error_message(),
                ];
                $recent_results = $this->append_progress_entry($recent_results, $entry);
                $error_items = $this->append_progress_entry($error_items, $entry, 6);
            } else {
                $processed++;
                if ($result['action'] === 'created') {
                    $created++;
                } elseif ($result['action'] === 'updated') {
                    $updated++;
                }

                $recent_results = $this->append_progress_entry($recent_results, [
                    'title'  => $item_label,
                    'status' => $result['action'],
                    'detail' => isset($result['message']) && is_string($result['message']) && $result['message'] !== ''
                        ? $result['message']
                        : ($result['action'] === 'created'
                            ? __('สร้างวิดีโอใหม่เรียบร้อยแล้ว', '7ls-video-publisher')
                            : ($result['action'] === 'skipped'
                                ? __('ข้ามรายการนี้ชั่วคราว เพราะมีงานซิงก์อื่นกำลังจัดการข้อมูลเดียวกันอยู่', '7ls-video-publisher')
                                : __('อัปเดตวิดีโอเดิมเรียบร้อยแล้ว', '7ls-video-publisher'))),
                ]);
            }

            $handled = $processed + $errors;
            $is_last_video_on_page = $index === ($video_count - 1);
            $pending_items = $this->build_pending_progress_items($videos, $index + 1);

            if ($progress_job_id && ($handled % self::PROGRESS_UPDATE_INTERVAL === 0 || $is_last_video_on_page || $video_count <= self::PROGRESS_PENDING_ITEMS_LIMIT)) {
                $this->update_sync_progress($progress_job_id, [
                    'status'       => 'running',
                    'message'      => is_wp_error($result)
                        ? sprintf(__('อัปเดต "%1$s" ไม่สำเร็จที่%2$s', '7ls-video-publisher'), $item_label, $page_label)
                        : ($result['action'] === 'skipped'
                            ? sprintf(__('ข้าม "%1$s" ชั่วคราวที่%2$s', '7ls-video-publisher'), $item_label, $page_label)
                            : sprintf(__('อัปเดต "%1$s" แล้วที่%2$s', '7ls-video-publisher'), $item_label, $page_label)),
                    'percent'      => $this->build_progress_percent(
                        handled: $handled,
                        total_items: $total_items,
                        current_page: $page,
                        total_pages: $progress_total_pages,
                        current_page_position: $index + 1,
                        current_page_total: $video_count,
                        min_percent: $progress_min_percent,
                        max_percent: $progress_max_percent
                    ),
                    'processed'    => $processed,
                    'handled'      => $handled,
                    'created'      => $created,
                    'updated'      => $updated,
                    'errors'       => $errors,
                    'completed_items' => $processed,
                    'current_page' => $page,
                    'total_pages'  => $progress_total_pages,
                    'total_items'  => $total_items,
                    'current_item' => $item_label,
                    'pending_items' => $pending_items,
                    'recent_results' => $recent_results,
                    'error_items' => $error_items,
                ]);
            }
        }

        $has_more = false;
        $next_page = isset($pagination['next_page']) ? (int) $pagination['next_page'] : null;

        if (array_key_exists('has_more', $pagination) && $pagination['has_more'] !== null) {
            $has_more = (bool) $pagination['has_more'];
        } elseif ($next_page && $next_page > $page) {
            $has_more = true;
        } elseif (($pagination['page'] ?? null) !== null && ($pagination['total_pages'] ?? null) !== null) {
            $has_more = (int) $pagination['page'] < (int) $pagination['total_pages'];
        } elseif ($video_count === $per_page) {
            $has_more = true;
        }

        if ($videos === []) {
            $has_more = false;
        }

        $resolved_next_page = null;
        if ($has_more) {
            $resolved_next_page = ($next_page && $next_page > $page) ? $next_page : $page + 1;
        }

        if ($resolved_next_page !== null && $this->has_reached_sync_page_limit($resolved_next_page)) {
            Logger::log(
                sprintf('Sync stopped: reached page limit (%d)', $this->resolve_sync_page_limit()),
                'warning'
            );
            $has_more = false;
            $resolved_next_page = null;
        }

        return [
            'page'           => $page,
            'per_page'       => $per_page,
            'has_more'       => $has_more,
            'next_page'      => $resolved_next_page,
            'processed'      => $processed,
            'created'        => $created,
            'updated'        => $updated,
            'errors'         => $errors,
            'handled'        => $processed + $errors,
            'total_items'    => $total_items,
            'total_pages'    => $progress_total_pages,
            'recent_results' => $recent_results,
            'error_items'    => $error_items,
            'video_count'    => $video_count,
        ];
    }

    /**
     * Force sync — optionally trigger API sync first.
     *
     * @param bool  $trigger_api  Whether to call the API sync endpoint.
     * @param array $api_payload  Payload for API sync endpoint.
     * @return array|\WP_Error Sync results or error.
     */
    public function force_sync(bool $trigger_api = true, array $api_payload = []): array|\WP_Error {
        if ($trigger_api) {
            $payload    = $api_payload ?: ['limit' => 1000];
            $api_result = $this->api_client->trigger_plugin_sync($payload);

            if (is_wp_error($api_result)) {
                return $api_result;
            }
        }

        return $this->sync([
            'full_sync'    => true,
            'bypass_cache' => true,
        ]);
    }

    /**
     * Process a single video from the API.
     *
     * @param array $video_data Raw API video data.
     * @return array|\WP_Error  Result with action (created/updated) or error.
     */
    private function process_video(array $video_data): array|\WP_Error {
        // Strategy-aware path
        if ($this->strategy) {
            $valid = $this->strategy->validate($video_data);
            if (is_wp_error($valid)) {
                return $valid;
            }

            $mapped = $this->strategy->map_fields($video_data);
        } else {
            // Legacy path
            $mapped = $this->map_video_fields($video_data);
            if (is_wp_error($mapped)) {
                return $mapped;
            }
        }

        if (empty($mapped['external_id'])) {
            return new \WP_Error('invalid_data', 'Missing external_id after mapping');
        }

        $external_id = (string) $mapped['external_id'];
        $existing_post = $this->find_existing_post($external_id);
        $post_id = 0;
        $action = '';
        $message = '';

        if (!$existing_post) {
            $create_lock_acquired = Sync_Lock::acquire_item_create_lock($external_id);

            if ($create_lock_acquired) {
                try {
                    unset($this->existing_post_cache[$external_id]);
                    $existing_post = $this->find_existing_post($external_id);

                    if (!$existing_post) {
                        $post_id = $this->create_video_post($mapped);
                        $action  = 'created';
                        $message = __('สร้างวิดีโอใหม่เรียบร้อยแล้ว', '7ls-video-publisher');
                    }
                } finally {
                    Sync_Lock::release_item_create_lock($external_id);
                }
            } else {
                unset($this->existing_post_cache[$external_id]);
                $existing_post = $this->find_existing_post($external_id);

                if (!$existing_post) {
                    return [
                        'post_id' => 0,
                        'action'  => 'skipped',
                        'message' => __('ข้ามรายการนี้ชั่วคราว เพราะมีงานซิงก์อื่นกำลังสร้างข้อมูลวิดีโอเดียวกันอยู่', '7ls-video-publisher'),
                    ];
                }
            }
        }

        if ($existing_post) {
            if ($this->can_skip_existing_post_update($existing_post, $mapped)) {
                $post_id = $existing_post->ID;
                $action  = 'updated';
                $message = __('ไม่พบการเปลี่ยนแปลง จึงข้ามขั้นตอนอัปเดตหนักเพื่อให้ทำงานเร็วขึ้น', '7ls-video-publisher');
            } else {
                $post_id = $this->update_video_post($existing_post->ID, $mapped, $existing_post);
                $action  = 'updated';
                $message = __('อัปเดตวิดีโอเดิมเรียบร้อยแล้ว', '7ls-video-publisher');
            }
        }

        if (is_wp_error($post_id)) {
            return $post_id;
        }

        $saved_post = get_post($post_id);
        $this->existing_post_cache[$mapped['external_id']] = $saved_post instanceof \WP_Post ? $saved_post : null;

        // Save content_mode meta (strategy-aware)
        if ($this->strategy) {
            $this->update_post_meta_if_changed($post_id, '_sevenls_vp_content_mode', $this->strategy->get_mode_key());

            // Save mode-specific extra meta
            if (!empty($mapped['extra_meta'])) {
                foreach ($mapped['extra_meta'] as $key => $value) {
                    if ($value !== '') {
                        $this->update_post_meta_if_changed($post_id, '_sevenls_vp_' . $key, $value);
                    }
                }
            }
        }

        return [
            'post_id' => $post_id,
            'action'  => $action,
            'message' => $message,
        ];
    }

    // ─── Legacy field mapping (backward compat) ─────────────

    private function map_video_fields(array $video_data): array|\WP_Error {
        if (isset($video_data['video']) && is_array($video_data['video'])) {
            $video_data = $video_data['video'];
        }

        $external_id = $video_data['id'] ?? $video_data['video_id'] ?? $video_data['videoId'] ?? '';

        if (empty($external_id)) {
            return new \WP_Error('missing_field', __('จำเป็นต้องมีรหัสวิดีโอ', '7ls-video-publisher'));
        }

        $playback_url  = $video_data['playback_url'] ?? $video_data['playbackUrl'] ?? '';
        $video_url     = $playback_url ?: ($video_data['video_url'] ?? $video_data['videoUrl'] ?? $video_data['url'] ?? '');
        $thumbnail_url = $video_data['thumbnail_url'] ?? $video_data['thumbnailUrl'] ?? $video_data['thumbUrl'] ?? '';
        $created_at    = $video_data['created_at'] ?? $video_data['createdAt'] ?? '';
        $updated_at    = $video_data['updated_at'] ?? $video_data['updatedAt'] ?? '';

        $categories = $this->normalize_term_input(
            $video_data['categories'] ?? $video_data['category'] ?? $video_data['categorys'] ?? []
        );
        $tags = $this->normalize_term_input($video_data['tags'] ?? []);
        $actors = $this->normalize_term_input(
            $video_data['actors'] ?? $video_data['actor'] ?? $video_data['casts'] ??
            $video_data['cast'] ?? $video_data['performers'] ?? $video_data['starring'] ??
            $video_data['stars'] ?? $video_data['actor_names'] ?? []
        );

        return [
            'external_id'   => sanitize_text_field($external_id),
            'title'          => sanitize_text_field($video_data['title'] ?? $video_data['name'] ?? 'วิดีโอไม่มีชื่อ'),
            'description'    => wp_kses_post($video_data['description'] ?? $video_data['desc'] ?? ''),
            'video_url'      => esc_url_raw($video_url),
            'playback_url'   => esc_url_raw($playback_url),
            'thumbnail_url'  => esc_url_raw($thumbnail_url),
            'duration'       => absint($video_data['duration'] ?? 0),
            'categories'     => $categories,
            'tags'           => $tags,
            'actors'         => $actors,
            'created_at'     => sanitize_text_field($created_at),
            'updated_at'     => sanitize_text_field($updated_at),
            'raw_payload'    => wp_json_encode($video_data),
        ];
    }

    // ─── Term normalisation (legacy) ────────────────────────

    private function normalize_term_input(mixed $value): array {
        $terms = [];

        if (is_string($value)) {
            $terms = $this->split_terms($value);
        } elseif (is_array($value)) {
            if ($value === []) {
                $terms = [];
            } elseif ($this->is_assoc($value)) {
                $term = $this->extract_term_label($value);
                if ($term !== '') {
                    $terms = $this->split_terms($term);
                }
            } else {
                foreach ($value as $item) {
                    if (is_string($item)) {
                        $terms = array_merge($terms, $this->split_terms($item));
                    } elseif (is_array($item)) {
                        $term = $this->extract_term_label($item);
                        if ($term !== '') {
                            $terms = array_merge($terms, $this->split_terms($term));
                        }
                    }
                }
            }
        }

        $terms = array_map('sanitize_text_field', $terms);
        $terms = array_filter($terms, static fn ($term) => $term !== '');

        return array_values(array_unique($terms));
    }

    private function split_terms(string $value): array {
        $value = trim($value);
        if ($value === '') {
            return [];
        }
        if (str_contains($value, ',') || str_contains($value, '|')) {
            $parts = preg_split('/[,\|]+/', $value);
            $parts = array_map('trim', $parts);
            return array_values(array_filter($parts, static fn ($part) => $part !== ''));
        }
        return [$value];
    }

    private function extract_term_label(array $value): string {
        foreach (['name', 'title', 'label', 'slug'] as $key) {
            if (!empty($value[$key]) && is_string($value[$key])) {
                return $value[$key];
            }
        }
        return '';
    }

    private function is_assoc(array $value): bool {
        if ($value === []) {
            return false;
        }
        return array_keys($value) !== range(0, count($value) - 1);
    }

    // ─── Post CRUD ──────────────────────────────────────────

    private function find_existing_post(string $external_id): ?\WP_Post {
        $external_id = sanitize_text_field($external_id);
        if ($external_id === '') {
            return null;
        }

        if (array_key_exists($external_id, $this->existing_post_cache)) {
            return $this->existing_post_cache[$external_id];
        }

        global $wpdb;

        if (!$wpdb) {
            return null;
        }

        $post_type = Site_Profile::get_import_post_type();
        $post_id = $wpdb->get_var($wpdb->prepare(
            "SELECT p.ID
             FROM {$wpdb->posts} AS p
             INNER JOIN {$wpdb->postmeta} AS pm ON pm.post_id = p.ID
             WHERE p.post_type = %s
               AND pm.meta_key = %s
               AND pm.meta_value = %s
             ORDER BY p.ID DESC
             LIMIT 1",
            $post_type,
            '_sevenls_vp_external_id',
            $external_id
        ));

        $post = $post_id ? get_post((int) $post_id) : null;
        $this->existing_post_cache[$external_id] = $post instanceof \WP_Post ? $post : null;

        return $this->existing_post_cache[$external_id];
    }

    private function create_video_post(array $data): int|\WP_Error {
        $post_data = [
            'post_type'    => Site_Profile::get_import_post_type(),
            'post_title'   => $data['title'],
            'post_content' => $data['description'],
            'post_status'  => $this->settings['post_status'] ?? 'publish',
            'post_author'  => $this->settings['post_author'] ?? get_current_user_id(),
        ];

        $post_id = wp_insert_post($post_data, true);

        if (is_wp_error($post_id)) {
            return $post_id;
        }

        $this->save_video_meta($post_id, $data);
        $this->set_taxonomies($post_id, $data);

        if (Site_Profile::should_sideload_featured_image() && !empty($data['thumbnail_url'])) {
            $this->set_post_thumbnail($post_id, $data['thumbnail_url']);
        }

        $this->apply_site_profile_after_save($post_id);

        return $post_id;
    }

    private function update_video_post(int $post_id, array $data, ?\WP_Post $existing_post = null): int|\WP_Error {
        $existing_post = $existing_post instanceof \WP_Post ? $existing_post : get_post($post_id);
        $previous_thumb = (string) $this->get_cached_post_meta_value($post_id, '_sevenls_vp_thumbnail_url');

        if (
            $existing_post instanceof \WP_Post
            && ($existing_post->post_title !== (string) $data['title'] || $existing_post->post_content !== (string) $data['description'])
        ) {
            $post_data = [
                'ID'           => $post_id,
                'post_title'   => $data['title'],
                'post_content' => $data['description'],
            ];

            $result = wp_update_post($post_data, true);

            if (is_wp_error($result)) {
                return $result;
            }
        }

        $this->save_video_meta($post_id, $data);
        $this->set_taxonomies($post_id, $data);

        // Update thumbnail only if URL changed
        if (Site_Profile::should_sideload_featured_image() && !empty($data['thumbnail_url']) && $data['thumbnail_url'] !== $previous_thumb) {
            $this->set_post_thumbnail($post_id, $data['thumbnail_url']);
        }

        $this->apply_site_profile_after_save($post_id);

        return $post_id;
    }

    private function save_video_meta(int $post_id, array $data): void {
        $this->update_post_meta_if_changed($post_id, '_sevenls_vp_external_id', $data['external_id']);
        $this->update_post_meta_if_changed($post_id, '_sevenls_vp_video_url', $data['video_url']);
        $this->update_post_meta_if_changed($post_id, '_sevenls_vp_playback_url', $data['playback_url'] ?? '');
        $this->update_post_meta_if_changed($post_id, '_sevenls_vp_thumbnail_url', $data['thumbnail_url']);
        $this->update_post_meta_if_changed($post_id, '_sevenls_vp_duration', absint($data['duration'] ?? 0));
        $this->update_post_meta_if_changed($post_id, '_sevenls_vp_source_created_at', $data['created_at']);
        $this->update_post_meta_if_changed($post_id, '_sevenls_vp_source_updated_at', $data['updated_at']);

        if ($this->should_store_raw_payload() && !empty($data['raw_payload'])) {
            $this->update_post_meta_if_changed($post_id, '_sevenls_vp_raw_payload', $data['raw_payload']);
        }

        if (Site_Profile::is_retrotube_enabled()) {
            $this->save_retrotube_meta($post_id, $data);
        }
    }

    /**
     * Set taxonomy terms using strategy config when available.
     */
    private function set_taxonomies(int $post_id, array $data): void {
        $tax_config = Site_Profile::is_retrotube_enabled()
            ? Site_Profile::get_taxonomy_config()
            : ($this->strategy
            ? $this->strategy->get_taxonomy_config()
            : [
                'category_taxonomy' => 'video_category',
                'tag_taxonomy'      => 'video_tag',
                'actor_taxonomy'    => 'video_actor',
                'actor_parent_term' => 'นักแสดง',
                'actor_hierarchical' => true,
            ]);

        if (!empty($data['categories'])) {
            wp_set_object_terms($post_id, $data['categories'], $tax_config['category_taxonomy']);
        }

        if (!empty($data['tags'])) {
            wp_set_object_terms($post_id, $data['tags'], $tax_config['tag_taxonomy']);
        }

        if (!empty($data['actors'])) {
            if (!empty($tax_config['actor_hierarchical'])) {
                $this->set_actor_terms($post_id, $data['actors'], $tax_config);
            } else {
                wp_set_object_terms($post_id, $data['actors'], $tax_config['actor_taxonomy']);
            }
        }
    }

    private function save_retrotube_meta(int $post_id, array $data): void {
        $video_url = $data['playback_url'] ?? '';
        if ($video_url === '') {
            $video_url = $data['video_url'] ?? '';
        }

        $this->update_post_meta_if_changed($post_id, 'video_url', $video_url);
        $this->update_post_meta_if_changed($post_id, 'thumb', $data['thumbnail_url'] ?? '');
        $this->update_post_meta_if_changed($post_id, 'duration', absint($data['duration'] ?? 0));

        if (!metadata_exists('post', $post_id, 'post_views_count')) {
            update_post_meta($post_id, 'post_views_count', 0);
        }
        if (!metadata_exists('post', $post_id, 'likes_count')) {
            update_post_meta($post_id, 'likes_count', 0);
        }
        if (!metadata_exists('post', $post_id, 'dislikes_count')) {
            update_post_meta($post_id, 'dislikes_count', 0);
        }
    }

    private function resolve_batch_size(mixed $requested = null): int {
        if ($requested !== null && $requested !== '') {
            return max(10, min(250, (int) $requested));
        }

        $configured = isset($this->settings['sync_batch_size']) ? (int) $this->settings['sync_batch_size'] : self::DEFAULT_BATCH_SIZE;

        return max(10, min(250, $configured));
    }

    private function should_store_raw_payload(): bool {
        return !empty($this->settings['save_raw_payload']);
    }

    private function prime_existing_post_cache(array $videos): void {
        $external_ids = [];

        foreach ($videos as $video_data) {
            if (!is_array($video_data)) {
                continue;
            }

            $external_id = $this->extract_external_id_from_raw($video_data);
            if ($external_id === '' || array_key_exists($external_id, $this->existing_post_cache)) {
                continue;
            }

            $external_ids[$external_id] = $external_id;
        }

        if ($external_ids === []) {
            return;
        }

        global $wpdb;

        if (!$wpdb) {
            return;
        }

        $placeholders = implode(', ', array_fill(0, count($external_ids), '%s'));
        $sql = $wpdb->prepare(
            "SELECT pm.meta_value AS external_id, p.ID AS post_id
             FROM {$wpdb->posts} AS p
             INNER JOIN {$wpdb->postmeta} AS pm ON pm.post_id = p.ID
             WHERE p.post_type = %s
               AND pm.meta_key = %s
               AND pm.meta_value IN ({$placeholders})",
            array_merge(
                [Site_Profile::get_import_post_type(), '_sevenls_vp_external_id'],
                array_values($external_ids)
            )
        );

        $rows = $wpdb->get_results($sql);
        $found_ids = [];

        if (is_array($rows)) {
            foreach ($rows as $row) {
                if (!is_object($row)) {
                    continue;
                }

                $external_id = sanitize_text_field((string) ($row->external_id ?? ''));
                $post_id = isset($row->post_id) ? (int) $row->post_id : 0;

                if ($external_id === '' || $post_id <= 0) {
                    continue;
                }

                $post = get_post($post_id);
                $this->existing_post_cache[$external_id] = $post instanceof \WP_Post ? $post : null;
                $found_ids[$external_id] = true;
            }
        }

        foreach ($external_ids as $external_id) {
            if (!isset($found_ids[$external_id])) {
                $this->existing_post_cache[$external_id] = null;
            }
        }
    }

    private function extract_external_id_from_raw(array $video_data): string {
        if (isset($video_data['video']) && is_array($video_data['video'])) {
            $video_data = $video_data['video'];
        }

        return sanitize_text_field((string) ($video_data['id'] ?? $video_data['video_id'] ?? $video_data['videoId'] ?? ''));
    }

    private function can_skip_existing_post_update(\WP_Post $existing_post, array $data): bool {
        $updated_at = isset($data['updated_at']) ? (string) $data['updated_at'] : '';
        if ($updated_at === '') {
            return false;
        }

        $current_updated_at = (string) $this->get_cached_post_meta_value($existing_post->ID, '_sevenls_vp_source_updated_at');

        return $current_updated_at !== '' && $current_updated_at === $updated_at;
    }

    private function get_cached_post_meta_value(int $post_id, string $key): mixed {
        if (!isset($this->post_meta_cache[$post_id])) {
            $this->post_meta_cache[$post_id] = get_post_meta($post_id);
        }

        $values = $this->post_meta_cache[$post_id][$key] ?? null;
        if (is_array($values)) {
            return $values[0] ?? '';
        }

        return $values;
    }

    private function update_post_meta_if_changed(int $post_id, string $key, mixed $value): void {
        $current_value = $this->get_cached_post_meta_value($post_id, $key);

        if ((string) $current_value === (string) $value) {
            return;
        }

        update_post_meta($post_id, $key, $value);

        if (!isset($this->post_meta_cache[$post_id])) {
            $this->post_meta_cache[$post_id] = [];
        }

        $this->post_meta_cache[$post_id][$key] = [$value];
    }

    private function apply_site_profile_after_save(int $post_id): void {
        if (!Site_Profile::is_retrotube_enabled()) {
            return;
        }

        set_post_format($post_id, 'video');
    }

    private function set_post_thumbnail(int $post_id, string $image_url): void {
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $timeout = max(1, self::THUMBNAIL_DOWNLOAD_TIMEOUT);
        $request_args_filter = static function (array $args, string $url) use ($timeout): array {
            $args['timeout'] = $timeout;

            return $args;
        };

        add_filter('http_request_args', $request_args_filter, 10, 2);

        try {
            $attachment_id = media_sideload_image($image_url, $post_id, null, 'id');
        } finally {
            remove_filter('http_request_args', $request_args_filter, 10);
        }

        if (is_wp_error($attachment_id)) {
            Logger::log(
                sprintf(
                    'Thumbnail sideload skipped for post %1$d: %2$s',
                    $post_id,
                    $attachment_id->get_error_message()
                ),
                'warning'
            );
            return;
        }

        set_post_thumbnail($post_id, $attachment_id);
    }

    private function set_actor_terms(int $post_id, array $actors, array $tax_config): void {
        $actors = array_values(array_filter(
            array_map('sanitize_text_field', $actors),
            static fn ($a) => $a !== ''
        ));

        if (empty($actors)) {
            return;
        }

        $taxonomy  = $tax_config['actor_taxonomy'];
        $parent_id = $this->ensure_actor_parent_term($tax_config);
        $term_ids  = [];

        foreach ($actors as $actor) {
            $cache_key = $taxonomy . '|' . sanitize_title($actor);
            if (array_key_exists($cache_key, $this->actor_term_cache)) {
                $cached_term_id = $this->actor_term_cache[$cache_key];
                if ($cached_term_id !== null) {
                    $term_ids[] = $cached_term_id;
                }
                continue;
            }

            $existing = term_exists($actor, $taxonomy);

            if (is_array($existing)) {
                $term_id = (int) $existing['term_id'];
                $this->actor_term_cache[$cache_key] = $term_id;
                $term_ids[] = $term_id;
                continue;
            }
            if (is_int($existing)) {
                $this->actor_term_cache[$cache_key] = $existing;
                $term_ids[] = $existing;
                continue;
            }

            $args = [];
            if ($parent_id) {
                $args['parent'] = $parent_id;
            }

            $created = wp_insert_term($actor, $taxonomy, $args);
            if (!is_wp_error($created)) {
                $term_id = (int) $created['term_id'];
                $this->actor_term_cache[$cache_key] = $term_id;
                $term_ids[] = $term_id;
            } else {
                $this->actor_term_cache[$cache_key] = null;
            }
        }

        if (!empty($term_ids)) {
            wp_set_object_terms($post_id, $term_ids, $taxonomy);
        }
    }

    private function ensure_actor_parent_term(array $tax_config): ?int {
        $taxonomy    = $tax_config['actor_taxonomy'];
        $parent_name = $tax_config['actor_parent_term'];
        $slug        = sanitize_title($parent_name);
        $cache_key   = $taxonomy . '|' . $slug;

        if (array_key_exists($cache_key, $this->actor_parent_cache)) {
            return $this->actor_parent_cache[$cache_key];
        }

        $existing = term_exists($slug, $taxonomy);
        if (!$existing) {
            $existing = term_exists($parent_name, $taxonomy);
        }

        if ($existing) {
            $term_id = is_array($existing) ? (int) $existing['term_id'] : (int) $existing;
            $this->actor_parent_cache[$cache_key] = $term_id;
            return $term_id;
        }

        $created = wp_insert_term($parent_name, $taxonomy, ['slug' => $slug]);

        if (is_wp_error($created)) {
            $this->actor_parent_cache[$cache_key] = null;
            return null;
        }

        $term_id = (int) $created['term_id'];
        $this->actor_parent_cache[$cache_key] = $term_id;

        return $term_id;
    }

    private function update_sync_progress(?string $progress_job_id, array $state): void {
        if ($progress_job_id === null || $progress_job_id === '') {
            return;
        }

        Sync_Lock::update_progress($progress_job_id, $state);
    }

    private function build_progress_video_label(array $video_data): string {
        $title = '';

        if (isset($video_data['video']) && is_array($video_data['video'])) {
            $video_data = $video_data['video'];
        }

        foreach (['title', 'name'] as $key) {
            if (!empty($video_data[$key]) && is_string($video_data[$key])) {
                $title = sanitize_text_field($video_data[$key]);
                break;
            }
        }

        if ($title !== '') {
            return $title;
        }

        $external_id = $video_data['id'] ?? $video_data['video_id'] ?? $video_data['videoId'] ?? '';
        if (is_scalar($external_id) && $external_id !== '') {
            return sprintf(__('วิดีโอ %s', '7ls-video-publisher'), sanitize_text_field((string) $external_id));
        }

        return __('วิดีโอไม่มีชื่อ', '7ls-video-publisher');
    }

    /**
     * @return array<int, string>
     */
    private function build_pending_progress_items(array $videos, int $start_index): array {
        $items = [];
        $count = count($videos);

        for ($index = max(0, $start_index); $index < $count; $index++) {
            if (!is_array($videos[$index])) {
                continue;
            }

            $items[] = $this->build_progress_video_label($videos[$index]);

            if (count($items) >= self::PROGRESS_PENDING_ITEMS_LIMIT) {
                break;
            }
        }

        return $items;
    }

    /**
     * @param array<int, array{title: string, status: string, detail: string}> $entries
     * @param array{title: string, status: string, detail: string} $entry
     * @return array<int, array{title: string, status: string, detail: string}>
     */
    private function append_progress_entry(array $entries, array $entry, int $limit = self::PROGRESS_RECENT_RESULTS_LIMIT): array {
        array_unshift($entries, $entry);

        if (count($entries) > $limit) {
            $entries = array_slice($entries, 0, $limit);
        }

        return $entries;
    }

    private function build_page_progress_label(int $page, array $pagination, int $video_count, int $per_page): string {
        $total_pages = $this->resolve_progress_total_pages($pagination, $video_count, $per_page);

        if ($total_pages !== null && $total_pages > 0) {
            return sprintf(__('หน้า %1$d จาก %2$d', '7ls-video-publisher'), $page, $total_pages);
        }

        return sprintf(__('หน้า %d', '7ls-video-publisher'), $page);
    }

    private function resolve_progress_total_pages(array $pagination, int $video_count, int $per_page): ?int {
        $total_pages = isset($pagination['total_pages']) && $pagination['total_pages'] !== null
            ? (int) $pagination['total_pages']
            : null;
        $has_more = $pagination['has_more'] ?? null;

        if ($total_pages !== null && $total_pages > 1) {
            return $total_pages;
        }

        if ($total_pages === 1 && ($has_more === false || $video_count < $per_page)) {
            return 1;
        }

        return null;
    }

    private function build_progress_percent(
        int $handled,
        ?int $total_items,
        int $current_page,
        ?int $total_pages,
        int $current_page_position,
        int $current_page_total,
        int $min_percent,
        int $max_percent
    ): int {
        $raw_percent = 0;

        if ($total_items !== null && $total_items > 0) {
            $raw_percent = (int) floor((min($handled, $total_items) / $total_items) * 100);
        } elseif ($total_pages !== null && $total_pages > 0) {
            $page_fraction = $current_page_total > 0
                ? min(1, $current_page_position / $current_page_total)
                : 0;

            $raw_percent = (int) floor((((max(1, $current_page) - 1) + $page_fraction) / $total_pages) * 100);
        } elseif ($handled > 0) {
            $raw_percent = min(95, 10 + ((int) floor(log($handled + 1, 2) * 10)));
        }

        return $this->scale_progress_percent($raw_percent, $min_percent, $max_percent);
    }

    private function scale_progress_percent(int $raw_percent, int $min_percent, int $max_percent): int {
        $raw_percent = max(0, min(100, $raw_percent));
        $min_percent = max(0, min(100, $min_percent));
        $max_percent = max($min_percent, min(100, $max_percent));

        if ($max_percent === $min_percent) {
            return $max_percent;
        }

        $scaled = $min_percent + (($raw_percent / 100) * ($max_percent - $min_percent));

        return (int) floor($scaled);
    }

    private function extend_execution_time_limit(): void {
        if (!function_exists('set_time_limit')) {
            return;
        }

        $time_limit = (int) apply_filters('sevenls_vp_sync_time_limit', self::SYNC_TIME_LIMIT_SECONDS);
        @set_time_limit(max(0, $time_limit));
    }

    private function resolve_sync_page_limit(): int {
        $limit = (int) apply_filters('sevenls_vp_max_sync_pages', self::MAX_SYNC_PAGES);

        return max(0, $limit);
    }

    private function has_reached_sync_page_limit(int $page): bool {
        $limit = $this->resolve_sync_page_limit();

        return $limit > 0 && $page > $limit;
    }

    /**
     * Clear cached sync transients.
     */
    public function clear_sync_transients(): void {
        global $wpdb;

        if (!$wpdb) {
            return;
        }

        $like         = $wpdb->esc_like('_transient_sevenls_vp_page_') . '%';
        $timeout_like = $wpdb->esc_like('_transient_timeout_sevenls_vp_page_') . '%';

        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
            $like,
            $timeout_like
        ));
    }
}
