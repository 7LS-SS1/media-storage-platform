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
            'message'    => __('Preparing incremental sync...', '7ls-video-publisher'),
            'percent'    => 2,
        ]);

        if (!Sync_Lock::acquire()) {
            $error = new \WP_Error('sync_locked', 'Another sync is already running. Please wait.');
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
                'message' => __('Syncing videos from the rolling 24-hour window...', '7ls-video-publisher'),
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

            $this->complete_progress($progress_job_id, __('Incremental sync completed.', '7ls-video-publisher'), $result);

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
            'message'    => __('Preparing force sync for the last 2 days...', '7ls-video-publisher'),
            'percent'    => 2,
        ]);

        if (!Sync_Lock::acquire()) {
            $error = new \WP_Error('sync_locked', 'Another sync is already running. Please wait.');
            $this->fail_progress($progress_job_id, $error->get_error_message());
            return $error;
        }

        try {
            $current_ts = (int) current_time('timestamp', true);
            $since_ts   = max(0, $current_ts - self::FORCE_RECENT_WINDOW_SECONDS);
            $since      = gmdate('Y-m-d\TH:i:s\Z', $since_ts);

            Logger::log("force_recent_videos_update: since={$since}, mode={$mode_key}");

            $this->update_progress($progress_job_id, [
                'message' => __('Force syncing videos from the last 48 hours...', '7ls-video-publisher'),
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

            $this->complete_progress($progress_job_id, __('Force sync for the last 2 days completed.', '7ls-video-publisher'), $result);

            return $result;

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
            'message'    => __('Preparing full sync...', '7ls-video-publisher'),
            'percent'    => 2,
        ]);

        if (!Sync_Lock::acquire()) {
            $error = new \WP_Error('sync_locked', 'Another sync is already running. Please wait.');
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
                    'message' => __('Server-side preparation failed. Continuing with full sync...', '7ls-video-publisher'),
                    'percent' => 10,
                ]);
            } else {
                $this->update_progress($progress_job_id, [
                    'message' => __('Server-side preparation completed.', '7ls-video-publisher'),
                    'percent' => 10,
                ]);
            }

            // 2) Clear all page transient caches
            $this->update_progress($progress_job_id, [
                'message' => __('Clearing cached sync pages...', '7ls-video-publisher'),
                'percent' => 12,
            ]);
            $this->engine->clear_sync_transients();

            // 3) Run full sync — no since, no cache
            $this->update_progress($progress_job_id, [
                'message' => __('Running full sync across all videos...', '7ls-video-publisher'),
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

            $this->complete_progress($progress_job_id, __('Full sync completed.', '7ls-video-publisher'), $result);

            return $result;

        } finally {
            Sync_Lock::release();
        }
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
