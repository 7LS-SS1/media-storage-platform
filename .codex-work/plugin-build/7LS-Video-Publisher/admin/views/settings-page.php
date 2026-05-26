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
        'label' => __('ตั้งค่า API', '7ls-video-publisher'),
        'icon' => '⚙️',
    ],
    'updates' => [
        'label' => __('อัปเดตข้อมูล', '7ls-video-publisher'),
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
            <?php esc_html_e('จัดการคลังวิดีโอของคุณได้รวดเร็ว ใช้งานง่าย และยืดหยุ่น', '7ls-video-publisher'); ?>
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
                    🎯 <?php esc_html_e('โหมดปัจจุบัน', '7ls-video-publisher'); ?>
                </h2>
                <span class="sevenls-vp-status-badge sevenls-vp-status-info">
                    <?php echo esc_html($current_mode_label); ?>
                </span>
            </div>
            <p style="margin: 0; color: #666;">
                <?php
                printf(
                    esc_html__('การซิงก์ทั้งหมดด้านล่างจะใช้โหมด "%1$s" พร้อมโปรไฟล์ไซต์ "%2$s" คุณสามารถเปลี่ยนได้ในแท็บตั้งค่า API', '7ls-video-publisher'),
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
                    🔌 <?php esc_html_e('ทดสอบการเชื่อมต่อ API', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('ตรวจสอบว่า API และโทเคนใช้งานได้', '7ls-video-publisher'); ?>">?</span>
                </h2>
                <?php if ($last_connection_test) : ?>
                    <span class="sevenls-vp-status-badge sevenls-vp-status-success">
                        ✓ <?php esc_html_e('เชื่อมต่อแล้ว', '7ls-video-publisher'); ?>
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
                            <?php esc_html_e('ทดสอบล่าสุด', '7ls-video-publisher'); ?>
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
                        <span><?php echo esc_html__('ทดสอบการเชื่อมต่อ', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
            </div>
        </div>

        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    📹 <?php esc_html_e('อัปเดตวิดีโอล่าสุด/วิดีโอใหม่', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('ซิงก์วิดีโอใหม่หรือวิดีโอที่เพิ่งแก้ไขจากคลังของคุณ', '7ls-video-publisher'); ?>">?</span>
                </h2>
                <?php if ($last_sync) : ?>
                    <span class="sevenls-vp-status-badge sevenls-vp-status-info">
                        📊 <?php esc_html_e('ซิงก์แล้ว', '7ls-video-publisher'); ?>
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
                            <?php esc_html_e('ซิงก์ล่าสุด', '7ls-video-publisher'); ?>
                        </div>
                        <div class="sevenls-vp-info-value">
                            🕒 <?php echo esc_html($last_sync); ?>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <div class="sevenls-vp-actions">
                <form method="post" class="sevenls-vp-inline-form sevenls-vp-sync-form" data-sync-action="manual_sync" data-sync-label="<?php echo esc_attr__('อัปเดตวิดีโอล่าสุด/วิดีโอใหม่', '7ls-video-publisher'); ?>">
                    <?php wp_nonce_field('sevenls_vp_manual_sync'); ?>
                    <button type="submit" name="sevenls_vp_manual_sync" class="sevenls-vp-btn sevenls-vp-btn-primary">
                        <span>⚡</span>
                        <span><?php echo esc_html__('อัปเดตวิดีโอล่าสุด/วิดีโอใหม่', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
                <form method="post" class="sevenls-vp-inline-form sevenls-vp-sync-form" data-sync-action="force_recent_sync" data-sync-label="<?php echo esc_attr__('บังคับอัปเดตย้อนหลัง 2 วัน', '7ls-video-publisher'); ?>" data-confirm="<?php echo esc_attr__('ระบบจะบังคับซิงก์เฉพาะวิดีโอในช่วง 2 วันที่ผ่านมา ต้องการดำเนินการต่อหรือไม่?', '7ls-video-publisher'); ?>">
                    <?php wp_nonce_field('sevenls_vp_force_recent_sync'); ?>
                    <button type="submit" name="sevenls_vp_force_recent_sync" class="sevenls-vp-btn sevenls-vp-btn-secondary">
                        <span>🕑</span>
                        <span><?php echo esc_html__('บังคับอัปเดตย้อนหลัง 2 วัน', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
            </div>
            <p class="description"><?php esc_html_e('ตัวเลือกนี้จะบังคับซิงก์เฉพาะวิดีโอในช่วง 2 วันที่ผ่านมาโดยอ้างอิงจากวันเวลาในปัจจุบัน ไม่ใช่การซิงก์ทั้งระบบ', '7ls-video-publisher'); ?></p>
        </div>

        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    🔁 <?php esc_html_e('อัปเดตวิดีโอทั้งหมด', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('ซิงก์วิดีโอทั้งหมดใหม่โดยไม่สนใจเวลาซิงก์ล่าสุด', '7ls-video-publisher'); ?>">?</span>
                </h2>
                <?php if ($last_full_sync) : ?>
                    <span class="sevenls-vp-status-badge sevenls-vp-status-info">
                        📚 <?php esc_html_e('ซิงก์ทั้งหมด', '7ls-video-publisher'); ?>
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
                            <?php esc_html_e('ซิงก์ทั้งหมดล่าสุด', '7ls-video-publisher'); ?>
                        </div>
                        <div class="sevenls-vp-info-value">
                            🕒 <?php echo esc_html($last_full_sync); ?>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <div class="sevenls-vp-actions">
                <form method="post" class="sevenls-vp-inline-form sevenls-vp-sync-form" data-sync-action="full_sync" data-sync-label="<?php echo esc_attr__('ซิงก์ข้อมูลทั้งหมด (บังคับ)', '7ls-video-publisher'); ?>" data-confirm="<?php echo esc_attr__('ระบบจะบังคับซิงก์วิดีโอทั้งหมดใหม่ ต้องการดำเนินการต่อหรือไม่?', '7ls-video-publisher'); ?>">
                    <?php wp_nonce_field('sevenls_vp_full_sync'); ?>
                    <button type="submit" name="sevenls_vp_full_sync" class="sevenls-vp-btn sevenls-vp-btn-secondary">
                        <span>🔁</span>
                        <span><?php echo esc_html__('ซิงก์ข้อมูลทั้งหมด (บังคับ)', '7ls-video-publisher'); ?></span>
                    </button>
                </form>
            </div>
            <p class="description"><?php esc_html_e('ค่าเริ่มต้นของปลั๊กอินจะไม่ดาวน์โหลดรูปภาพเด่นและไม่เก็บ raw payload เพื่อให้ซิงก์ได้เร็วขึ้น หากต้องการเปิดใช้งานสามารถตั้งค่าได้ในแท็บตั้งค่า API', '7ls-video-publisher'); ?></p>
        </div>

        <div class="sevenls-vp-sync-modal" data-sync-modal hidden>
            <div class="sevenls-vp-sync-modal__backdrop" data-sync-modal-close></div>
            <div class="sevenls-vp-sync-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="sevenls-vp-sync-modal-title">
                <div class="sevenls-vp-sync-modal__header">
                    <div>
                        <p class="sevenls-vp-sync-modal__eyebrow"><?php esc_html_e('ความคืบหน้าการอัปเดต', '7ls-video-publisher'); ?></p>
                        <h2 class="sevenls-vp-sync-modal__title" id="sevenls-vp-sync-modal-title" data-sync-modal-title><?php esc_html_e('กำลังเตรียมการซิงก์...', '7ls-video-publisher'); ?></h2>
                    </div>
                    <button type="button" class="sevenls-vp-sync-modal__close" data-sync-modal-close aria-label="<?php esc_attr_e('ปิดหน้าต่าง', '7ls-video-publisher'); ?>" disabled>&times;</button>
                </div>

                <div class="sevenls-vp-sync-modal__status-row">
                    <span class="sevenls-vp-sync-modal__status sevenls-vp-sync-modal__status--running" data-sync-modal-status><?php esc_html_e('กำลังทำงาน', '7ls-video-publisher'); ?></span>
                    <span class="sevenls-vp-sync-modal__percent" data-sync-modal-percent>1%</span>
                </div>

                <p class="sevenls-vp-sync-modal__message" data-sync-modal-message><?php esc_html_e('กำลังเตรียมการซิงก์...', '7ls-video-publisher'); ?></p>

                <div class="sevenls-vp-sync-modal__alert sevenls-vp-sync-modal__alert--info" data-sync-modal-alert hidden>
                    <span data-sync-modal-alert-text><?php esc_html_e('กำลังซิงก์ข้อมูลอยู่', '7ls-video-publisher'); ?></span>
                </div>

                <div class="sevenls-vp-sync-modal__progress" aria-hidden="true">
                    <span class="sevenls-vp-sync-modal__progress-bar" data-sync-modal-progress></span>
                </div>

                <div class="sevenls-vp-sync-modal__stats">
                    <div class="sevenls-vp-sync-modal__stat">
                        <span class="sevenls-vp-sync-modal__stat-value" data-sync-modal-completed>0</span>
                        <span class="sevenls-vp-sync-modal__stat-label"><?php esc_html_e('เสร็จแล้ว', '7ls-video-publisher'); ?></span>
                    </div>
                    <div class="sevenls-vp-sync-modal__stat">
                        <span class="sevenls-vp-sync-modal__stat-value" data-sync-modal-created>0</span>
                        <span class="sevenls-vp-sync-modal__stat-label"><?php esc_html_e('สร้างใหม่', '7ls-video-publisher'); ?></span>
                    </div>
                    <div class="sevenls-vp-sync-modal__stat">
                        <span class="sevenls-vp-sync-modal__stat-value" data-sync-modal-updated>0</span>
                        <span class="sevenls-vp-sync-modal__stat-label"><?php esc_html_e('อัปเดต', '7ls-video-publisher'); ?></span>
                    </div>
                    <div class="sevenls-vp-sync-modal__stat">
                        <span class="sevenls-vp-sync-modal__stat-value" data-sync-modal-errors>0</span>
                        <span class="sevenls-vp-sync-modal__stat-label"><?php esc_html_e('ผิดพลาด', '7ls-video-publisher'); ?></span>
                    </div>
                </div>

                <div class="sevenls-vp-sync-modal__meta">
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('รายการปัจจุบัน', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-current-item>&mdash;</span>
                    </div>
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('หน้า', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-page>&mdash;</span>
                    </div>
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('จำนวนวิดีโอทั้งหมด', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-total>&mdash;</span>
                    </div>
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('โหมด', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-mode>&mdash;</span>
                    </div>
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('ใช้เวลา', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-elapsed><?php esc_html_e('0 วินาที', '7ls-video-publisher'); ?></span>
                    </div>
                    <div class="sevenls-vp-sync-modal__meta-item">
                        <span class="sevenls-vp-sync-modal__meta-label"><?php esc_html_e('คาดว่าเสร็จ', '7ls-video-publisher'); ?></span>
                        <span class="sevenls-vp-sync-modal__meta-value" data-sync-modal-eta><?php esc_html_e('กำลังคำนวณ...', '7ls-video-publisher'); ?></span>
                    </div>
                </div>

                <div class="sevenls-vp-sync-modal__lists">
                    <div class="sevenls-vp-sync-modal__list-card">
                        <div class="sevenls-vp-sync-modal__list-header">
                            <h3 class="sevenls-vp-sync-modal__list-title"><?php esc_html_e('เตรียมพร้อมสำหรับอัปเดต', '7ls-video-publisher'); ?></h3>
                            <span class="sevenls-vp-sync-modal__list-count" data-sync-modal-pending-count>0</span>
                        </div>
                        <ul class="sevenls-vp-sync-modal__list" data-sync-modal-pending-list>
                            <li class="sevenls-vp-sync-modal__list-empty"><?php esc_html_e('ยังไม่มีรายการที่รออัปเดต', '7ls-video-publisher'); ?></li>
                        </ul>
                    </div>

                    <div class="sevenls-vp-sync-modal__list-card">
                        <div class="sevenls-vp-sync-modal__list-header">
                            <h3 class="sevenls-vp-sync-modal__list-title"><?php esc_html_e('รายการที่อัปเดตแล้ว', '7ls-video-publisher'); ?></h3>
                            <span class="sevenls-vp-sync-modal__list-count" data-sync-modal-results-count>0</span>
                        </div>
                        <ul class="sevenls-vp-sync-modal__list" data-sync-modal-results-list>
                            <li class="sevenls-vp-sync-modal__list-empty"><?php esc_html_e('ยังไม่มีรายการที่เสร็จแล้ว', '7ls-video-publisher'); ?></li>
                        </ul>
                    </div>
                </div>

                <div class="sevenls-vp-sync-modal__list-card sevenls-vp-sync-modal__list-card--error" data-sync-modal-errors-wrap hidden>
                    <div class="sevenls-vp-sync-modal__list-header">
                        <h3 class="sevenls-vp-sync-modal__list-title"><?php esc_html_e('รายละเอียดข้อผิดพลาด', '7ls-video-publisher'); ?></h3>
                        <span class="sevenls-vp-sync-modal__list-count" data-sync-modal-errors-count>0</span>
                    </div>
                    <ul class="sevenls-vp-sync-modal__list" data-sync-modal-errors-list>
                        <li class="sevenls-vp-sync-modal__list-empty"><?php esc_html_e('ยังไม่มีข้อผิดพลาด', '7ls-video-publisher'); ?></li>
                    </ul>
                </div>

                <div class="sevenls-vp-sync-modal__footer">
                    <button type="button" class="sevenls-vp-btn sevenls-vp-btn-secondary" data-sync-modal-close-button disabled><?php esc_html_e('ปิด', '7ls-video-publisher'); ?></button>
                </div>
            </div>
        </div>
    <?php else : ?>
        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    ⚙️ <?php esc_html_e('การตั้งค่า API', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('กำหนดค่าการเชื่อมต่อ API ของคุณ', '7ls-video-publisher'); ?>">?</span>
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
                        <span><?php echo esc_html__('บันทึกการตั้งค่า', '7ls-video-publisher'); ?></span>
                    </button>
                </div>
            </form>
        </div>

        <div class="sevenls-vp-card">
            <div class="sevenls-vp-card-header">
                <h2 class="sevenls-vp-card-title">
                    📝 <?php esc_html_e('คู่มือการใช้งาน', '7ls-video-publisher'); ?>
                    <span class="sevenls-vp-tooltip" data-tooltip="<?php esc_attr_e('ดูวิธีใช้งาน shortcode และคำสั่ง CLI', '7ls-video-publisher'); ?>">?</span>
                </h2>
            </div>

            <h3 class="sevenls-vp-section-title">
                🎯 <?php esc_html_e('Shortcode', '7ls-video-publisher'); ?>
            </h3>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="<?php echo esc_attr('[sevenls_video id="EXTERNAL_ID"]'); ?>">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>[sevenls_video id="EXTERNAL_ID"]</code>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="<?php echo esc_attr('[sevenls_video_post id="POST_ID"]'); ?>">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>[sevenls_video_post id="POST_ID"]</code>
            </div>

            <h3 class="sevenls-vp-section-title sevenls-vp-section-title-spaced">
                💻 <?php esc_html_e('คำสั่ง WP-CLI', '7ls-video-publisher'); ?>
            </h3>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp sync">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>wp sevenls-vp sync</code>
                <small style="color:#888; margin-left:8px;"><?php esc_html_e('ซิงก์แบบเพิ่มเฉพาะข้อมูลใหม่ (ช่วง 24 ชม. ล่าสุด)', '7ls-video-publisher'); ?></small>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp full-sync --yes">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>wp sevenls-vp full-sync --yes</code>
                <small style="color:#888; margin-left:8px;"><?php esc_html_e('บังคับซิงก์ข้อมูลทั้งหมด', '7ls-video-publisher'); ?></small>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp test-connection">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>wp sevenls-vp test-connection</code>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp mode">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>wp sevenls-vp mode</code>
                <small style="color:#888; margin-left:8px;"><?php esc_html_e('แสดงโหมดปัจจุบัน', '7ls-video-publisher'); ?></small>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp mode --set=av_movie">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>wp sevenls-vp mode --set=av_movie</code>
                <small style="color:#888; margin-left:8px;"><?php esc_html_e('เปลี่ยนโหมด', '7ls-video-publisher'); ?></small>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp stats">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>wp sevenls-vp stats</code>
            </div>

            <div class="sevenls-vp-code-block">
                <button class="sevenls-vp-copy-btn" type="button" data-copy-text="wp sevenls-vp clear-logs">
                    📋 <?php esc_html_e('คัดลอก', '7ls-video-publisher'); ?>
                </button>
                <code>wp sevenls-vp clear-logs</code>
            </div>
        </div>
    <?php endif; ?>
</div>
