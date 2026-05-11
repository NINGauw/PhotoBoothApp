import path from 'path'
import fs from 'fs'
import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 3001
const root = path.join(__dirname, '..')
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

app.listen(PORT, () => {
  console.log(`PhotoBooth server http://localhost:${PORT}`)
})
