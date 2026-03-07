<?php
/**
 * Logs Page View
 */

if (!defined('ABSPATH')) {
    exit;
}

$logs = SevenLS_VP\Logger::get_logs();
?>

<div class="wrap">
    <h1><?php esc_html_e('Video Publisher Logs', '7ls-video-publisher'); ?></h1>

    <div class="sevenls-vp-actions">
        <form method="post">
            <?php wp_nonce_field('sevenls_vp_clear_logs'); ?>
            <input
                type="submit"
                name="sevenls_vp_clear_logs"
                class="button"
                value="<?php echo esc_attr__('Clear Logs', '7ls-video-publisher'); ?>"
            />
        </form>
    </div>

    <?php if (empty($logs)) : ?>
        <p><?php esc_html_e('No logs available.', '7ls-video-publisher'); ?></p>
    <?php else : ?>
        <table class="widefat striped">
            <thead>
                <tr>
                    <th><?php esc_html_e('Time', '7ls-video-publisher'); ?></th>
                    <th><?php esc_html_e('Level', '7ls-video-publisher'); ?></th>
                    <th><?php esc_html_e('Message', '7ls-video-publisher'); ?></th>
                </tr>
            </thead>
            <tbody>
                <?php foreach ($logs as $log) : ?>
                    <?php
                    $level = isset($log['level']) ? sanitize_key($log['level']) : 'info';
                    $level_class = in_array($level, ['info', 'warning', 'error'], true) ? $level : 'info';
                    $timestamp = $log['timestamp'] ?? '';
                    $display_time = $timestamp ? date_i18n(
                        get_option('date_format') . ' ' . get_option('time_format'),
                        strtotime($timestamp)
                    ) : '';
                    $message = $log['message'] ?? '';
                    ?>
                    <tr>
                        <td><?php echo esc_html($display_time ?: $timestamp); ?></td>
                        <td>
                            <span class="sevenls-vp-log-level sevenls-vp-log-<?php echo esc_attr($level_class); ?>">
                                <?php echo esc_html($level_class); ?>
                            </span>
                        </td>
                        <td><?php echo esc_html($message); ?></td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>
