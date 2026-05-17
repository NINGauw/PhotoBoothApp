import sharp from 'sharp'

async function main() {
  const buf = await sharp({
    create: {
      width: 1181,
      height: 1748,
      channels: 3,
      background: { r: 126, g: 200, b: 227 },
    },
  })
    .png()
    .toBuffer()

  const imageData = `data:image/png;base64,${buf.toString('base64')}`
  const sessionId = `test-${Date.now()}`

  console.log('Sending test print job...', sessionId)
  const res = await fetch('http://localhost:3001/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, sessionId }),
  })

  console.log('HTTP', res.status)
  console.log(await res.text())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
