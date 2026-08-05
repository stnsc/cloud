# Cloud Storage Platform - Setup Guide

## Project Structure

```
cloud/
├── src/                      # React Frontend (Vite + TypeScript)
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── FileExplorer.tsx
│   │   └── UploadArea.tsx
│   ├── hooks/
│   │   └── useApi.ts        # API client hook
│   ├── App.tsx
│   └── index.css
├── api/                      # Cloudflare Workers Backend
│   ├── src/
│   │   └── index.ts         # Worker entry point
│   ├── wrangler.toml        # Cloudflare config
│   ├── schema.sql           # D1 database schema
│   └── package.json
├── .env.local               # Frontend env config
└── package.json
```

## Backend Setup (Cloudflare Workers)

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
```

### 2. Authenticate with Cloudflare
```bash
wrangler login
```

### 3. Create R2 Bucket
```bash
wrangler r2 bucket create cloud-storage-files
wrangler r2 bucket create cloud-storage-files-preview  # for preview mode
```

### 4. Create D1 Database
```bash
wrangler d1 create cloud-storage
wrangler d1 create cloud-storage --preview  # for preview mode
```

### 5. Update wrangler.toml
After creating the database, update the `database_id` and `preview_database_id` in `api/wrangler.toml`

### 6. Initialize Database Schema
```bash
cd api
npm run db:init
```

### 7. Run Worker Locally
```bash
cd api
npm run dev
# Worker will be available at http://localhost:8787
```

## Frontend Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
The `.env.local` file is already created with:
```
VITE_API_URL=http://localhost:8787
```

For production (Vercel), set:
```
VITE_API_URL=https://your-worker-domain.workers.dev
```

### 3. Run Development Server
```bash
npm run dev
# Frontend will be available at http://localhost:5174
```

## Deploy to Production

### Deploy Backend to Cloudflare
```bash
cd api
wrangler deploy
```

Note the deployed URL (typically `https://cloud-storage-api-prod.your-domain.workers.dev`)

### Deploy Frontend to Vercel

1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Add environment variable:
   - `VITE_API_URL`: Your deployed Cloudflare Workers URL
5. Deploy

## API Endpoints

### List Files
```
GET /api/files
Headers: Authorization: Bearer {token}
Response: Array of FileData
```

### Upload File
```
POST /api/files/upload
Headers: Authorization: Bearer {token}
Body: FormData with 'file' field
Response: FileData
```

### Delete File
```
DELETE /api/files/{fileId}
Headers: Authorization: Bearer {token}
Response: { success: true }
```

### Share File
```
POST /api/files/{fileId}/share
Headers: Authorization: Bearer {token}
Response: { shareToken, shareUrl }
```

### Download File
```
GET /api/files/{fileId}/download
Headers: Authorization: Bearer {token}
Response: File binary data
```

## TODO - Next Steps

1. **Authentication**: Implement JWT auth (currently uses dummy 'test-user')
2. **Share System**: Implement share tokens and public file access
3. **Folder Organization**: Create folder management endpoints
4. **Error Handling**: Add better error messages and status codes
5. **Rate Limiting**: Add rate limiting to prevent abuse
6. **File Preview**: Add image/document preview functionality
7. **WebSocket**: Real-time file sync

## Environment Variables

### Frontend (.env.local)
- `VITE_API_URL`: Cloudflare Workers API URL

### Backend (wrangler.toml)
- `R2_BUCKET`: R2 storage binding (auto-configured)
- `DB`: D1 database binding (auto-configured)
- `JWT_SECRET`: Secret for JWT token (TODO)
