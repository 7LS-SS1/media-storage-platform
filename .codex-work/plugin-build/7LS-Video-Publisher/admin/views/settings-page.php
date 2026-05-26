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
                <form method="post" class="sevenls-vp-inline-form sevenls-vp-sync-form" data-sync-action="manual_sync" data-sync-label="<?php echo esc_attr__('Update Latest/New Videos', '7ls-video-publisher'); ?>">
                    <?php wp_nonce_field('sevenls_vp_manual_sync'); ?>
                    <button type="submit" name="sevenls_vp_manual_sync" class="sevenls-vp-btn sevenls-vp-btn-primary">
                        <span>⚡</span>
                        <span><?php echo esc_html__('Update Latest/New Videos', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
                <form method="post" class="sevenls-vp-inline-form sevenls-vp-sync-form" data-sync-action="force_recent_sync" data-sync-label="<?php echo esc_attr__('Force Latest 2 Days', '7ls-video-publisher'); ?>" data-confirm="<?php echo esc_attr__('This will force re-sync videos from the last 2 days only. Continue?', '7ls-video-publisher'); ?>">
                    <?php wp_nonce_field('sevenls_vp_force_recent_sync'); ?>
                    <button type="submit" name="sevenls_vp_force_recent_sync" class="sevenls-vp-btn sevenls-vp-btn-secondary">
                        <span>🕑</span>
                        <span><?php echo esc_html__('Force Latest 2 Days', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
            </div>
            <p class="description"><?php esc_html_e('Force only re-syncs videos from the last 2 days based on the current date and time. It does not run a full sync.', '7ls-video-publisher'); ?></p>
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
                <form method="post" class="sevenls-vp-inline-form sevenls-vp-sync-form" data-sync-action="full_sync" data-sync-label="<?php echo esc_attr__('Full Sync (Force)', '7ls-video-publisher'); ?>" data-confirm="<?php echo esc_attr__('This will force re-sync ALL videos. Continue?', '7ls-video-publisher'); ?>">
                    <?php wp_nonce_field('sevenls_vp_full_sync'); ?>
                    <button type="submit" name="sevenls_vp_full_sync" class="sevenls-vp-btn sevenls-vp-btn-secondary">
                        <span>🔁</span>
                        <span><?php echo esc_html__('Full Sync (Force)', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
            </div>
        </div>

        <div class="sevenls-vp-sync-modal" data-sync-modal hidden>
            <div class="sevenls-vp-sync-modal__backdrop" data-sync-modal-close></div>
            <div class="sevenls-vp-sync-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="sevenls-vp-sync-modal-title">
                <div class="sevenls-vp-sync-modal__header">
                    <div>
                        <p class="sevenls-vp-sync-modal__eyebrow"><?php esc_html_e('Update Progress', '7ls-video-publisher'); ?></p>
                        <h2 class="sevenls-vp-sync-modal__title" id="sevenls-vp-sync-modal-title" data-sync-modal-title><?php esc_html_e('Preparing sync...', '7ls-video-publisher'); ?></h2>
                    </div>
                    <button type="button" class="sevenls-vp-sync-modal__close" data-sync-modal-close aria-label="<?php esc_attr_e('Close modal', '7ls-video-publisher'); ?>" disabled>&times;</button>
                </div>

                <div class="sevenls-vp-sync-modal__status-row">
                    <span class="sevenls-vp-sync-modal__status sevenls-vp-sync-modal__status--queued" data-sync-modal-status><?php esc_html_e('Queued', '7ls-video-publisher'); ?></span>
                    <span class="sevenls-vp-sync-modal__percent" data-sync-modal-percent>0%</span>
                </div>

                <p class="sevenls-vp-sync-modal__message" data-sync-modal-message><?php esc_html_e('Preparing sync...', '7ls-video-publisher'); ?></p>

                <div class="sevenls-vp-sync-modal__alert sevenls-vp-sync-modal__alert--info" data-sync-modal-alert hidden>
                    <span data-sync-modal-alert-text><?php esc_html_e('Sync is in progress.', '7ls-video-publisher'); ?></span>
                </div>

                <div class="sevenls-vp-sync-modal__progress" aria-hidden="true">
                    <span class="sevenls-vp-sync-modal__progress-bar" data-sync-modal-progress></span>
                </div>

                <div class="sevenls-vp-sync-modal__stats">
                    <div class="sevenls-vp-sync-modal__stat">
                        <span class="sevenls-vp-sync-modal__stat-value" data-sync-modal-completed>0</span>
                        <span class="sevenls-vp-sync-modal__stat-label"><?php esc_html_e('Completed', '7ls-video-publisher'); ?></span>
                    </div>
                    <div class="sevenls-vp-sync-modal__stat">
                        <span class="sevenls-vp-sync-modal__stat-value" data-sync-modal-created>0</span>
                        <span class="sevenls-vp-sync-modal__stat-label"><?php esc_html_e('Created', '7ls-video-publisher'); ?></span>
                    </div>
                    <div class="sevenls-vp-sync-modal__stat">
                        <span class="sevenls-vp-sync-modal__stat-value" data-sync-modal-updated>0</span>
                        <span class="sevenls-vp-sync-modal__stat-label"><?php esc_html_e('Updated', '7ls-video-publisher'); ?></span>
                    </div>
                    <div class="sevenls-vp-sync-modal__stat">
                        <span class="sevenls-vp-sync-modal__stat-value" data-sync-modal-errors>0</span>
                        <span class="sevenls-vp-sync-modal__stat-label"><?php esc_html_e('Errors', '7ls-video-publisher'); ?></span>
                    </div>
                </div>

                <div class="sevenls-vp-sync-modal__meta">
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('Current Item', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-current-item>&mdash;</span>
                    </div>
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('Page', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-page>&mdash;</span>
                    </div>
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('Total Videos', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-total>&mdash;</span>
                    </div>
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('Mode', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-mode>&mdash;</span>
                    </div>
                </div>

                <div class="sevenls-vp-sync-modal__lists">
                    <div class="sevenls-vp-sync-modal__list-card">
                        <div class="sevenls-vp-sync-modal__list-header">
                            <h3 class="sevenls-vp-sync-modal__list-title"><?php esc_html_e('Prepared for Update', '7ls-video-publisher'); ?></h3>
                            <span class="sevenls-vp-sync-modal__list-count" data-sync-modal-pending-count>0</span>
                        </div>
                        <ul class="sevenls-vp-sync-modal__list" data-sync-modal-pending-list>
                            <li class="sevenls-vp-sync-modal__list-empty"><?php esc_html_e('No pending items yet.', '7ls-video-publisher'); ?></li>
                        </ul>
                    </div>

                    <div class="sevenls-vp-sync-modal__list-card">
                        <div class="sevenls-vp-sync-modal__list-header">
                            <h3 class="sevenls-vp-sync-modal__list-title"><?php esc_html_e('Updated Items', '7ls-video-publisher'); ?></h3>
                            <span class="sevenls-vp-sync-modal__list-count" data-sync-modal-results-count>0</span>
                        </div>
                        <ul class="sevenls-vp-sync-modal__list" data-sync-modal-results-list>
                            <li class="sevenls-vp-sync-modal__list-empty"><?php esc_html_e('No completed items yet.', '7ls-video-publisher'); ?></li>
                        </ul>
                    </div>
                </div>

                <div class="sevenls-vp-sync-modal__list-card sevenls-vp-sync-modal__list-card--error" data-sync-modal-errors-wrap hidden>
                    <div class="sevenls-vp-sync-modal__list-header">
                        <h3 class="sevenls-vp-sync-modal__list-title"><?php esc_html_e('Error Details', '7ls-video-publisher'); ?></h3>
                        <span class="sevenls-vp-sync-modal__list-count" data-sync-modal-errors-count>0</span>
                    </div>
                    <ul class="sevenls-vp-sync-modal__list" data-sync-modal-errors-list>
                        <li class="sevenls-vp-sync-modal__list-empty"><?php esc_html_e('No errors.', '7ls-video-publisher'); ?></li>
                    </ul>
                </div>

                <div class="sevenls-vp-sync-modal__footer">
                    <button type="button" class="sevenls-vp-btn sevenls-vp-btn-secondary" data-sync-modal-close-button disabled><?php esc_html_e('Close', '7ls-video-publisher'); ?></button>
                </div>
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
