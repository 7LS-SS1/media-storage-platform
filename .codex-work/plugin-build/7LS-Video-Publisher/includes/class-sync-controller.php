<?php
namespace SevenLS_VP;

/**
 * Sync Controller
 *
 * High-level orchestrator exposing the four main operations:
 *   1. test_api_connect()     — verify connectivity & token
 *   2. update_new_videos()    — incremental rolling-24 h sync
 *   3. force_recent_videos_update() — force sync rolling-48 h window
 *   4. initial_full_update()  — force full sync (no cache)
 *
 * All operations are mode-aware via Mode_Strategy and protected
 * by Sync_Lock to prevent concurrent execution.
 */
class Sync_Controller {

    private API_Client    $api;
    private Sync_Engine   $engine;
    private Mode_Strategy $strategy;

    private const FORCE_RECENT_WINDOW_SECONDS = 172800;
    private const FULL_SYNC_REMOTE_BATCH_LIMIT = 1000;
    private const FULL_SYNC_LOCAL_PROGRESS_MIN = 35;
    private const FULL_SYNC_LOCAL_PROGRESS_MAX = 99;
    private const MAX_RETRIES      = 3;
    private const RETRY_BASE_DELAY = 2; // seconds — delay = base^attempt

    public function __construct(?Mode_Strategy $strategy = null) {
        $this->strategy = $strategy ?? Mode_Factory::create();
        $this->api      = new API_Client($this->strategy);
        $this->engine   = new Sync_Engine($this->strategy);
    }

    /**
     * Get the active strategy (useful for UI display).
     */
    public function get_strategy(): Mode_Strategy {
        return $this->strategy;
    }

    // ─── 1. Test API Connection ─────────────────────────────

    /**
     * Test the API connection and token validity.
     *
     * @return array{success: bool, mode: string, label?: string, error?: string}
     */
    public function test_api_connect(): array {
        $mode_key = $this->strategy->get_mode_key();
        Logger::log("Testing API connection (mode: {$mode_key})");

        $result = $this->with_retry(
            fn () => $this->api->test_connection(),
            max_attempts: 2
        );

        if (is_wp_error($result)) {
            Logger::log("Connection failed: {$result->get_error_message()}", 'error');

            return [
                'success' => false,
                'mode'    => $mode_key,
                'error'   => $result->get_error_message(),
            ];
        }

        Logger::log('API connection successful');
        update_option('sevenls_vp_last_connection_test', current_time('mysql'));

        return [
            'success' => true,
            'mode'    => $mode_key,
            'label'   => $this->strategy->get_label(),
        ];
    }

    // ─── 2. Update New Videos (rolling 24 h) ────────────────

    /**
     * Incremental sync: fetch videos created/updated since the later of
     * last_sync or 24 hours ago.
     *
     * @return array|\WP_Error Sync summary or error.
     */
    public function update_new_videos(?string $progress_job_id = null): array|\WP_Error {
        $mode_key   = $this->strategy->get_mode_key();
        $mode_label = $this->strategy->get_label();

        $this->update_progress($progress_job_id, [
            'status'     => 'running',
            'mode'       => $mode_key,
            'mode_label' => $mode_label,
            'message'    => __('กำลังเตรียมซิงก์แบบเพิ่มเฉพาะข้อมูลใหม่...', '7ls-video-publisher'),
            'percent'    => 2,
        ]);

        $active_job_error = $this->ensure_no_competing_active_job();
        if (is_wp_error($active_job_error)) {
            $this->fail_progress($progress_job_id, $active_job_error->get_error_message());
            return $active_job_error;
        }

        if (!Sync_Lock::acquire()) {
            $error = new \WP_Error('sync_locked', __('มีการซิงก์อื่นกำลังทำงานอยู่ กรุณารอสักครู่', '7ls-video-publisher'));
            $this->fail_progress($progress_job_id, $error->get_error_message());
            return $error;
        }

        try {
            $last_sync = get_option('sevenls_vp_last_sync');
            $twenty_four_hours_ago = gmdate('Y-m-d\TH:i:s\Z', strtotime('-24 hours'));

            if ($last_sync) {
                $last_ts  = strtotime($last_sync);
                $cap_ts   = strtotime('-24 hours');
                $since    = gmdate('Y-m-d\TH:i:s\Z', max($last_ts, $cap_ts));
            } else {
                $since = $twenty_four_hours_ago;
            }

            Logger::log("update_new_videos: since={$since}, mode={$mode_key}");

            $this->update_progress($progress_job_id, [
                'message' => __('กำลังซิงก์วิดีโอจากช่วงเวลา 24 ชั่วโมงล่าสุด...', '7ls-video-publisher'),
                'percent' => 5,
            ]);

            $result = $this->engine->sync([
                'since'                => $since,
                'full_sync'            => false,
                'bypass_cache'         => true,
                'progress_job_id'      => $progress_job_id,
                'progress_min_percent' => 5,
                'progress_max_percent' => 99,
            ]);

            if (is_wp_error($result)) {
                Logger::log("update_new_videos failed: {$result->get_error_message()}", 'error');
                $this->fail_progress($progress_job_id, $result->get_error_message());
                return $result;
            }

            update_option('sevenls_vp_last_sync', current_time('mysql'));

            Logger::log(sprintf(
                'update_new_videos completed: %d processed (%d created, %d updated, %d errors) in %.1fs',
                $result['processed'],
                $result['created'],
                $result['updated'],
                $result['errors'],
                $result['duration']
            ));

            $this->complete_progress($progress_job_id, __('ซิงก์แบบเพิ่มเฉพาะข้อมูลใหม่เสร็จแล้ว', '7ls-video-publisher'), $result);

            return $result;

        } finally {
            Sync_Lock::release();
        }
    }

    // ─── 3. Force Recent Videos Update (rolling 48 h) ───────

    /**
     * Force sync videos created/updated within the last 48 hours,
     * ignoring the stored last_sync timestamp.
     *
     * @return array|\WP_Error Sync summary or error.
     */
    public function force_recent_videos_update(?string $progress_job_id = null): array|\WP_Error {
        $mode_key   = $this->strategy->get_mode_key();
        $mode_label = $this->strategy->get_label();

        $this->update_progress($progress_job_id, [
            'status'     => 'running',
            'mode'       => $mode_key,
            'mode_label' => $mode_label,
            'message'    => __('กำลังเตรียมบังคับซิงก์ย้อนหลัง 2 วัน...', '7ls-video-publisher'),
            'percent'    => 2,
        ]);

        $active_job_error = $this->ensure_no_competing_active_job();
        if (is_wp_error($active_job_error)) {
            $this->fail_progress($progress_job_id, $active_job_error->get_error_message());
            return $active_job_error;
        }

        if (!Sync_Lock::acquire()) {
            $error = new \WP_Error('sync_locked', __('มีการซิงก์อื่นกำลังทำงานอยู่ กรุณารอสักครู่', '7ls-video-publisher'));
            $this->fail_progress($progress_job_id, $error->get_error_message());
            return $error;
        }

        try {
            $current_ts = (int) current_time('timestamp', true);
            $since_ts   = max(0, $current_ts - self::FORCE_RECENT_WINDOW_SECONDS);
            $since      = gmdate('Y-m-d\TH:i:s\Z', $since_ts);

            Logger::log("force_recent_videos_update: since={$since}, mode={$mode_key}");

            $this->update_progress($progress_job_id, [
                'message' => __('กำลังบังคับซิงก์วิดีโอจากช่วง 48 ชั่วโมงล่าสุด...', '7ls-video-publisher'),
                'percent' => 5,
            ]);

            $result = $this->engine->sync([
                'since'                => $since,
                'full_sync'            => false,
                'bypass_cache'         => true,
                'progress_job_id'      => $progress_job_id,
                'progress_min_percent' => 5,
                'progress_max_percent' => 99,
            ]);

            if (is_wp_error($result)) {
                Logger::log("force_recent_videos_update failed: {$result->get_error_message()}", 'error');
                $this->fail_progress($progress_job_id, $result->get_error_message());
                return $result;
            }

            update_option('sevenls_vp_last_sync', current_time('mysql'));

            Logger::log(sprintf(
                'force_recent_videos_update completed: %d processed (%d created, %d updated, %d errors) in %.1fs',
                $result['processed'],
                $result['created'],
                $result['updated'],
                $result['errors'],
                $result['duration']
            ));

            $this->complete_progress($progress_job_id, __('บังคับซิงก์ย้อนหลัง 2 วันเสร็จแล้ว', '7ls-video-publisher'), $result);

            return $result;

        } finally {
            Sync_Lock::release();
        }
    }

    /**
     * Queue a full sync job that will be processed across multiple requests.
     *
     * @return array<string, mixed>|\WP_Error
     */
    public function start_full_sync_batch(string $job_id): array|\WP_Error {
        $normalized_job_id = sanitize_key($job_id);
        if ($normalized_job_id === '') {
            return new \WP_Error('invalid_job_id', __('ไม่พบรหัสงานซิงก์', '7ls-video-publisher'));
        }

        $mode_key   = $this->strategy->get_mode_key();
        $mode_label = $this->strategy->get_label();

        $active_job_error = $this->ensure_no_competing_active_job($normalized_job_id);
        if (is_wp_error($active_job_error)) {
            $this->fail_progress($normalized_job_id, $active_job_error->get_error_message());
            return $active_job_error;
        }

        if (!Sync_Lock::claim_active_job($normalized_job_id, 'full_sync')) {
            $error = new \WP_Error('sync_locked', __('มีงานซิงก์อื่นอยู่ในคิวหรือกำลังทำงานอยู่ กรุณารอสักครู่', '7ls-video-publisher'));
            $this->fail_progress($normalized_job_id, $error->get_error_message());
            return $error;
        }

        Logger::log("Queued batched full sync job {$normalized_job_id} (mode: {$mode_key})");

        $this->update_progress($normalized_job_id, [
            'status'     => 'running',
            'mode'       => $mode_key,
            'mode_label' => $mode_label,
            'message'    => __('กำลังเตรียมซิงก์ข้อมูลทั้งหมดแบบแบ่งแบตช์...', '7ls-video-publisher'),
            'percent'    => 1,
            'current_item' => '',
            'pending_items' => [],
            'recent_results' => [],
            'error_items' => [],
        ]);

        Sync_Lock::clear_job_state($normalized_job_id);
        $state = [
            'job_id'           => $normalized_job_id,
            'operation'        => 'full_sync',
            'phase'            => 'prepare_remote',
            'mode'             => $mode_key,
            'mode_label'       => $mode_label,
            'started_at_micro' => microtime(true),
            'remote_cursor'    => null,
            'remote_batches'   => 0,
            'remote_totals'    => [
                'scanned'    => 0,
                'discovered' => 0,
                'created'    => 0,
                'updated'    => 0,
                'skipped'    => 0,
            ],
            'page'             => 1,
            'per_page'         => $this->get_local_sync_batch_size(),
            'processed'        => 0,
            'created'          => 0,
            'updated'          => 0,
            'errors'           => 0,
            'total_items'      => null,
            'total_pages'      => null,
            'recent_results'   => [],
            'error_items'      => [],
        ];
        Sync_Lock::set_job_state($normalized_job_id, $state);

        return [
            'job_id'   => $normalized_job_id,
            'phase'    => 'prepare_remote',
            'batched'  => true,
            'continue' => true,
            'message'  => __('เพิ่มงานซิงก์ข้อมูลทั้งหมดเข้าคิวแล้ว และพร้อมประมวลผลแบบแบ่งแบตช์', '7ls-video-publisher'),
            'progress' => Sync_Lock::get_progress($normalized_job_id),
        ];
    }

    /**
     * Process one batched full sync request.
     *
     * @return array<string, mixed>|\WP_Error
     */
    public function process_full_sync_batch(string $job_id): array|\WP_Error {
        $normalized_job_id = sanitize_key($job_id);
        if ($normalized_job_id === '') {
            return new \WP_Error('invalid_job_id', __('ไม่พบรหัสงานซิงก์', '7ls-video-publisher'));
        }

        $state = Sync_Lock::get_job_state($normalized_job_id);
        if (!is_array($state)) {
            $progress = Sync_Lock::get_progress($normalized_job_id);
            if (is_array($progress) && in_array(($progress['status'] ?? ''), ['completed', 'error'], true)) {
                return [
                    'job_id'   => $normalized_job_id,
                    'phase'    => 'finished',
                    'batched'  => true,
                    'continue' => false,
                    'progress' => $progress,
                ];
            }

            return new \WP_Error('sync_job_missing', __('ไม่พบงานซิงก์ข้อมูลทั้งหมด กรุณาเริ่มใหม่อีกครั้ง', '7ls-video-publisher'));
        }

        $active_job_error = $this->ensure_no_competing_active_job($normalized_job_id);
        if (is_wp_error($active_job_error)) {
            return $this->fail_batch_job($normalized_job_id, $active_job_error->get_error_message());
        }

        if (!Sync_Lock::claim_active_job($normalized_job_id, 'full_sync')) {
            return $this->fail_batch_job(
                $normalized_job_id,
                __('มีงานซิงก์อื่นอยู่ในคิวหรือกำลังทำงานอยู่ กรุณารอสักครู่', '7ls-video-publisher')
            );
        }

        if (!Sync_Lock::acquire()) {
            $active_job = Sync_Lock::get_active_job();
            if (is_array($active_job) && ($active_job['job_id'] ?? '') === $normalized_job_id) {
                return [
                    'job_id'   => $normalized_job_id,
                    'phase'    => isset($state['phase']) && is_string($state['phase']) ? $state['phase'] : 'prepare_remote',
                    'batched'  => true,
                    'continue' => true,
                    'progress' => Sync_Lock::get_progress($normalized_job_id),
                ];
            }

            return $this->fail_batch_job(
                $normalized_job_id,
                __('มีคำขอซิงก์อื่นกำลังประมวลผลอยู่ กรุณารอสักครู่แล้วลองใหม่อีกครั้ง', '7ls-video-publisher')
            );
        }

        try {
            Sync_Lock::refresh();
            Sync_Lock::refresh_active_job($normalized_job_id, 'full_sync');

            $phase = isset($state['phase']) && is_string($state['phase']) ? $state['phase'] : 'prepare_remote';

            if ($phase === 'prepare_remote') {
                return $this->process_remote_preparation_batch($normalized_job_id, $state);
            }

            return $this->process_local_sync_batch($normalized_job_id, $state);
        } catch (\Throwable $throwable) {
            Logger::log('Full sync batch crashed: ' . $throwable->getMessage(), 'error');

            return $this->fail_batch_job(
                $normalized_job_id,
                sprintf(__('แบตช์ซิงก์ข้อมูลทั้งหมดล้มเหลว: %s', '7ls-video-publisher'), $throwable->getMessage())
            );
        } finally {
            Sync_Lock::release();
        }
    }

    // ─── 4. Initial Full Update (Force) ─────────────────────

    /**
     * Full sync: optionally trigger server-side preparation, clear caches,
     * then fetch ALL videos ignoring last_sync timestamp.
     *
     * @return array|\WP_Error Sync summary or error.
     */
    public function initial_full_update(?string $progress_job_id = null): array|\WP_Error {
        $mode_key   = $this->strategy->get_mode_key();
        $mode_label = $this->strategy->get_label();

        $this->update_progress($progress_job_id, [
            'status'     => 'running',
            'mode'       => $mode_key,
            'mode_label' => $mode_label,
            'message'    => __('กำลังเตรียมซิงก์ข้อมูลทั้งหมด...', '7ls-video-publisher'),
            'percent'    => 2,
        ]);

        $active_job_error = $this->ensure_no_competing_active_job();
        if (is_wp_error($active_job_error)) {
            $this->fail_progress($progress_job_id, $active_job_error->get_error_message());
            return $active_job_error;
        }

        if (!Sync_Lock::acquire()) {
            $error = new \WP_Error('sync_locked', __('มีการซิงก์อื่นกำลังทำงานอยู่ กรุณารอสักครู่', '7ls-video-publisher'));
            $this->fail_progress($progress_job_id, $error->get_error_message());
            return $error;
        }

        try {
            Logger::log("initial_full_update started (mode: {$mode_key})");

            $this->update_progress($progress_job_id, [
                'message' => __('Triggering server-side preparation...', '7ls-video-publisher'),
                'percent' => 5,
            ]);

            // 1) Trigger server-side data preparation
            $trigger_result = $this->with_retry(fn () => $this->api->trigger_plugin_sync([
                'mode'  => $mode_key,
                'limit' => 10000,
            ]));

            if (is_wp_error($trigger_result)) {
                Logger::log(
                    "Server sync trigger failed (continuing): {$trigger_result->get_error_message()}",
                    'warning'
                );

                $this->update_progress($progress_job_id, [
                    'message' => __('การเตรียมข้อมูลฝั่งเซิร์ฟเวอร์ล้มเหลว แต่ระบบจะดำเนินการซิงก์ข้อมูลทั้งหมดต่อ', '7ls-video-publisher'),
                    'percent' => 10,
                ]);
            } else {
                $this->update_progress($progress_job_id, [
                    'message' => __('การเตรียมข้อมูลฝั่งเซิร์ฟเวอร์เสร็จแล้ว', '7ls-video-publisher'),
                    'percent' => 10,
                ]);
            }

            // 2) Clear all page transient caches
            $this->update_progress($progress_job_id, [
                'message' => __('กำลังล้างแคชหน้าที่ใช้ซิงก์...', '7ls-video-publisher'),
                'percent' => 12,
            ]);
            $this->engine->clear_sync_transients();

            // 3) Run full sync — no since, no cache
            $this->update_progress($progress_job_id, [
                'message' => __('กำลังซิงก์ข้อมูลทั้งหมดของวิดีโอ...', '7ls-video-publisher'),
                'percent' => 15,
            ]);
            $result = $this->engine->sync([
                'full_sync'            => true,
                'bypass_cache'         => true,
                'progress_job_id'      => $progress_job_id,
                'progress_min_percent' => 15,
                'progress_max_percent' => 99,
            ]);

            if (is_wp_error($result)) {
                Logger::log("initial_full_update failed: {$result->get_error_message()}", 'error');
                $this->fail_progress($progress_job_id, $result->get_error_message());
                return $result;
            }

            update_option('sevenls_vp_last_sync', current_time('mysql'));
            update_option('sevenls_vp_last_full_sync', current_time('mysql'));

            Logger::log(sprintf(
                'initial_full_update completed: %d processed (%d created, %d updated, %d errors) in %.1fs',
                $result['processed'],
                $result['created'],
                $result['updated'],
                $result['errors'],
                $result['duration']
            ));

            $this->complete_progress($progress_job_id, __('ซิงก์ข้อมูลทั้งหมดเสร็จแล้ว', '7ls-video-publisher'), $result);

            return $result;

        } finally {
            Sync_Lock::release();
        }
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed>|\WP_Error
     */
    private function process_remote_preparation_batch(string $job_id, array $state): array|\WP_Error {
        $mode_key = isset($state['mode']) && is_string($state['mode']) && $state['mode'] !== ''
            ? $state['mode']
            : $this->strategy->get_mode_key();
        $mode_label = isset($state['mode_label']) && is_string($state['mode_label']) && $state['mode_label'] !== ''
            ? $state['mode_label']
            : $this->strategy->get_label();
        $cursor = isset($state['remote_cursor']) && is_string($state['remote_cursor']) && $state['remote_cursor'] !== ''
            ? $state['remote_cursor']
            : null;
        $remote_batches = max(0, (int) ($state['remote_batches'] ?? 0)) + 1;
        $remote_totals = $this->normalize_remote_totals($state['remote_totals'] ?? []);

        $this->update_progress($job_id, [
            'status'     => 'running',
            'mode'       => $mode_key,
            'mode_label' => $mode_label,
            'message'    => $cursor === null
                ? __('กำลังสแกนวิดีโอต้นทางสำหรับการซิงก์ข้อมูลทั้งหมด...', '7ls-video-publisher')
                : sprintf(__('กำลังสแกนวิดีโอต้นทาง แบตช์ที่ %d...', '7ls-video-publisher'), $remote_batches),
            'percent'    => $this->build_remote_prepare_percent($remote_batches, false),
        ]);

        $payload = [
            'mode'  => $mode_key,
            'limit' => self::FULL_SYNC_REMOTE_BATCH_LIMIT,
        ];
        if ($cursor !== null) {
            $payload['cursor'] = $cursor;
        }

        $response = $this->with_retry(fn () => $this->api->trigger_plugin_sync($payload));
        if (is_wp_error($response)) {
            Logger::log("Full sync remote preparation failed: {$response->get_error_message()}", 'error');

            return $this->fail_batch_job($job_id, $response->get_error_message());
        }

        foreach (array_keys($remote_totals) as $key) {
            $remote_totals[$key] += max(0, (int) ($response[$key] ?? 0));
        }

        $next_cursor = isset($response['nextCursor']) && is_string($response['nextCursor']) && $response['nextCursor'] !== ''
            ? $response['nextCursor']
            : null;

        $state['mode'] = $mode_key;
        $state['mode_label'] = $mode_label;
        $state['remote_batches'] = $remote_batches;
        $state['remote_cursor'] = $next_cursor;
        $state['remote_totals'] = $remote_totals;

        if ($next_cursor !== null) {
            Sync_Lock::set_job_state($job_id, $state);
            Sync_Lock::refresh_active_job($job_id, 'full_sync');

            $message = sprintf(
                __('เตรียมข้อมูลต้นทางแบตช์ที่ %1$d แล้ว: สแกน %2$d รายการ สร้าง %3$d รายการ อัปเดต %4$d รายการ กำลังดำเนินการต่อ...', '7ls-video-publisher'),
                $remote_batches,
                max(0, (int) ($response['scanned'] ?? 0)),
                max(0, (int) ($response['created'] ?? 0)),
                max(0, (int) ($response['updated'] ?? 0))
            );

            $progress = Sync_Lock::update_progress($job_id, [
                'status'     => 'running',
                'mode'       => $mode_key,
                'mode_label' => $mode_label,
                'message'    => $message,
                'percent'    => $this->build_remote_prepare_percent($remote_batches, false),
            ]);

            return [
                'job_id'   => $job_id,
                'phase'    => 'prepare_remote',
                'batched'  => true,
                'continue' => true,
                'progress' => $progress,
            ];
        }

        $this->engine->clear_sync_transients();
        $state['phase'] = 'sync_local';
        $state['page'] = 1;
        $state['per_page'] = max(1, (int) ($state['per_page'] ?? 50));
        Sync_Lock::set_job_state($job_id, $state);
        Sync_Lock::refresh_active_job($job_id, 'full_sync');

        $progress = Sync_Lock::update_progress($job_id, [
            'status'       => 'running',
            'mode'         => $mode_key,
            'mode_label'   => $mode_label,
            'message'      => __('การเตรียมข้อมูลฝั่งเซิร์ฟเวอร์เสร็จแล้ว กำลังเริ่มนำเข้าข้อมูลใน WordPress...', '7ls-video-publisher'),
            'percent'      => self::FULL_SYNC_LOCAL_PROGRESS_MIN,
            'current_item' => '',
            'pending_items' => [],
        ]);

        return [
            'job_id'   => $job_id,
            'phase'    => 'sync_local',
            'batched'  => true,
            'continue' => true,
            'progress' => $progress,
        ];
    }

    /**
     * @param array<string, mixed> $state
     * @return array<string, mixed>|\WP_Error
     */
    private function process_local_sync_batch(string $job_id, array $state): array|\WP_Error {
        $batch = $this->engine->sync_batch([
            'full_sync'            => true,
            'bypass_cache'         => true,
            'page'                 => max(1, (int) ($state['page'] ?? 1)),
            'per_page'             => max(1, (int) ($state['per_page'] ?? 50)),
            'processed'            => max(0, (int) ($state['processed'] ?? 0)),
            'created'              => max(0, (int) ($state['created'] ?? 0)),
            'updated'              => max(0, (int) ($state['updated'] ?? 0)),
            'errors'               => max(0, (int) ($state['errors'] ?? 0)),
            'recent_results'       => isset($state['recent_results']) && is_array($state['recent_results']) ? $state['recent_results'] : [],
            'error_items'          => isset($state['error_items']) && is_array($state['error_items']) ? $state['error_items'] : [],
            'total_items'          => $state['total_items'] ?? null,
            'total_pages'          => $state['total_pages'] ?? null,
            'progress_job_id'      => $job_id,
            'progress_min_percent' => self::FULL_SYNC_LOCAL_PROGRESS_MIN,
            'progress_max_percent' => self::FULL_SYNC_LOCAL_PROGRESS_MAX,
        ]);

        if (is_wp_error($batch)) {
            Logger::log("Full sync local batch failed: {$batch->get_error_message()}", 'error');

            return $this->fail_batch_job($job_id, $batch->get_error_message());
        }

        $state['phase'] = 'sync_local';
        $state['page'] = !empty($batch['has_more']) ? max(1, (int) ($batch['next_page'] ?? 1)) : max(1, (int) ($batch['page'] ?? ($state['page'] ?? 1)));
        $state['per_page'] = max(1, (int) ($batch['per_page'] ?? ($state['per_page'] ?? 50)));
        $state['processed'] = max(0, (int) ($batch['processed'] ?? 0));
        $state['created'] = max(0, (int) ($batch['created'] ?? 0));
        $state['updated'] = max(0, (int) ($batch['updated'] ?? 0));
        $state['errors'] = max(0, (int) ($batch['errors'] ?? 0));
        $state['total_items'] = isset($batch['total_items']) ? $batch['total_items'] : null;
        $state['total_pages'] = isset($batch['total_pages']) ? $batch['total_pages'] : null;
        $state['recent_results'] = isset($batch['recent_results']) && is_array($batch['recent_results']) ? $batch['recent_results'] : [];
        $state['error_items'] = isset($batch['error_items']) && is_array($batch['error_items']) ? $batch['error_items'] : [];

        if (!empty($batch['has_more'])) {
            Sync_Lock::set_job_state($job_id, $state);
            Sync_Lock::refresh_active_job($job_id, 'full_sync');

            return [
                'job_id'   => $job_id,
                'phase'    => 'sync_local',
                'batched'  => true,
                'continue' => true,
                'progress' => Sync_Lock::get_progress($job_id),
            ];
        }

        $duration = round(microtime(true) - (float) ($state['started_at_micro'] ?? microtime(true)), 2);
        $summary = [
            'processed' => $state['processed'],
            'created'   => $state['created'],
            'updated'   => $state['updated'],
            'errors'    => $state['errors'],
            'duration'  => $duration,
        ];

        update_option('sevenls_vp_last_sync', current_time('mysql'));
        update_option('sevenls_vp_last_full_sync', current_time('mysql'));

        Logger::log(sprintf(
            'Batched full sync completed: %d processed (%d created, %d updated, %d errors) in %.2fs',
            $summary['processed'],
            $summary['created'],
            $summary['updated'],
            $summary['errors'],
            $summary['duration']
        ));

        $this->complete_progress($job_id, __('ซิงก์ข้อมูลทั้งหมดเสร็จแล้ว', '7ls-video-publisher'), $summary);
        Sync_Lock::clear_job_state($job_id);
        Sync_Lock::release_active_job($job_id);

        return [
            'job_id'   => $job_id,
            'phase'    => 'completed',
            'batched'  => true,
            'continue' => false,
            'result'   => $summary,
            'progress' => Sync_Lock::get_progress($job_id),
            'message'  => __('ซิงก์ข้อมูลทั้งหมดเสร็จแล้ว', '7ls-video-publisher'),
        ];
    }

    /**
     * @param mixed $totals
     * @return array{scanned: int, discovered: int, created: int, updated: int, skipped: int}
     */
    private function normalize_remote_totals(mixed $totals): array {
        if (!is_array($totals)) {
            $totals = [];
        }

        return [
            'scanned'    => max(0, (int) ($totals['scanned'] ?? 0)),
            'discovered' => max(0, (int) ($totals['discovered'] ?? 0)),
            'created'    => max(0, (int) ($totals['created'] ?? 0)),
            'updated'    => max(0, (int) ($totals['updated'] ?? 0)),
            'skipped'    => max(0, (int) ($totals['skipped'] ?? 0)),
        ];
    }

    private function build_remote_prepare_percent(int $batch_number, bool $completed): int {
        if ($completed) {
            return self::FULL_SYNC_LOCAL_PROGRESS_MIN;
        }

        return min(self::FULL_SYNC_LOCAL_PROGRESS_MIN - 1, 6 + (($batch_number - 1) * 4));
    }

    private function fail_batch_job(string $job_id, string $message): \WP_Error {
        Sync_Lock::clear_job_state($job_id);
        Sync_Lock::release_active_job($job_id);
        $this->fail_progress($job_id, $message);

        return new \WP_Error('sync_batch_failed', $message);
    }

    private function ensure_no_competing_active_job(?string $allowed_job_id = null): ?\WP_Error {
        $active_job = Sync_Lock::get_active_job();

        if (!is_array($active_job)) {
            return null;
        }

        $active_job_id = sanitize_key((string) ($active_job['job_id'] ?? ''));
        if ($active_job_id === '') {
            return null;
        }

        $active_operation = sanitize_key((string) ($active_job['operation'] ?? ''));
        $active_state = Sync_Lock::get_job_state($active_job_id);
        $active_progress = Sync_Lock::get_progress($active_job_id);
        $active_status = is_array($active_progress) ? sanitize_key((string) ($active_progress['status'] ?? '')) : '';

        if (
            !Sync_Lock::is_locked()
            && (
                ($active_operation === 'full_sync' && !is_array($active_state))
                || in_array($active_status, ['completed', 'error'], true)
            )
        ) {
            Sync_Lock::release_active_job($active_job_id);
            return null;
        }

        if ($allowed_job_id !== null && sanitize_key($allowed_job_id) === $active_job_id) {
            return null;
        }

        return new \WP_Error('sync_locked', __('มีงานซิงก์อื่นอยู่ในคิวหรือกำลังทำงานอยู่ กรุณารอสักครู่', '7ls-video-publisher'));
    }

    private function get_local_sync_batch_size(): int {
        $settings = get_option('sevenls_vp_settings', []);
        $batch_size = isset($settings['sync_batch_size']) ? (int) $settings['sync_batch_size'] : 100;

        return max(10, min(250, $batch_size));
    }

    /**
     * @param array<string, mixed> $summary
     */
    private function complete_progress(?string $progress_job_id, string $message, array $summary): void {
        if ($progress_job_id === null || $progress_job_id === '') {
            return;
        }

        Sync_Lock::complete_progress($progress_job_id, [
            'message'  => $message,
            'processed'=> $summary['processed'] ?? 0,
            'completed_items' => $summary['processed'] ?? 0,
            'handled'  => ($summary['processed'] ?? 0) + ($summary['errors'] ?? 0),
            'created'  => $summary['created'] ?? 0,
            'updated'  => $summary['updated'] ?? 0,
            'errors'   => $summary['errors'] ?? 0,
            'duration' => $summary['duration'] ?? null,
            'current_item' => '',
            'pending_items' => [],
        ]);
    }

    private function fail_progress(?string $progress_job_id, string $message): void {
        if ($progress_job_id === null || $progress_job_id === '') {
            return;
        }

        Sync_Lock::fail_progress($progress_job_id, $message);
    }

    /**
     * @param array<string, mixed> $state
     */
    private function update_progress(?string $progress_job_id, array $state): void {
        if ($progress_job_id === null || $progress_job_id === '') {
            return;
        }

        Sync_Lock::update_progress($progress_job_id, $state);
    }

    // ─── Retry helper ───────────────────────────────────────

    /**
     * Execute a callable with exponential-backoff retries.
     * Client errors (4xx) are NOT retried.
     *
     * @param  callable $fn           Must return a value or WP_Error.
     * @param  int      $max_attempts Maximum number of attempts.
     * @return mixed
     */
    private function with_retry(callable $fn, int $max_attempts = self::MAX_RETRIES): mixed {
        $last_error = null;

        for ($attempt = 1; $attempt <= $max_attempts; $attempt++) {
            $result = $fn();

            if (!is_wp_error($result)) {
                return $result;
            }

            $last_error = $result;
            $code = $result->get_error_code();

            // Don't retry client-side errors
            $no_retry_codes = ['unauthorized', 'forbidden', 'not_found', 'validation_error', 'api_not_configured'];
            if (in_array($code, $no_retry_codes, true)) {
                return $result;
            }

            if ($attempt < $max_attempts) {
                $delay = self::RETRY_BASE_DELAY ** $attempt; // 2, 4, 8 …
                Logger::log(
                    "Retry {$attempt}/{$max_attempts} after {$delay}s: {$result->get_error_message()}",
                    'warning'
                );
                sleep($delay);
            }
        }

        return $last_error;
    }
}
