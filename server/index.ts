import path from 'path'
import fs from 'fs'
import os from 'os'
import express from 'express'
import sharp from 'sharp'
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

app.post('/api/save-print', async (req, res) => {
  try {
    const { imageData, sessionId, outputFolder } = req.body
    if (!imageData) return res.status(400).json({ error: 'No image data' })

    const folder =
      outputFolder ||
      path.join(os.homedir(), 'Desktop', 'PhotoBooth_Prints')

    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    const filename = `photobooth-${sessionId || Date.now()}.jpg`
    const filePath = path.join(folder, filename)

    await sharp(buffer)
      .resize(1181, 1748, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 },
      })
      .jpeg({ quality: 98 })
      .withMetadata({ density: 300 })
      .toFile(filePath)

    console.log(`✅ Photo saved: ${filePath}`)
    res.json({ success: true, filePath, filename })
  } catch (err: unknown) {
    console.error('Save error:', err)
    const message = err instanceof Error ? err.message : 'Save failed'
    res.status(500).json({ error: message })
  }
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

// Scan folder for PNG frames — JSON optional sidecar
app.get('/api/frames', (req, res) => {
  try {
    const folder = (req.query.folder as string) || ''
    if (!folder || !fs.existsSync(folder)) {
      return res.json({ success: true, frames: [] })
    }

    const VALID_LAYOUTS = ['strip4', 'strip3', 'single', 'grid4']
    const files = fs.readdirSync(folder)
    const pngFiles = files.filter((f) => f.toLowerCase().endsWith('.png'))
    const frames: Record<string, unknown>[] = []

    for (const png of pngFiles) {
      try {
        const base = png.replace(/\.png$/i, '')

        let cfg: {
          name?: string
          layout?: string
          color?: string
          showBranding?: boolean
        } = {}
        const jsonName = files.find(
          (f) => f.toLowerCase() === `${base}.json`.toLowerCase(),
        )
        if (jsonName) {
          try {
            cfg = JSON.parse(
              fs.readFileSync(path.join(folder, jsonName), 'utf-8'),
            )
          } catch {
            cfg = {}
          }
        }

        let layout = cfg.layout
        if (!layout || !VALID_LAYOUTS.includes(layout)) {
          const lower = base.toLowerCase()
          layout = VALID_LAYOUTS.find((l) => lower.includes(l)) || 'strip4'
        }

        let name = cfg.name
        if (!name) {
          name = base
            .replace(new RegExp(layout, 'i'), '')
            .replace(/[_\-]+/g, ' ')
            .trim()
          if (!name) name = base
          name = name.replace(/\b\w/g, (c) => c.toUpperCase())
        }

        const pngBuffer = fs.readFileSync(path.join(folder, png))
        const overlay = `data:image/png;base64,${pngBuffer.toString('base64')}`

        frames.push({
          id: `custom-${base}`,
          name,
          layout,
          color: cfg.color || '#333333',
          showBranding: cfg.showBranding === true,
          overlay,
          custom: true,
        })
      } catch {
        console.warn(`Skip invalid frame: ${png}`)
      }
    }

    console.log(`✅ Loaded ${frames.length} custom frames from ${folder}`)
    res.json({ success: true, frames })
  } catch (err: unknown) {
    console.error('Frame load error:', err)
    const message =
      err instanceof Error ? err.message : 'Failed to load frames'
    res.status(500).json({ error: message })
  }
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
