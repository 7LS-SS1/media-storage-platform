# Media Storage API - Video Platform

A full-stack video platform built with Next.js 14+, Prisma, PostgreSQL, and Cloudflare R2.

## Features

- ✅ Video Upload & Management (CRUD)
- ✅ Cloudflare R2 Integration
- ✅ User Authentication & Authorization (JWT)
- ✅ Role-Based Access Control (ADMIN, EDITOR, VIEWER)
- ✅ Video Embedding with Domain Restrictions
- ✅ Search & Filter
- ✅ Category Management
- ✅ Public/Private/Domain-Restricted Videos

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Storage:** Cloudflare R2 (S3 Compatible)
- **Auth:** JWT with jose
- **Validation:** Zod
- **Styling:** Tailwind CSS

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy \`.env.example\` to \`.env\` and fill in your credentials:

```bash
cp .env.example .env
```

### 3. Database Setup

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations
npm run db:migrate
```

### 4. Run Development Server

```bash
npm run dev
```

## Transcode Worker (Recommended for Large Files)

Serverless environments have limited `/tmp` space. For large videos, run transcoding on a VM/container with enough disk.

1. Set `TRANSCODE_MODE=worker` in the app environment (Vercel/local).
2. On a machine with ffmpeg/ffprobe installed and enough disk, run:

```bash
npm run transcode:worker
```

Optional env:
- `TRANSCODE_TMP_DIR` - temp directory with enough space
- `TRANSCODE_POLL_INTERVAL_MS` - polling interval (default 15000)
- `ALLOW_INLINE_TRANSCODE=true` - allow inline transcode (local/server only, not serverless)

Notes:
- Vercel/serverless runtime should use queue/worker mode.
- Inline transcode requests are blocked in serverless to prevent 504 timeout on large or long videos.

## API Endpoints

### Authentication
- \`POST /api/auth/login\` - User login
- \`POST /api/auth/register\` - User registration
- \`POST /api/auth/logout\` - User logout

### Videos
- \`POST /api/videos\` - Upload video (ADMIN/EDITOR)
- \`GET /api/videos\` - List videos with pagination & filters
- \`GET /api/videos/:id\` - Get video details
- \`PUT /api/videos/:id\` - Update video (ADMIN/EDITOR)
- \`DELETE /api/videos/:id\` - Delete video (ADMIN)

### Categories
- \`POST /api/categories\` - Create category (ADMIN)
- \`GET /api/categories\` - List categories
- \`PUT /api/categories/:id\` - Update category (ADMIN)
- \`DELETE /api/categories/:id\` - Delete category (ADMIN)

### Domains
- \`POST /api/domains\` - Add allowed domain (ADMIN)
- \`GET /api/domains\` - List allowed domains
- \`DELETE /api/domains/:id\` - Remove domain (ADMIN)

## Embed Videos

Embed videos using iframe:

```html
<iframe 
  src="https://your-domain.com/embed/video/VIDEO_ID" 
  width="640" 
  height="360" 
  frameborder="0" 
  allowfullscreen>
</iframe>
```

## Cloudflare R2 Setup

1. Create a Cloudflare account and enable R2
2. Create a bucket
3. Generate API credentials
4. Add credentials to \`.env\`

## License

MIT
