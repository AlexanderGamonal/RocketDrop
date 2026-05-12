# RocketDrop — Product & Technical Specification

> Large-file uploader to Cloudflare R2 via browser-native multipart upload  
> Version 1.0.0 · Stack: React 18 + TypeScript + Express + AWS SDK v3

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Feature Set](#3-feature-set)
4. [Technology Stack](#4-technology-stack)
5. [Project Structure](#5-project-structure)
6. [Environment & Configuration](#6-environment--configuration)
7. [Backend API](#7-backend-api)
8. [Frontend — Components](#8-frontend--components)
9. [Frontend — State & Upload Logic](#9-frontend--state--upload-logic)
10. [Utilities](#10-utilities)
11. [Data Types](#11-data-types)
12. [CSS Design System](#12-css-design-system)
13. [Upload Flow (End-to-End)](#13-upload-flow-end-to-end)
14. [Error Handling & Resilience](#14-error-handling--resilience)
15. [Security Model](#15-security-model)
16. [Build & Deployment](#16-build--deployment)
17. [Constraints & Limits](#17-constraints--limits)
18. [Potential Improvements](#18-potential-improvements)

---

## 1. Overview

**RocketDrop** is a single-page web application that allows users to upload files up to **25 GB** directly to **Cloudflare R2** object storage. The upload is performed via the S3 Multipart Upload API: the browser splits the file into 100 MB chunks and uploads them concurrently (up to 4 at once), bypassing the memory and timeout limitations of a traditional single-request upload.

The Express backend never receives the file data — it only orchestrates presigned URLs. The actual bytes go from the browser straight to R2, keeping the server lightweight and the transfer fast.

### Core User Journey

```
Drop/select file → progress bar with speed & ETA → copy public URL
```

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser (React SPA)                  │
│                                                             │
│  DropZone → useUpload hook → UploadPanel → ResultPanel      │
│                    │                                        │
│            api.ts (fetch)                                   │
└───────────────────┬─────────────────────────────────────────┘
                    │ /api/*  (JSON, no file data)
┌───────────────────▼─────────────────────────────────────────┐
│                    Express Server (server.js)                │
│                                                             │
│   POST /api/upload/init        → CreateMultipartUpload      │
│   POST /api/upload/part-url    → UploadPartPresign          │
│   POST /api/upload/complete    → CompleteMultipartUpload    │
│   DELETE /api/upload/abort     → AbortMultipartUpload       │
└───────────────────┬─────────────────────────────────────────┘
                    │  AWS SDK v3 (S3-compatible)
┌───────────────────▼─────────────────────────────────────────┐
│              Cloudflare R2 (S3-compatible storage)           │
│                                                             │
│  Bucket: ${R2_BUCKET_NAME}                                  │
│  Object key: uploads/{uuid}-{original-filename}             │
│  Public URL: ${R2_PUBLIC_URL}/{key}                         │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Summary

| Stage | Who sends data | Where |
|-------|---------------|-------|
| Init upload | Browser → Express | JSON metadata |
| Get presigned URL (per part) | Browser → Express | JSON metadata |
| Upload chunk | Browser → R2 directly | Raw binary PUT |
| Complete upload | Browser → Express | ETags list |
| Abort upload | Browser → Express | key + uploadId |

---

## 3. Feature Set

### Upload

| Feature | Detail |
|---------|--------|
| Drag & drop | Highlight border on dragover, file accepted on drop |
| Click to browse | Native file input as fallback |
| Max file size | 25 GB (enforced client-side before upload starts) |
| Chunk size | 100 MB per part |
| Concurrent parts | 4 simultaneous XMLHttpRequests |
| Retry per part | 3 attempts with exponential backoff (1s → 2s → 4s) |
| Cancellation | Aborts all in-flight XHRs + calls `/api/upload/abort` |

### Progress Display

| Metric | Calculation |
|--------|-------------|
| Percentage | `sum(bytesUploadedPerPart) / fileSize × 100` |
| Upload speed | Exponential moving average (α = 0.3) on per-interval delta |
| ETA | `remainingBytes / currentSpeed` |
| Parts counter | `completedParts / totalParts` |
| Render throttle | `requestAnimationFrame` at ~25 fps to avoid excessive repaints |

### Result

- Public URL displayed in a monospace box
- One-click copy to clipboard (navigator.clipboard + `execCommand` fallback)
- "Open file" external link
- "Upload another" resets to idle

---

## 4. Technology Stack

### Frontend

| Library / Tool | Version | Role |
|---------------|---------|------|
| React | ^18.3.1 | UI rendering |
| TypeScript | ^5.4.5 | Type safety |
| Vite | ^5.2.0 | Dev server & bundler |
| `@vitejs/plugin-react` | ^4.3.0 | JSX fast-refresh |

### Backend

| Library / Tool | Version | Role |
|---------------|---------|------|
| Express | ^4.19.2 | HTTP server & API |
| @aws-sdk/client-s3 | ^3.600.0 | R2 multipart API calls |
| @aws-sdk/s3-request-presigner | ^3.600.0 | Presigned PUT URLs |
| uuid | ^9.0.1 | Unique object key generation |
| dotenv | ^16.4.5 | Environment variable loading |
| concurrently | ^8.2.2 | Run API + Vite in parallel (dev) |

### Storage

| Service | Protocol |
|---------|---------|
| Cloudflare R2 | S3-compatible (AWS SDK v3) |

---

## 5. Project Structure

```
RocketDrop/
├── index.html                   # HTML shell — mounts React
├── package.json                 # Scripts, dependencies
├── vite.config.ts               # Vite + proxy /api → :3000
├── tsconfig.json                # Umbrella tsconfig (references)
├── tsconfig.app.json            # Frontend TS settings (ES2020, strict)
├── tsconfig.node.json           # Node/Vite tool TS settings
├── server.js                    # Express backend
├── .env.example                 # Environment variable template
├── .gitignore
└── src/
    ├── main.tsx                 # React entry point
    ├── App.tsx                  # Root component (phase router)
    ├── App.css                  # Global styles + design tokens
    ├── api.ts                   # fetch wrappers for backend API
    ├── types.ts                 # Shared TypeScript types
    ├── components/
    │   ├── DropZone.tsx         # File drag-and-drop UI
    │   ├── UploadPanel.tsx      # Progress UI (uploading / error)
    │   └── ResultPanel.tsx      # Success / cancelled UI
    ├── hooks/
    │   └── useUpload.ts         # Upload orchestration hook
    └── utils/
        ├── uploader.ts          # Semaphore, xhrPut, retry logic
        └── format.ts            # fmtBytes, fmtTime helpers
```

---

## 6. Environment & Configuration

### `.env` Variables

| Variable | Required | Description |
|----------|---------|-------------|
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 API token — access key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 API token — secret |
| `R2_BUCKET_NAME` | Yes | Target bucket name |
| `R2_PUBLIC_URL` | Yes | Public base URL (e.g. `https://pub-xxx.r2.dev`) |
| `PORT` | No | Server port (default: `3000`) |

### Vite Proxy (dev only)

```ts
// vite.config.ts
proxy: { '/api': 'http://localhost:3000' }
```

In production, Express serves the bundled `dist/` folder and handles `/api/*` routes on the same port.

---

## 7. Backend API

All endpoints accept and return `application/json`. The server never receives file bytes.

### `POST /api/upload/init`

Starts a multipart upload session in R2.

**Request body:**
```json
{ "filename": "video.mp4", "contentType": "video/mp4" }
```

**Response:**
```json
{ "uploadId": "abc123", "key": "uploads/uuid-video.mp4" }
```

**Internals:** Calls `CreateMultipartUploadCommand` via AWS SDK. Key is `uploads/{uuid}-{filename}`.

---

### `POST /api/upload/part-url`

Returns a presigned URL the browser uses to PUT a single part directly to R2.

**Request body:**
```json
{ "key": "uploads/uuid-video.mp4", "uploadId": "abc123", "partNumber": 1 }
```

**Response:**
```json
{ "url": "https://...r2.cloudflarestorage.com/...?X-Amz-Signature=..." }
```

**Internals:** Uses `getSignedUrl` + `UploadPartCommand`. URL valid for **1 hour**.

---

### `POST /api/upload/complete`

Finalizes the multipart upload after all parts are confirmed.

**Request body:**
```json
{
  "key": "uploads/uuid-video.mp4",
  "uploadId": "abc123",
  "parts": [
    { "PartNumber": 1, "ETag": "\"etag1\"" },
    { "PartNumber": 2, "ETag": "\"etag2\"" }
  ]
}
```

**Response:**
```json
{ "url": "https://pub-xxx.r2.dev/uploads/uuid-video.mp4" }
```

**Internals:** Calls `CompleteMultipartUploadCommand`. Public URL is `${R2_PUBLIC_URL}/${key}`.

---

### `DELETE /api/upload/abort`

Cancels a multipart upload and removes all partial data from R2.

**Request body:**
```json
{ "key": "uploads/uuid-video.mp4", "uploadId": "abc123" }
```

**Response:**
```json
{ "success": true }
```

**Internals:** Calls `AbortMultipartUploadCommand`.

---

## 8. Frontend — Components

### `<DropZone>`

**File:** `src/components/DropZone.tsx`  
**Props:** `onFile(file: File) => void`

Renders a drop target. Handles:
- `dragover` / `dragleave` → toggles `.dragging` class
- `drop` → extracts `dataTransfer.files[0]`
- `<input type="file">` → fallback click-to-browse
- Validation: rejects empty files or files > 25 GB
- Does not render file previews or accept restrictions (accepts any MIME)

---

### `<UploadPanel>`

**File:** `src/components/UploadPanel.tsx`

**Props:**
```ts
{
  file: File
  progress: UploadProgress
  error: string | null
  onCancel: () => void
  onReset: () => void
}
```

Renders during `uploading` and `error` phases:
- File name + formatted size
- Animated progress bar (`--primary` → purple gradient)
- Blinking `.dot` indicator
- Speed (e.g. `12.3 MB/s`) and ETA (e.g. `~2m 30s`)
- Parts counter: `Parts: 3 / 10`
- Error alert box (red, shows `error` message)
- **Cancel** button (visible during upload), **Start over** (visible on error)

---

### `<ResultPanel>`

**File:** `src/components/ResultPanel.tsx`

**Props:**
```ts
{
  phase: 'success' | 'cancelled'
  file: File
  url: string | null
  onReset: () => void
}
```

Renders after upload finishes:
- ✅ icon on success, ⛔ on cancellation
- File name
- URL box with copy button (success only)
- "Open file" `<a target="_blank">` link
- "Upload another" button → calls `onReset`

---

### `<App>` (Root)

**File:** `src/App.tsx`

Owns the phase-based rendering:

```
phase === 'idle'                     → <DropZone onFile={upload} />
phase === 'uploading' | 'error'      → <UploadPanel .../>
phase === 'success' | 'cancelled'    → <ResultPanel .../>
```

Connects `useUpload` hook outputs to component props.

---

## 9. Frontend — State & Upload Logic

### `useUpload` Hook

**File:** `src/hooks/useUpload.ts`  
**Returns:**
```ts
{
  phase: UploadPhase
  file: File | null
  progress: UploadProgress
  resultUrl: string | null
  error: string | null
  upload: (file: File) => Promise<void>
  cancel: () => void
  reset: () => void
}
```

#### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CHUNK_SIZE` | 100 MB | Bytes per upload part |
| `MAX_CONCURRENT` | 4 | Simultaneous XHR uploads |

#### Internal Refs (not state, avoid re-renders)

| Ref | Type | Purpose |
|-----|------|---------|
| `cancelledRef` | `boolean` | Set to `true` on cancel |
| `userCancelRef` | `boolean` | Distinguishes user cancel vs error |
| `activeXHRs` | `Set<XMLHttpRequest>` | All in-flight XHRs for abort |
| `uploadRef` | `{ key, uploadId }` | Stored for cleanup on cancel |

#### `upload(file)` flow

```
1. Set phase = 'uploading', store file in state
2. POST /api/upload/init → { uploadId, key }
3. Split file into parts: Math.ceil(size / CHUNK_SIZE)
4. For each part (via Semaphore, max 4 concurrent):
   a. POST /api/upload/part-url → presigned URL
   b. xhrPutWithRetry(url, blob, onProgress) → ETag
   c. Update partBytes[i] for progress calculation
   d. Increment completedParts
5. POST /api/upload/complete with all ETags
6. Set phase = 'success', resultUrl = public URL
```

#### Progress calculation

```
totalUploaded = sum(partBytes)
pct           = totalUploaded / file.size * 100

Δbytes (per RAF tick):
  speed = α * (Δbytes / Δtime) + (1 - α) * prevSpeed   // α = 0.3 EMA
  eta   = (file.size - totalUploaded) / speed
```

#### `cancel()`

```
1. Set cancelledRef = true, userCancelRef = true
2. Abort all activeXHRs
3. POST DELETE /api/upload/abort (key, uploadId)
4. Set phase = 'cancelled'
```

#### `reset()`

Clears all state back to `phase = 'idle'`, `file = null`, `progress = zeroed`.

---

## 10. Utilities

### `src/utils/uploader.ts`

#### `Semaphore`

Limits concurrent async operations.

```ts
class Semaphore {
  constructor(max: number)
  run<T>(fn: () => Promise<T>): Promise<T>
}
```

Queue-based: `run()` waits until a slot is free, executes `fn`, then releases.

---

#### `xhrPut(url, blob, onProgress, cancelledRef, activeXHRs)`

Raw XMLHttpRequest PUT:

- `xhr.upload.onprogress` → calls `onProgress(loadedBytes)`
- `xhr.setRequestHeader('Content-Type', 'application/octet-stream')`
- Resolves with `ETag` header (required for `CompleteMultipartUpload`)
- Rejects with error message on status outside 200–299
- Checks `cancelledRef` before resolving; removes self from `activeXHRs`

---

#### `xhrPutWithRetry(url, blob, onProgress, cancelledRef, activeXHRs, attempts?)`

Wraps `xhrPut` with retry logic:

| Attempt | Delay before retry |
|---------|------------------|
| 1 (initial) | — |
| 2 | 1 000 ms |
| 3 | 2 000 ms |

Default attempts: 3. Throws on final failure. Respects cancellation (does not retry if cancelled).

---

### `src/utils/format.ts`

#### `fmtBytes(bytes: number): string`

| Input | Output |
|-------|--------|
| 500 | `500 B` |
| 1 500 | `1.5 KB` |
| 5 242 880 | `5.0 MB` |
| 1 073 741 824 | `1.0 GB` |

#### `fmtTime(seconds: number): string`

| Input | Output |
|-------|--------|
| 45 | `45s` |
| 330 | `5m 30s` |
| 8 100 | `2h 15m` |
| NaN / ≤ 0 | `—` |

---

## 11. Data Types

**File:** `src/types.ts`

```ts
type UploadPhase = 'idle' | 'uploading' | 'success' | 'error' | 'cancelled'

interface UploadProgress {
  pct: number            // 0–100
  speed: number          // bytes/second
  eta: number | null     // seconds remaining (null if unknown)
  completedParts: number
  totalParts: number
}

interface Part {
  PartNumber: number     // 1-indexed
  ETag: string           // From R2 response header (quoted string)
}
```

---

## 12. CSS Design System

**File:** `src/App.css` (~440 lines)

### Design Tokens (CSS Custom Properties)

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#2563EB` | Buttons, progress bar, links |
| `--primary-dark` | `#1D4ED8` | Hover states |
| `--error` | `#DC2626` | Error alerts, danger button |
| `--bg` | `#F1F5F9` | Page background |
| `--surface` | `#FFFFFF` | Card / panel background |
| `--border` | `#E2E8F0` | Borders, dividers |
| `--text` | `#0F172A` | Primary text |
| `--muted` | `#64748B` | Secondary text, labels |
| `--radius` | `14px` | Border radius for cards |

### Key CSS Classes

| Class | Description |
|-------|-------------|
| `.card` | Centered white container with shadow |
| `.drop-zone` | Dashed border rectangle, hover highlight |
| `.drop-zone.dragging` | Active drag-over state |
| `.prog-fill` | Gradient progress bar (blue → purple) |
| `.dot` | Animated blinking dot (CSS keyframes) |
| `.alert-error` | Red background error message box |
| `.link-box` | Monospace URL display container |
| `.btn-primary` | Solid blue button |
| `.btn-outline` | Bordered button |
| `.btn-danger` | Red/cancel button |

---

## 13. Upload Flow (End-to-End)

```
User drops file
       │
       ▼
DropZone validates size (≤ 25 GB) and calls onFile(file)
       │
       ▼
useUpload.upload(file)
       │
       ├─ POST /api/upload/init ──────────────────────────► R2.CreateMultipartUpload
       │     ◄── { uploadId, key } ◄────────────────────────────────────────────────
       │
       ├─ Split file into N parts (100 MB each)
       │
       ├─ [Semaphore: max 4 concurrent]
       │    For each part i:
       │    ├─ POST /api/upload/part-url ────────────────► Presign UploadPart URL
       │    │     ◄── { url } ◄─────────────────────────────────────────────────────
       │    │
       │    └─ PUT presigned URL ─────────────────────────► R2 (binary chunk)
       │          xhrPutWithRetry (3 attempts, backoff)
       │          onProgress → updates partBytes[i] → RAF → setState
       │          ◄── ETag ◄──────────────────────────────────────────────────────
       │
       ├─ POST /api/upload/complete { parts: [{PartNumber, ETag}...] } ► R2.Complete
       │     ◄── { url: "https://pub-xxx.r2.dev/uploads/uuid-file" } ◄────────────
       │
       └─ setState({ phase: 'success', resultUrl })
              │
              ▼
       ResultPanel shows URL + copy button
```

### Cancel path

```
User clicks Cancel
       │
       ▼
cancelledRef = true → all XHRs aborted
       │
       ▼
DELETE /api/upload/abort → R2.AbortMultipartUpload (cleanup partial data)
       │
       ▼
phase = 'cancelled' → ResultPanel (cancellation message)
```

---

## 14. Error Handling & Resilience

| Scenario | Behaviour |
|----------|-----------|
| File > 25 GB | Rejected in DropZone before upload starts |
| Empty file | Rejected in DropZone |
| Single part fails | Retried up to 3× with exponential backoff |
| All retries exhausted | `phase = 'error'`, message shown, other XHRs aborted |
| User cancels | All XHRs aborted immediately, abort API called |
| Server error (init/complete) | `phase = 'error'`, user sees error message |
| Network drop mid-upload | XHR fails → retry logic kicks in |
| Copy clipboard fails | Falls back to `document.execCommand('copy')` |

---

## 15. Security Model

| Concern | Mitigation |
|---------|-----------|
| R2 credentials | Stored in `.env`, never exposed to client |
| Presigned URL expiry | 1-hour TTL limits window of misuse |
| File size | Client-side check (UX); no server-side enforcement |
| Content type | Passed from client; R2 accepts any value |
| Object key | UUID prefix prevents collisions and path traversal |
| No auth/auth | Application has no authentication layer (public tool) |

> **Note:** There is no rate limiting or upload quota enforcement. Any client with network access can upload files. Consider adding authentication or rate limiting before deploying to an untrusted environment.

---

## 16. Build & Deployment

### Development

```bash
cp .env.example .env        # Fill in R2 credentials
npm install
npm run dev                  # Vite (:5173) + Express (:3000) concurrently
```

Vite proxies `/api/*` to Express so both run from the same origin in the browser.

### Production

```bash
npm run build                # tsc + vite build → dist/
npm start                    # Express serves dist/ + /api/* routes on PORT
```

Express production mode:
1. Serves `dist/` as static files
2. Falls back to `dist/index.html` for all non-API routes (SPA routing)
3. Handles `/api/*` routes for R2 orchestration

### Environment

The app is a traditional Node.js server — deploy to any VPS, container, or PaaS that supports Node.js (e.g. Railway, Render, Fly.io, AWS EC2). No serverless deployment without adaptation (requires persistent server for static file serving).

---

## 17. Constraints & Limits

| Constraint | Value | Notes |
|------------|-------|-------|
| Max file size | 25 GB | Client-side only |
| Chunk size | 100 MB | Hardcoded in `useUpload.ts` |
| Max concurrent parts | 4 | Hardcoded in `useUpload.ts` |
| Presigned URL TTL | 1 hour | Set in `server.js` |
| Retry attempts per part | 3 | In `xhrPutWithRetry` |
| R2 min part size | 5 MB | R2 enforces this (except last part) |
| R2 max parts | 10 000 | With 100 MB chunks: max ~1 TB |
| Browser memory | N/A | Chunks are sliced from `File` object (no full load) |

---

## 18. Potential Improvements

### UX / Product

- [ ] Multiple file queue (batch upload)
- [ ] File type restrictions (accept prop on DropZone)
- [ ] Thumbnail preview for images/videos
- [ ] Upload history (localStorage)
- [ ] Shareable short links

### Reliability

- [ ] Resume interrupted uploads (persist `uploadId` + `key` in sessionStorage)
- [ ] Configurable chunk size and concurrency
- [ ] Server-side file size validation
- [ ] Webhook on upload complete

### Security & Operations

- [ ] Authentication (e.g. magic link, OAuth)
- [ ] Rate limiting on API endpoints
- [ ] Signed expiring download URLs instead of public bucket
- [ ] Object lifecycle rules (auto-delete after N days)
- [ ] Virus scanning integration

### Developer Experience

- [ ] Unit tests for `useUpload`, `uploader.ts`, `format.ts`
- [ ] E2E tests (Playwright/Cypress)
- [ ] Docker Compose setup
- [ ] CI/CD pipeline
- [ ] Configurable `CHUNK_SIZE` and `MAX_CONCURRENT` via env vars

---

*Spec generated from source analysis · RocketDrop v1.0.0*
