# API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication

All authenticated requests require either:
- **Cookie**: \`token\` (set automatically on login)
- **Header**: \`Authorization: Bearer <token>\`

---

## Auth Endpoints

### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "VIEWER"
}
```

**Response:** \`201 Created\`
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "VIEWER"
  }
}
```

### POST /api/auth/login
Login to get authentication token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** \`200 OK\`
```json
{
  "message": "Login successful",
  "user": { ... },
  "token": "eyJhbGc..."
}
```

### POST /api/auth/logout
Logout (clears cookie).

### GET /api/auth/me
Get current user info.

---

## Video Endpoints

### POST /api/upload
Upload video file to R2.

**Auth Required:** ADMIN or EDITOR

**Request:** \`multipart/form-data\`
- \`file\`: Video file
- \`type\`: "video" or "thumbnail"

**Response:** \`200 OK\`
```json
{
  "message": "File uploaded successfully",
  "url": "https://r2.../video.mp4",
  "filename": "videos/123-abc.mp4"
}
```

### POST /api/videos
Create new video entry.

**Auth Required:** ADMIN or EDITOR

**Request:**
```json
{
  "title": "My Video",
  "description": "Video description",
  "videoUrl": "https://r2.../video.mp4",
  "thumbnailUrl": "https://r2.../thumb.jpg",
  "categoryId": "cat_1",
  "visibility": "PUBLIC"
}
```

### GET /api/videos
List videos with filters.

**Query Parameters:**
- \`page\`: Page number (default: 1)
- \`limit\`: Items per page (default: 20)
- \`search\`: Search in title/description
- \`categoryId\`: Filter by category
- \`visibility\`: Filter by visibility
- \`sort\`: newest | oldest | popular

### GET /api/videos/:id
Get video details.

### PUT /api/videos/:id
Update video.

**Auth Required:** ADMIN or EDITOR (owner)

### DELETE /api/videos/:id
Delete video.

**Auth Required:** ADMIN only

---

## Category Endpoints

### GET /api/categories
List all categories.

### POST /api/categories
Create category (ADMIN only).

---

## Domain Endpoints

### GET /api/domains
List allowed domains (ADMIN only).

### POST /api/domains
Add allowed domain (ADMIN only).

### DELETE /api/domains/:id
Remove domain (ADMIN only).

---

## Embed Endpoint

### GET /api/embed/:id
Get video for embedding (checks domain restrictions).

---

## Error Responses

```json
{
  "error": "Error message"
}
```

**Status Codes:**
- \`400\`: Bad Request
- \`401\`: Unauthorized
- \`403\`: Forbidden
- \`404\`: Not Found
- \`500\`: Internal Server Error
