import path from 'path'
import fs from 'fs'
import express from 'express'
import cors from 'cors'
import { v2 as cloudinary } from 'cloudinary'
import * as dotenv from 'dotenv'

const root = path.join(__dirname, '..')
dotenv.config({ path: path.join(root, '.env') })

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

const app = express()
const PORT = 3001
const uploadsDir = path.join(root, 'uploads')

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/uploads', express.static(uploadsDir))

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/print', (req, res) => {
  const body = req.body as { image?: string }
  const raw = body?.image
  if (!raw || typeof raw !== 'string') {
    res.status(400).json({ success: false, error: 'Missing image' })
    return
  }
  const match = raw.match(/^data:image\/\w+;base64,(.+)$/)
  const b64 = match ? match[1] : raw
  let buf: Buffer
  try {
    buf = Buffer.from(b64, 'base64')
  } catch {
    res.status(400).json({ success: false, error: 'Invalid base64' })
    return
  }
  const name = `print-${Date.now()}.png`
  const filePath = path.join(uploadsDir, name)
  fs.writeFileSync(filePath, buf)
  res.json({ success: true, file: name })
})

app.get('/api/gallery/:slug', (_req, res) => {
  let files: string[] = []
  try {
    files = fs
      .readdirSync(uploadsDir)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort()
      .reverse()
  } catch {
    files = []
  }
  const list = files.map((name) => ({
    name,
    url: `/uploads/${encodeURIComponent(name)}`,
  }))
  res.json({ slug: _req.params.slug, items: list })
})

app.post('/api/upload', async (req, res) => {
  try {
    const { imageData, sessionId } = req.body
    if (!imageData) return res.status(400).json({ error: 'No image data provided' })
    const result = await cloudinary.uploader.upload(imageData, {
      folder: 'photobooth',
      public_id: `session-${sessionId || Date.now()}`,
      overwrite: true,
      resource_type: 'image',
      format: 'jpg',
      quality: 90,
      transformation: [{ width: 1181, height: 1748, crop: 'limit' }],
    })
    const downloadUrl = cloudinary.url(result.public_id, {
      resource_type: 'image',
      flags: 'attachment',
      format: 'jpg',
      secure: true,
    })
    res.json({
      success: true,
      publicUrl: result.secure_url,
      downloadUrl,
      publicId: result.public_id,
    })
  } catch (error: unknown) {
    console.error('Cloudinary upload error:', error)
    const message = error instanceof Error ? error.message : 'Upload failed'
    res.status(500).json({ error: message })
  }
})

app.listen(PORT, () => {
  console.log(`PhotoBooth server http://localhost:${PORT}`)
})
