import path from 'path'
import fs from 'fs'
import os from 'os'
import { execFile } from 'child_process'
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
const printScript = path.join(__dirname, 'print-selphy.ps1')
const PRINTER_NAME = 'Canon SELPHY CP1500'

function printImage(filePath: string, printerName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        printScript,
        '-ImagePath',
        filePath,
        '-PrinterName',
        printerName,
      ],
      { timeout: 60000, windowsHide: true },
      (error, stdout, stderr) => {
        const out = stdout?.trim() ?? ''
        const err = stderr?.trim() ?? ''
        if (out) console.log(out)
        if (err) console.error('Print stderr:', err)
        if (error) {
          reject(new Error(err || error.message))
          return
        }
        if (err && /error|exception|cannot find type/i.test(err)) {
          reject(new Error(err))
          return
        }
        resolve(out || 'Print job sent')
      },
    )
  })
}

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use('/uploads', express.static(uploadsDir))

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.post('/api/print', async (req, res) => {
  try {
    const { imageData, sessionId } = req.body
    if (!imageData) return res.status(400).json({ error: 'No image data' })

    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    const tmpFile = path.join(os.tmpdir(), `photobooth-${sessionId || Date.now()}.jpg`)
    await sharp(buffer)
      .resize(1181, 1748, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255 },
      })
      .jpeg({ quality: 98 })
      .withMetadata({ density: 300 })
      .toFile(tmpFile)

    const message = await printImage(tmpFile, PRINTER_NAME)
    setTimeout(() => fs.unlink(tmpFile, () => {}), 15000)
    console.log(message)
    res.json({ success: true, message })
  } catch (err: unknown) {
    console.error('Print endpoint error:', err)
    const message = err instanceof Error ? err.message : 'Print failed'
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
