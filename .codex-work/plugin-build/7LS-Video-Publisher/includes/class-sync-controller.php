<?php
namespace SevenLS_VP;

/**
 * Sync Controller
 *
 * High-level orchestrator exposing the three main operations:
 *   1. test_api_connect()     — verify connectivity & token
 *   2. update_new_videos()    — incremental rolling-24 h sync
 *   3. initial_full_update()  — force full sync (no cache)
 *
 * All operations are mode-aware via Mode_Strategy and protected
 * by Sync_Lock to prevent concurrent execution.
 */
class Sync_Controller {

    private API_Client    $api;
    private Sync_Engine   $engine;
    private Mode_Strategy $strategy;

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
    public function update_new_videos(): array|\WP_Error {
        if (!Sync_Lock::acquire()) {
            return new \WP_Error('sync_locked', 'Another sync is already running. Please wait.');
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

            $mode_key = $this->strategy->get_mode_key();
            Logger::log("update_new_videos: since={$since}, mode={$mode_key}");

            $result = $this->engine->sync([
                'since'        => $since,
                'full_sync'    => false,
                'bypass_cache' => true,
            ]);

            if (is_wp_error($result)) {
                Logger::log("update_new_videos failed: {$result->get_error_message()}", 'error');
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

            return $result;

        } finally {
            Sync_Lock::release();
        }
    }

    // ─── 3. Initial Full Update (Force) ─────────────────────

    /**
     * Full sync: optionally trigger server-side preparation, clear caches,
     * then fetch ALL videos ignoring last_sync timestamp.
     *
     * @return array|\WP_Error Sync summary or error.
     */
    public function initial_full_update(): array|\WP_Error {
        if (!Sync_Lock::acquire()) {
            return new \WP_Error('sync_locked', 'Another sync is already running. Please wait.');
        }

        try {
            $mode_key = $this->strategy->get_mode_key();
            Logger::log("initial_full_update started (mode: {$mode_key})");

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
            }

            // 2) Clear all page transient caches
            $this->engine->clear_sync_transients();

            // 3) Run full sync — no since, no cache
            $result = $this->engine->sync([
                'full_sync'    => true,
                'bypass_cache' => true,
            ]);

            if (is_wp_error($result)) {
                Logger::log("initial_full_update failed: {$result->get_error_message()}", 'error');
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

            return $result;

        } finally {
            Sync_Lock::release();
        }
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
