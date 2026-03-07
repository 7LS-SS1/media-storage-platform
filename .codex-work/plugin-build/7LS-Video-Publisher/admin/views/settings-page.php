<?php
/**
 * Modern Settings Page View
 */

if (!defined('ABSPATH')) {
    exit;
}

$last_sync = get_option('sevenls_vp_last_sync');
$last_full_sync = get_option('sevenls_vp_last_full_sync');
$last_api_update = get_option('sevenls_vp_last_api_update');
$last_connection_test = get_option('sevenls_vp_last_connection_test');
$active_tab = isset($_GET['tab']) ? sanitize_key(wp_unslash($_GET['tab'])) : 'settings';

// Current mode info
$settings_data = get_option('sevenls_vp_settings', []);
$current_mode_key = $settings_data['content_mode'] ?? 'thai_clip';
$mode_labels = SevenLS_VP\Mode_Factory::get_available_modes();
$current_mode_label = $mode_labels[$current_mode_key] ?? $current_mode_key;
$current_theme_profile = \SevenLS_VP\Site_Profile::get_label();
$tabs = [
    'settings' => [
        'label' => __('API Settings', '7ls-video-publisher'),
        'icon' => '⚙️',
    ],
    'updates' => [
        'label' => __('Updates', '7ls-video-publisher'),
        'icon' => '🔄',
    ],
];

if (!array_key_exists($active_tab, $tabs)) {
    $active_tab = 'settings';
}
?>

<div class="sevenls-vp-wrapper">
    <div class="sevenls-vp-header">
        <h1 class="sevenls-vp-header-title">
            🎬 <?php esc_html_e('Video Publisher', '7ls-video-publisher'); ?>
        </h1>
        <p class="sevenls-vp-header-subtitle">
            <?php esc_html_e('Manage your video content with ease and power', '7ls-video-publisher'); ?>
        </p>
    </div>

    <div class="sevenls-vp-tabs">
        <?php foreach ($tabs as $tab_key => $tab_data) : ?>
            <?php
            $tab_url = admin_url('admin.php?page=sevenls-video-publisher&tab=' . $tab_key);
            $tab_class = $active_tab === $tab_key ? 'sevenls-vp-tab is-active' : 'sevenls-vp-tab';
            ?>
            <a href="<?php echo esc_url($tab_url); ?>" class="<?php echo esc_attr($tab_class); ?>">
                <span class="sevenls-vp-tab-icon"><?php echo esc_html($tab_data['icon']); ?></span>
                <span class="sevenls-vp-tab-label"><?php echo esc_html($tab_data['label']); ?></span>
            </a>
        <?php endforeach; ?>
    </div>

    <?php if ($active_tab === 'updates') : ?>
        <!-- Current Mode Banner -->
        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    🎯 <?php esc_html_e('Current Mode', '7ls-video-publisher'); ?>
                </h2>
                <span class="sevenls-vp-status-badge sevenls-vp-status-info">
                    <?php echo esc_html($current_mode_label); ?>
                </span>
            </div>
            <p style="margin: 0; color: #666;">
                <?php
                printf(
                    esc_html__('All sync operations below will use the "%1$s" mode with the "%2$s" site profile. Change these options in the API Settings tab.', '7ls-video-publisher'),
                    esc_html($current_mode_label),
                    esc_html($current_theme_profile)
                );
                ?>
            </p>
        </div>

        <!-- Test API Connection -->
        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    🔌 <?php esc_html_e('Test API Connection', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('Verify API connectivity and token validity', '7ls-video-publisher'); ?>">?</span>
                </h2>
                <?php if ($last_connection_test) : ?>
                    <span class="sevenls-vp-status-badge sevenls-vp-status-success">
                        ✓ <?php esc_html_e('Connected', '7ls-video-publisher'); ?>
                    </span>
                <?php endif; ?>
            </div>
            <div class="sevenls-vp-progress" aria-hidden="true">
                <span class="sevenls-vp-progress-bar"></span>
            </div>

            <?php if ($last_connection_test) : ?>
                <div class="sevenls-vp-info-grid">
                    <div class="sevenls-vp-info-item">
                        <div class="sevenls-vp-info-label">
                            <?php esc_html_e('Last Test', '7ls-video-publisher'); ?>
                        </div>
                        <div class="sevenls-vp-info-value">
                            🕒 <?php echo esc_html($last_connection_test); ?>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <div class="sevenls-vp-actions">
                <form method="post" class="sevenls-vp-inline-form">
                    <?php wp_nonce_field('sevenls_vp_test_connection'); ?>
                    <button type="submit" name="sevenls_vp_test_connection" class="sevenls-vp-btn sevenls-vp-btn-secondary">
                        <span>🔌</span>
                        <span><?php echo esc_html__('Test Connection', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
            </div>
        </div>

        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    📹 <?php esc_html_e('Update Latest/New Videos', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('Sync new or recently updated videos from your library', '7ls-video-publisher'); ?>">?</span>
                </h2>
                <?php if ($last_sync) : ?>
                    <span class="sevenls-vp-status-badge sevenls-vp-status-info">
                        📊 <?php esc_html_e('Synced', '7ls-video-publisher'); ?>
                    </span>
                <?php endif; ?>
            </div>
            <div class="sevenls-vp-progress" aria-hidden="true">
                <span class="sevenls-vp-progress-bar"></span>
            </div>

            <?php if ($last_sync) : ?>
                <div class="sevenls-vp-info-grid">
                    <div class="sevenls-vp-info-item">
                        <div class="sevenls-vp-info-label">
                            <?php esc_html_e('Last Sync', '7ls-video-publisher'); ?>
                        </div>
                        <div class="sevenls-vp-info-value">
                            🕒 <?php echo esc_html($last_sync); ?>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <div class="sevenls-vp-actions">
                <form method="post" class="sevenls-vp-inline-form">
                    <?php wp_nonce_field('sevenls_vp_manual_sync'); ?>
                    <button type="submit" name="sevenls_vp_manual_sync" class="sevenls-vp-btn sevenls-vp-btn-primary">
                        <span>⚡</span>
                        <span><?php echo esc_html__('Update Latest/New Videos', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
            </div>
        </div>

        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    🔁 <?php esc_html_e('Update All Videos', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('Resync all videos (ignores last sync)', '7ls-video-publisher'); ?>">?</span>
                </h2>
                <?php if ($last_full_sync) : ?>
                    <span class="sevenls-vp-status-badge sevenls-vp-status-info">
                        📚 <?php esc_html_e('Full Sync', '7ls-video-publisher'); ?>
                    </span>
                <?php endif; ?>
            </div>
            <div class="sevenls-vp-progress" aria-hidden="true">
                <span class="sevenls-vp-progress-bar"></span>
            </div>

            <?php if ($last_full_sync) : ?>
                <div class="sevenls-vp-info-grid">
                    <div class="sevenls-vp-info-item">
                        <div class="sevenls-vp-info-label">
                            <?php esc_html_e('Last Full Sync', '7ls-video-publisher'); ?>
                        </div>
                        <div class="sevenls-vp-info-value">
                            🕒 <?php echo esc_html($last_full_sync); ?>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <div class="sevenls-vp-actions">
                <form method="post" class="sevenls-vp-inline-form">
                    <?php wp_nonce_field('sevenls_vp_full_sync'); ?>
                    <button type="submit" name="sevenls_vp_full_sync" class="sevenls-vp-btn sevenls-vp-btn-secondary" onclick="return confirm('<?php esc_attr_e('This will force re-sync ALL videos. Continue?', '7ls-video-publisher'); ?>');">
                        <span>🔁</span>
                        <span><?php echo esc_html__('Full Sync (Force)', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
            </div>
        </div>
    <?php else : ?>
        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    ⚙️ <?php esc_html_e('API Configuration', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('Configure your API connection settings', '7ls-video-publisher'); ?>">?</span>
                </h2>
            </div>
            <div class="sevenls-vp-progress" aria-hidden="true">
                <span class="sevenls-vp-progress-bar"></span>
            </div>

            <form method="post" action="options.php">
                <?php
                settings_fields('sevenls_vp_settings_group');
                do_settings_sections('sevenls-video-publisher');
                ?>
                <div class="sevenls-vp-actions">
                    <button type="submit" class="sevenls-vp-btn sevenls-vp-btn-primary">
                        <span>💾</span>
                        <span><?php echo esc_html__('Save Settings', '7ls-video-publisher'); ?></span>
                    </button>
                </div>
            </form>
        </div>

        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    📝 <?php esc_html_e('Usage Guide', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('Learn how to use shortcodes and CLI commands', '7ls-video-publisher'); ?>">?</span>
                </h2>
            </div>

            <h3 class="sevenls-vp-section-title">
                🎯 <?php esc_html_e('Shortcodes', '7ls-video-publisher'); ?>
            </h3>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="<?php echo esc_attr('[sevenls_video id="EXTERNAL_ID"]'); ?>">
                    📋 Copy
                </button>
                <code>[sevenls_video id="EXTERNAL_ID"]</code>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="<?php echo esc_attr('[sevenls_video_post id="POST_ID"]'); ?>">
                    📋 Copy
                </button>
                <code>[sevenls_video_post id="POST_ID"]</code>
            </div>

            <h3 class="sevenls-vp-section-title sevenls-vp-section-title-spaced">
                💻 <?php esc_html_e('WP-CLI Commands', '7ls-video-publisher'); ?>
            </h3>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp sync">
                    📋 Copy
                </button>
                <code>wp sevenls-vp sync</code>
                <small style="color:#888; margin-left:8px;"><?php esc_html_e('Incremental sync (rolling 24h)', '7ls-video-publisher'); ?></small>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp full-sync --yes">
                    📋 Copy
                </button>
                <code>wp sevenls-vp full-sync --yes</code>
                <small style="color:#888; margin-left:8px;"><?php esc_html_e('Force full sync', '7ls-video-publisher'); ?></small>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp test-connection">
                    📋 Copy
                </button>
                <code>wp sevenls-vp test-connection</code>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp mode">
                    📋 Copy
                </button>
                <code>wp sevenls-vp mode</code>
                <small style="color:#888; margin-left:8px;"><?php esc_html_e('Show current mode', '7ls-video-publisher'); ?></small>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp mode --set=av_movie">
                    📋 Copy
                </button>
                <code>wp sevenls-vp mode --set=av_movie</code>
                <small style="color:#888; margin-left:8px;"><?php esc_html_e('Change mode', '7ls-video-publisher'); ?></small>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp stats">
                    📋 Copy
                </button>
                <code>wp sevenls-vp stats</code>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp clear-logs">
                    📋 Copy
                </button>
                <code>wp sevenls-vp clear-logs</code>
            </div>
        </div>
    <?php endif; ?>
</div>
