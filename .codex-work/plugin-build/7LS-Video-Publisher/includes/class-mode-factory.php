<?php
namespace SevenLS_VP;

/**
 * Mode Factory
 *
 * Creates the correct Mode_Strategy instance based on the
 * current site configuration or an explicit mode key.
 */
class Mode_Factory {

    /** @var array<string, class-string<Mode_Strategy>> */
    private static array $strategies = [
        'thai_clip' => Thai_Clip_Strategy::class,
        'av_movie'  => AV_Movie_Strategy::class,
    ];

    /**
     * Create a strategy for the given mode (or current site mode).
     *
     * @param  string|null $mode Explicit mode key, or null to read from options.
     * @return Mode_Strategy
     * @throws \InvalidArgumentException When mode is unknown.
     */
    public static function create(?string $mode = null): Mode_Strategy {
        if ($mode === null) {
            $settings = get_option('sevenls_vp_settings', []);
            $mode = $settings['content_mode'] ?? 'thai_clip';
        }

        $class = self::$strategies[$mode] ?? null;

        if ($class === null) {
            throw new \InvalidArgumentException("Unknown content mode: {$mode}");
        }

        return new $class();
    }

    /**
     * All available modes for the settings dropdown.
     *
     * @return array<string, string> mode_key => label
     */
    public static function get_available_modes(): array {
        return [
            'thai_clip' => 'คลิปไทย',
            'av_movie'  => 'หนัง AV',
        ];
    }

    /**
     * Check whether a mode key is valid.
     */
    public static function is_valid_mode(string $mode): bool {
        return isset(self::$strategies[$mode]);
    }
}
