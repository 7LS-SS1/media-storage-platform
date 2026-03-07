<?php
namespace SevenLS_VP;

/**
 * Logger Class
 * 
 * Simple logging system using WordPress options
 */
class Logger {
    
    private const OPTION_KEY = 'sevenls_vp_logs';
    private const MAX_LOGS = 100;
    
    /**
     * Log a message
     * 
     * @param string $message Log message
     * @param string $level Log level (info, warning, error)
     */
    public static function log(string $message, string $level = 'info'): void {
        $settings = get_option('sevenls_vp_settings', []);
        
        if (!($settings['logging_enabled'] ?? true)) {
            return;
        }
        
        $logs = get_option(self::OPTION_KEY, []);
        
        $log_entry = [
            'timestamp' => current_time('mysql'),
            'level' => $level,
            'message' => $message
        ];
        
        array_unshift($logs, $log_entry);
        
        // Keep only last N logs
        $logs = array_slice($logs, 0, self::MAX_LOGS);
        
        update_option(self::OPTION_KEY, $logs);
    }
    
    /**
     * Get all logs
     * 
     * @return array Array of log entries
     */
    public static function get_logs(): array {
        return get_option(self::OPTION_KEY, []);
    }
    
    /**
     * Clear all logs
     */
    public static function clear_logs(): void {
        update_option(self::OPTION_KEY, []);
    }
    
    /**
     * Clean old logs based on retention policy
     */
    public static function clean_old_logs(): void {
        $settings = get_option('sevenls_vp_settings', []);
        $retention_days = absint($settings['log_retention_days'] ?? 30);
        
        if ($retention_days === 0) {
            return;
        }
        
        $logs = self::get_logs();
        $cutoff_date = date('Y-m-d H:i:s', strtotime("-{$retention_days} days"));
        
        $filtered_logs = array_filter($logs, function($log) use ($cutoff_date) {
            return $log['timestamp'] >= $cutoff_date;
        });
        
        update_option(self::OPTION_KEY, array_values($filtered_logs));
    }
}