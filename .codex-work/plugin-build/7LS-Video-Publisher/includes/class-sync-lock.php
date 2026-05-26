<?php
namespace SevenLS_VP;

/**
 * Sync Lock
 *
 * Transient-based mutex that prevents concurrent sync operations.
 * Uses a TTL so the lock auto-expires if the process crashes.
 */
class Sync_Lock {

    private const TRANSIENT_KEY = 'sevenls_vp_sync_lock';
    private const TTL = 600; // 10 minutes max
    private const PROGRESS_TRANSIENT_PREFIX = 'sevenls_vp_sync_progress_';
    private const PROGRESS_ACTIVE_TTL       = 1800;
    private const PROGRESS_FINAL_TTL        = 3600;

    /**
     * Try to acquire the lock.
     *
     * @return bool True when acquired, false when already held.
     */
    public static function acquire(): bool {
        $existing = get_transient(self::TRANSIENT_KEY);

        if ($existing !== false) {
            return false;
        }

        set_transient(self::TRANSIENT_KEY, [
            'pid'  => getmypid(),
            'time' => time(),
        ], self::TTL);

        return true;
    }

    /**
     * Release the lock.
     */
    public static function release(): void {
        delete_transient(self::TRANSIENT_KEY);
    }

    /**
     * Refresh the lock TTL while a long-running sync is still active.
     */
    public static function refresh(): void {
        $current = get_transient(self::TRANSIENT_KEY);

        if ($current === false) {
            return;
        }

        if (!is_array($current)) {
            $current = [];
        }

        $current['pid']  = isset($current['pid']) ? (int) $current['pid'] : getmypid();
        $current['time'] = time();

        set_transient(self::TRANSIENT_KEY, $current, self::TTL);
    }

    /**
     * Check whether the lock is currently held.
     */
    public static function is_locked(): bool {
        return get_transient(self::TRANSIENT_KEY) !== false;
    }

    /**
     * Get info about the current lock holder (for diagnostics).
     *
     * @return array{pid: int, time: int}|null
     */
    public static function get_info(): ?array {
        $data = get_transient(self::TRANSIENT_KEY);

        return is_array($data) ? $data : null;
    }

    /**
     * Create an initial progress record.
     *
     * @param array<string, mixed> $state
     * @return array<string, mixed>
     */
    public static function start_progress(string $job_id, array $state = []): array {
        $record = array_merge(self::progress_defaults($job_id), $state, [
            'status'     => $state['status'] ?? 'queued',
            'started_at' => time(),
        ]);

        return self::store_progress($job_id, $record, self::PROGRESS_ACTIVE_TTL);
    }

    /**
     * Update a progress record.
     *
     * @param array<string, mixed> $state
     * @return array<string, mixed>
     */
    public static function update_progress(string $job_id, array $state): array {
        $current = self::get_progress($job_id) ?? self::progress_defaults($job_id);
        $record  = array_merge($current, $state);

        if (!isset($record['started_at']) || !$record['started_at']) {
            $record['started_at'] = time();
        }

        return self::store_progress($job_id, $record, self::PROGRESS_ACTIVE_TTL);
    }

    /**
     * Mark a progress record as completed.
     *
     * @param array<string, mixed> $state
     * @return array<string, mixed>
     */
    public static function complete_progress(string $job_id, array $state = []): array {
        $current  = self::get_progress($job_id) ?? self::progress_defaults($job_id);
        $finished = time();
        $record   = array_merge($current, $state, [
            'status'      => 'completed',
            'percent'     => 100,
            'finished_at' => $finished,
        ]);

        if (!isset($record['duration']) || $record['duration'] === null) {
            $started_at = (int) ($record['started_at'] ?? $finished);
            $record['duration'] = max(0, round($finished - $started_at, 2));
        }

        return self::store_progress($job_id, $record, self::PROGRESS_FINAL_TTL);
    }

    /**
     * Mark a progress record as failed.
     *
     * @param array<string, mixed> $state
     * @return array<string, mixed>
     */
    public static function fail_progress(string $job_id, string $message, array $state = []): array {
        $current  = self::get_progress($job_id) ?? self::progress_defaults($job_id);
        $finished = time();
        $record   = array_merge($current, $state, [
            'status'      => 'error',
            'message'     => $message,
            'finished_at' => $finished,
        ]);

        if (!isset($record['duration']) || $record['duration'] === null) {
            $started_at = (int) ($record['started_at'] ?? $finished);
            $record['duration'] = max(0, round($finished - $started_at, 2));
        }

        return self::store_progress($job_id, $record, self::PROGRESS_FINAL_TTL);
    }

    /**
     * Get a progress record.
     *
     * @return array<string, mixed>|null
     */
    public static function get_progress(string $job_id): ?array {
        $record = get_transient(self::progress_key($job_id));

        return is_array($record) ? self::normalize_progress($job_id, $record) : null;
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private static function store_progress(string $job_id, array $record, int $ttl): array {
        $record['updated_at'] = time();
        $normalized = self::normalize_progress($job_id, $record);
        set_transient(self::progress_key($job_id), $normalized, $ttl);

        return $normalized;
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private static function normalize_progress(string $job_id, array $record): array {
        $record = array_merge(self::progress_defaults($job_id), $record);

        $record['job_id']       = $job_id;
        $record['status']       = sanitize_key((string) $record['status']);
        $record['label']        = sanitize_text_field((string) $record['label']);
        $record['operation']    = sanitize_key((string) $record['operation']);
        $record['message']      = sanitize_text_field((string) $record['message']);
        $record['mode']         = sanitize_key((string) $record['mode']);
        $record['mode_label']   = sanitize_text_field((string) $record['mode_label']);
        $record['percent']      = max(0, min(100, (int) $record['percent']));
        $record['processed']    = max(0, (int) $record['processed']);
        $record['completed_items'] = max(0, (int) ($record['completed_items'] ?: $record['processed']));
        $record['created']      = max(0, (int) $record['created']);
        $record['updated']      = max(0, (int) $record['updated']);
        $record['errors']       = max(0, (int) $record['errors']);
        $record['handled']      = max(0, (int) ($record['handled'] ?: ($record['processed'] + $record['errors'])));
        $record['current_page'] = max(0, (int) $record['current_page']);
        $record['total_pages']  = $record['total_pages'] !== null ? max(0, (int) $record['total_pages']) : null;
        $record['total_items']  = $record['total_items'] !== null ? max(0, (int) $record['total_items']) : null;
        $record['started_at']   = max(0, (int) $record['started_at']);
        $record['finished_at']  = $record['finished_at'] !== null ? max(0, (int) $record['finished_at']) : null;
        $record['updated_at']   = $record['updated_at'] !== null ? max(0, (int) $record['updated_at']) : null;
        $record['duration']     = $record['duration'] !== null ? max(0, (float) $record['duration']) : null;
        $record['current_item'] = sanitize_text_field((string) $record['current_item']);
        $record['pending_items'] = self::normalize_progress_labels($record['pending_items']);
        $record['recent_results'] = self::normalize_progress_entries($record['recent_results']);
        $record['error_items'] = self::normalize_progress_entries($record['error_items'], ['error']);

        return $record;
    }

    /**
     * @return array<string, mixed>
     */
    private static function progress_defaults(string $job_id): array {
        return [
            'job_id'       => $job_id,
            'status'       => 'queued',
            'label'        => '',
            'operation'    => '',
            'message'      => '',
            'mode'         => '',
            'mode_label'   => '',
            'percent'      => 0,
            'processed'    => 0,
            'completed_items' => 0,
            'handled'      => 0,
            'created'      => 0,
            'updated'      => 0,
            'errors'       => 0,
            'current_page' => 0,
            'total_pages'  => null,
            'total_items'  => null,
            'started_at'   => 0,
            'finished_at'  => null,
            'updated_at'   => null,
            'duration'     => null,
            'current_item' => '',
            'pending_items' => [],
            'recent_results' => [],
            'error_items' => [],
        ];
    }

    private static function progress_key(string $job_id): string {
        return self::PROGRESS_TRANSIENT_PREFIX . sanitize_key($job_id);
    }

    /**
     * @param mixed $items
     * @return array<int, string>
     */
    private static function normalize_progress_labels(mixed $items, int $limit = 8): array {
        if (!is_array($items)) {
            return [];
        }

        $labels = [];

        foreach ($items as $item) {
            if (!is_string($item)) {
                continue;
            }

            $label = sanitize_text_field($item);
            if ($label === '') {
                continue;
            }

            $labels[] = $label;

            if (count($labels) >= $limit) {
                break;
            }
        }

        return $labels;
    }

    /**
     * @param mixed $items
     * @param array<int, string> $allowed_statuses
     * @return array<int, array{title: string, status: string, detail: string}>
     */
    private static function normalize_progress_entries(mixed $items, array $allowed_statuses = ['created', 'updated', 'error'], int $limit = 10): array {
        if (!is_array($items)) {
            return [];
        }

        $entries = [];

        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }

            $title  = sanitize_text_field((string) ($item['title'] ?? ''));
            $status = sanitize_key((string) ($item['status'] ?? ''));
            $detail = sanitize_text_field((string) ($item['detail'] ?? ''));

            if ($title === '' || !in_array($status, $allowed_statuses, true)) {
                continue;
            }

            $entries[] = [
                'title'  => $title,
                'status' => $status,
                'detail' => $detail,
            ];

            if (count($entries) >= $limit) {
                break;
            }
        }

        return $entries;
    }
}
