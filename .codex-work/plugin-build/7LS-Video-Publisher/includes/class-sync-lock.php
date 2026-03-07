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
}
