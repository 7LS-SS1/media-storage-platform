```markdown
# 7LS Video Publisher

A production-ready WordPress plugin that automatically syncs videos from an external media storage API and publishes them as custom post types.

## Features

- 🔄 **Automatic Sync**: Schedule automatic syncs at configurable intervals (5 min, 15 min, hourly, twice daily, daily)
- 🎬 **Custom Post Type**: Videos are stored as a custom "video" post type with full WordPress features
- 🏷️ **Tag Support**: Automatic tag mapping from API to WordPress taxonomy
- 📊 **Admin Interface**: Clean admin pages for settings, manual sync, and logs
- 🔐 **Secure**: Bearer token authentication, nonce protection, capability checks
- 🎨 **Front-end Display**: Shortcodes and template override support
- 📝 **Logging**: Built-in logging system with configurable retention
- ⚡ **Performance**: Transient caching, idempotent sync, pagination support
- 🛠️ **WP-CLI Support**: Command-line interface for automation

## Installation

1. **Upload the plugin**:
   - Download the plugin folder
   - Upload to `/wp-content/plugins/7ls-video-publisher/`
   - Or install via WordPress plugin uploader

2. **Activate**:
   - Go to WordPress admin → Plugins
   - Activate "7LS Video Publisher"

3. **Configure**:
   - Go to Video Publisher → Settings
   - Enter your API credentials

## Configuration

### API Settings

Navigate to **Video Publisher → Settings** in WordPress admin:

1. **API Base URL**: Your external API endpoint (e.g., `https://api.example.com`)
2. **API Key**: Your Bearer token for authentication
3. **Project ID**: (Optional) If your API requires a project identifier

### Sync Settings

- **Sync Interval**: Choose how often to sync (5min to daily)
- **Post Status**: Set imported videos to draft, publish, or pending
- **Post Author**: Assign videos to a specific WordPress user

### Logging

- **Enable Logging**: Turn logging on/off
- **Log Retention**: How many days to keep logs (1-365)

## Usage

### Manual Sync

1. Go to **Video Publisher → Settings**
2. Click **"Sync Now"** button
3. Wait for completion message

### Shortcodes

Display videos in posts/pages:

```
[sevenls_video id="EXTERNAL_ID"]
```
Shows video by external API ID.

```
[sevenls_video_post id="123"]
```
Shows video by WordPress post ID.

### Template Override

Copy `templates/single-video.php` to your theme to customize the single video display:

```
your-theme/single-video.php
```

### WP-CLI Commands

If WP-CLI is available:

```bash
# Run manual sync
wp sevenls-vp sync

# Clear logs
wp sevenls-vp clear-logs

# Test API connection
wp sevenls-vp test-connection

# Show statistics
wp sevenls-vp stats
```

## API Integration

### Expected API Response Format

Your API should return JSON in this format:

```json
{
  "data": [
    {
      "id": "video-123",
      "title": "Sample Video",
      "description": "Video description here",
      "video_url": "https://example.com/video.mp4",
      "thumbnail_url": "https://example.com/thumb.jpg",
      "duration": 180,
      "tags": ["tutorial", "wordpress"],
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-15T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### Customizing Field Mapping

To customize how API fields map to WordPress, edit the `map_video_fields()` method in `/includes/class-sync-engine.php`:

```php
private function map_video_fields(array $video_data): array|\WP_Error {
    return [
        'external_id' => $video_data['id'],           // Change field names here
        'title' => $video_data['title'],
        'description' => $video_data['description'],
        // ... customize other fields
    ];
}
```

### API Endpoints

The plugin expects these endpoints:

- **GET** `/videos?page={n}&per_page={n}&since={timestamp}` - List videos
- **GET** `/videos/{id}` - Single video (optional)

**Authentication**: Bearer token in `Authorization` header

## Video Meta Fields

Each synced video stores these custom fields:

- `_sevenls_vp_external_id` - External API ID (unique)
- `_sevenls_vp_video_url` - Video file/embed URL
- `_sevenls_vp_thumbnail_url` - Thumbnail image URL
- `_sevenls_vp_duration` - Duration in seconds
- `_sevenls_vp_source_created_at` - API creation date
- `_sevenls_vp_source_updated_at` - API update date
- `_sevenls_vp_raw_payload` - Full JSON response (debugging)

## Video Player Support

The plugin automatically detects and handles:

- ✅ **Direct video files** (.mp4, .webm) → HTML5 player
- ✅ **YouTube** URLs → Embedded player
- ✅ **Vimeo** URLs → Embedded player

## Troubleshooting

### Videos Not Syncing

1. Check API credentials in Settings
2. Click "Test API Connection"
3. Check logs in Video Publisher → Logs
4. Verify WP-Cron is working: `wp cron event list`

### Duplicate Videos

The plugin uses `external_id` to prevent duplicates. If you see duplicates:

1. Check that API returns consistent IDs
2. Verify meta field `_sevenls_vp_external_id` exists

### Performance Issues

- Reduce sync interval
- Limit `per_page` in API client (line ~100 in `class-sync-engine.php`)
- Increase PHP `max_execution_time`

## Uninstall

The plugin removes these on uninstall:

- ✅ All plugin options
- ✅ Scheduled cron events
- ✅ Logs

**Note**: Video posts and taxonomy terms are **NOT** deleted by default. Uncomment code in `uninstall.php` to remove all content.

## Requirements

- **WordPress**: 6.0+
- **PHP**: 8.0+
- **Required PHP Extensions**: json, curl

## Security

- ✅ Nonce verification on all actions
- ✅ Capability checks (`manage_options`)
- ✅ Input sanitization & output escaping
- ✅ No sensitive data logged
- ✅ Bearer token authentication

## Support

For issues or feature requests, please check:

1. Plugin logs (Video Publisher → Logs)
2. WordPress debug log (`WP_DEBUG`)
3. Your API documentation

## License

GPL v2 or later

## Changelog

### 1.0.0-beta
- Beta release

### 1.0.0
- Initial release
- Full sync engine with pagination
- Admin interface with settings
- Shortcode support
- WP-CLI commands
- Template override system
- Logging system

```
