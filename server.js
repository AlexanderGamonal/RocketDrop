require('dotenv').config();
const path = require('path');
const express = require('express');
const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;

// POST /api/upload/init
// Body: { filename, contentType }
// Returns: { uploadId, key }
app.post('/api/upload/init', async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  const key = `uploads/${uuidv4()}-${filename}`;

  try {
    const cmd = new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    const { UploadId } = await s3.send(cmd);
    res.json({ uploadId: UploadId, key });
  } catch (err) {
    console.error('[init]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/part-url
// Body: { key, uploadId, partNumber }
// Returns: { url }
app.post('/api/upload/part-url', async (req, res) => {
  const { key, uploadId, partNumber } = req.body;
  if (!key || !uploadId || !partNumber) {
    return res.status(400).json({ error: 'key, uploadId, partNumber required' });
  }

  try {
    const cmd = new UploadPartCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: Number(partNumber),
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
    res.json({ url });
  } catch (err) {
    console.error('[part-url]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/part-urls
// Body: { key, uploadId, totalParts }
// Returns: { urls: string[] }  — all presigned URLs in one round-trip
app.post('/api/upload/part-urls', async (req, res) => {
  const { key, uploadId, totalParts } = req.body;
  if (!key || !uploadId || !totalParts || totalParts < 1) {
    return res.status(400).json({ error: 'key, uploadId, totalParts required' });
  }

  try {
    const urls = await Promise.all(
      Array.from({ length: totalParts }, (_, i) =>
        getSignedUrl(s3, new UploadPartCommand({
          Bucket: BUCKET,
          Key: key,
          UploadId: uploadId,
          PartNumber: i + 1,
        }), { expiresIn: 3600 })
      )
    );
    res.json({ urls });
  } catch (err) {
    console.error('[part-urls]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/upload/complete
// Body: { key, uploadId, parts: [{ PartNumber, ETag }] }
// Returns: { url }
app.post('/api/upload/complete', async (req, res) => {
  const { key, uploadId, parts } = req.body;
  if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
    return res.status(400).json({ error: 'key, uploadId, parts required' });
  }

  try {
    const cmd = new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
      },
    });
    await s3.send(cmd);
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    res.json({ url: publicUrl });
  } catch (err) {
    console.error('[complete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/upload/abort
// Body: { key, uploadId }
// Returns: { success: true }
app.delete('/api/upload/abort', async (req, res) => {
  const { key, uploadId } = req.body;
  if (!key || !uploadId) {
    return res.status(400).json({ error: 'key, uploadId required' });
  }

  try {
    const cmd = new AbortMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
    });
    await s3.send(cmd);
    res.json({ success: true });
  } catch (err) {
    console.error('[abort]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/files
// Returns: [{ key, name, size, lastModified, url }]
app.get('/api/admin/files', async (_req, res) => {
  try {
    const results = [];
    let continuationToken;

    do {
      const cmd = new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: 'uploads/',
        ContinuationToken: continuationToken,
      });
      const page = await s3.send(cmd);
      for (const obj of page.Contents ?? []) {
        results.push({
          key: obj.Key,
          name: obj.Key.replace(/^uploads\/[^-]+-/, ''),
          size: obj.Size,
          lastModified: obj.LastModified,
          url: `${process.env.R2_PUBLIC_URL}/${obj.Key}`,
        });
      }
      continuationToken = page.NextContinuationToken;
    } while (continuationToken);

    res.json(results);
  } catch (err) {
    console.error('[admin/files]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/files
// Body: { key }
// Returns: { success: true }
app.delete('/api/admin/files', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    res.json({ success: true });
  } catch (err) {
    console.error('[admin/delete]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// In production, serve the React build
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`RocketDrop running at http://localhost:${PORT}`);
});
