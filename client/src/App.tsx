import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  ArrowLeft,
  Camera,
  Cog,
  Download,
  FlipHorizontal,
  Grid3x3,
  Lock,
  Play,
  Printer,
  RotateCcw,
  Smile,
  Sparkles,
  X,
} from 'lucide-react'

const CORAL = '#FF6B6B'
const BG = '#FFF5F7'

/** Print / compose canvas: 100mm × 148mm @ 300dpi */
const CANVAS_W = 1181
const CANVAS_H = 1748
/** Twin-strip layouts: each strip width; second strip x-offset */
const STRIP_W = 590
const STRIP_DUP_OFFSET = 591

/**
 * Enumerate devices first and prefer Camo Studio virtual camera.
 * Avoid `facingMode` so virtual webcams (Camo Studio, OBS, etc.) work on desktop Chrome.
 */
async function acquireVideoStream(): Promise<{
  stream: MediaStream
  activeLabel: string
}> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'Camera API not available. Use Chrome on https:// or http://localhost.',
    )
  }

  const devices = await navigator.mediaDevices.enumerateDevices()
  const videoDevices = devices.filter((d) => d.kind === 'videoinput')
  const camoDevice = videoDevices.find((d) =>
    d.label.toLowerCase().includes('camo'),
  )
  const targetDevice = camoDevice || videoDevices[0]

  if (!targetDevice) {
    throw new Error('No video input devices found')
  }

  const constraints: MediaStreamConstraints = {
    video: targetDevice
      ? {
          deviceId: { exact: targetDevice.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      : { width: { ideal: 1280 }, height: { ideal: 720 } },
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  return { stream, activeLabel: targetDevice?.label || 'Camera' }
}

type Slot = { x: number; y: number; w: number; h: number }

type Frame = {
  id: string
  name: string
  desc: string
  photos: number
  dup: boolean
  color: string
  slots: Slot[]
  brandY: number
}

const FRAMES: Frame[] = [
  {
    id: 'strip4',
    name: 'Classic Strip',
    desc: '4 photos · twin strips',
    photos: 4,
    dup: true,
    color: '#FFB6C1',
    slots: [
      { x: 30, y: 30, w: 530, h: 399 },
      { x: 30, y: 441, w: 530, h: 399 },
      { x: 30, y: 852, w: 530, h: 399 },
      { x: 30, y: 1263, w: 530, h: 400 },
    ],
    brandY: 1663,
  },
  {
    id: 'single',
    name: 'Portrait',
    desc: '1 large photo',
    photos: 1,
    dup: false,
    color: '#7EC8E3',
    slots: [{ x: 30, y: 30, w: 1121, h: 1633 }],
    brandY: 1663,
  },
  {
    id: 'grid4',
    name: 'Grid',
    desc: '4 photos · 2×2',
    photos: 4,
    dup: false,
    color: '#B8A9E8',
    slots: [
      { x: 30, y: 30, w: 554, h: 811 },
      { x: 596, y: 30, w: 554, h: 811 },
      { x: 30, y: 853, w: 554, h: 810 },
      { x: 596, y: 853, w: 554, h: 810 },
    ],
    brandY: 1663,
  },
  {
    id: 'strip3',
    name: 'Triple',
    desc: '3 photos · twin strips',
    photos: 3,
    dup: true,
    color: '#FFD700',
    slots: [
      { x: 30, y: 30, w: 530, h: 536 },
      { x: 30, y: 578, w: 530, h: 536 },
      { x: 30, y: 1126, w: 530, h: 537 },
    ],
    brandY: 1663,
  },
]

const FILTERS = [
  { id: 'none', name: 'Normal', css: 'none' },
  { id: 'bw', name: 'B&W', css: 'grayscale(100%)' },
  {
    id: 'vintage',
    name: 'Vintage',
    css: 'sepia(40%) contrast(90%) brightness(105%)',
  },
  {
    id: 'warm',
    name: 'Warm',
    css: 'sepia(20%) saturate(120%) brightness(105%)',
  },
  {
    id: 'cool',
    name: 'Cool',
    css: 'saturate(80%) hue-rotate(20deg) brightness(105%)',
  },
  {
    id: 'film',
    name: 'Film',
    css: 'contrast(110%) saturate(85%) brightness(95%)',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    css: 'saturate(70%) brightness(115%) contrast(85%)',
  },
  { id: 'vivid', name: 'Vivid', css: 'saturate(150%) contrast(110%)' },
  { id: 'sepia', name: 'Sepia', css: 'sepia(80%)' },
  {
    id: 'fade',
    name: 'Fade',
    css: 'contrast(80%) brightness(110%) saturate(70%)',
  },
] as const

const STICKER_EMOJIS = [
  '❤️',
  '⭐',
  '🎉',
  '🎊',
  '💍',
  '🥂',
  '🌸',
  '✨',
  '💫',
  '🎭',
  '👑',
  '🦋',
  '🌈',
  '💝',
  '🎀',
  '🌟',
  '💐',
  '🎵',
  '😍',
  '🥳',
  '🔥',
  '🍾',
  '💒',
  '🎶',
  '🌺',
]

const ATTRACT_EMOJIS = [
  '✨',
  '💫',
  '🌸',
  '⭐',
  '💝',
  '🎉',
  '🦋',
  '🌈',
  '❤️',
  '💐',
  '🎭',
  '🎊',
  '🥂',
  '👑',
  '🌺',
]

type Screen =
  | 'attract'
  | 'frameSelect'
  | 'camera'
  | 'review'
  | 'printing'
  | 'thanks'
  | 'admin'

type Sticker = {
  id: string
  emoji: string
  x: number
  y: number
  size: number
}

type AdminTab = 'projects' | 'frames' | 'stickers' | 'settings'

type ReviewTab = 'filters' | 'stickers' | 'frame' | 'flip'

const playBeep = (freq = 880) => {
  const ac = new AudioContext()
  const o = ac.createOscillator()
  const g = ac.createGain()
  o.connect(g)
  g.connect(ac.destination)
  o.frequency.value = freq
  o.type = 'sine'
  g.gain.value = 0.12
  o.start()
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1)
  o.stop(ac.currentTime + 0.1)
}

const playShutter = () => {
  const ac = new AudioContext()
  const buf = ac.createBuffer(1, ac.sampleRate * 0.12, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1200) * 0.25
  }
  const s = ac.createBufferSource()
  s.buffer = buf
  s.connect(ac.destination)
  s.start()
}

const genPlaceholder = (idx: number): string => {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 480
  const ctx = c.getContext('2d')!
  const colors = [
    '#FF9AA2',
    '#FFB7B2',
    '#FFDAC1',
    '#E2F0CB',
    '#B5EAD7',
    '#C7CEEA',
  ]
  const g = ctx.createLinearGradient(0, 0, 640, 480)
  g.addColorStop(0, colors[idx % colors.length])
  g.addColorStop(1, colors[(idx + 2) % colors.length])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 640, 480)
  ctx.fillStyle = '#FFF'
  ctx.font = 'bold 48px system-ui'
  ctx.textAlign = 'center'
  ctx.fillText(`Photo ${idx + 1}`, 320, 220)
  ctx.font = '24px system-ui'
  ctx.fillText('📸 Demo Mode', 320, 270)
  return c.toDataURL('image/jpeg')
}

function pathRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
  } else {
    ctx.rect(x, y, w, h)
  }
}

async function composeImage(
  frame: Frame,
  photos: (string | null)[],
  filterCss: string,
  stickers: Sticker[],
  flipped: boolean[],
  eventName: string,
  includeStickers = true,
): Promise<string> {
  const CW = CANVAS_W
  const CH = CANVAS_H
  const canvas = document.createElement('canvas')
  canvas.width = CW
  canvas.height = CH
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, CW, CH)

  const stripW = frame.dup ? STRIP_W : CANVAS_W
  const drawStrip = (ox: number) => {
    ctx.strokeStyle = frame.color
    ctx.lineWidth = 5
    pathRoundedRect(ctx, ox + 12, 12, stripW - 24, CH - 24, 16)
    ctx.stroke()

    frame.slots.forEach((s) => {
      ctx.fillStyle = '#F5F5F5'
      pathRoundedRect(ctx, s.x + ox, s.y, s.w, s.h, 8)
      ctx.fill()
    })

    ctx.fillStyle = frame.color
    ctx.font = 'bold 28px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(eventName, ox + stripW / 2, frame.brandY + 28)
    ctx.font = '18px system-ui'
    ctx.fillStyle = '#AAA'
    ctx.fillText(
      new Date().toLocaleDateString(),
      ox + stripW / 2,
      frame.brandY + 52,
    )
  }
  drawStrip(0)
  if (frame.dup) drawStrip(STRIP_DUP_OFFSET)

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image()
      img.onload = () => res(img)
      img.onerror = rej
      img.src = src
    })

  const imgs = await Promise.all(
    photos.map((p) => (p ? loadImg(p) : Promise.resolve(null))),
  )

  const drawSlots = (ox: number) => {
    frame.slots.forEach((s, i) => {
      if (!imgs[i]) return
      ctx.save()
      pathRoundedRect(ctx, s.x + ox, s.y, s.w, s.h, 8)
      ctx.clip()
      if (filterCss !== 'none') ctx.filter = filterCss
      const ir = imgs[i]!.width / imgs[i]!.height
      const sr = s.w / s.h
      let sw: number
      let sh: number
      let sx: number
      let sy: number
      if (ir > sr) {
        sh = imgs[i]!.height
        sw = sh * sr
        sx = (imgs[i]!.width - sw) / 2
        sy = 0
      } else {
        sw = imgs[i]!.width
        sh = sw / sr
        sx = 0
        sy = (imgs[i]!.height - sh) / 2
      }
      if (flipped[i]) {
        ctx.translate(s.x + ox + s.w, s.y)
        ctx.scale(-1, 1)
        ctx.drawImage(imgs[i]!, sx, sy, sw, sh, 0, 0, s.w, s.h)
      } else {
        ctx.drawImage(imgs[i]!, sx, sy, sw, sh, s.x + ox, s.y, s.w, s.h)
      }
      ctx.restore()
    })
  }
  drawSlots(0)
  if (frame.dup) drawSlots(STRIP_DUP_OFFSET)

  if (includeStickers) {
    stickers.forEach((st) => {
      ctx.filter = 'none'
      ctx.font = `${st.size * 2}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(st.emoji, st.x, st.y)
    })
  }

  return canvas.toDataURL('image/png')
}

function FrameLayoutPreview({ frame }: { frame: Frame }) {
  const scale = 0.045
  if (frame.id === 'single') {
    return (
      <div
        className="flex h-24 w-full items-center justify-center rounded-lg bg-gray-50 p-2"
        style={{ borderColor: frame.color, borderWidth: 2, borderStyle: 'solid' }}
      >
        <div
          className="rounded-md bg-white shadow-inner"
          style={{
            width: frame.slots[0]!.w * scale,
            height: frame.slots[0]!.h * scale,
            backgroundColor: `${frame.color}33`,
          }}
        />
      </div>
    )
  }
  if (frame.id === 'grid4') {
    return (
      <div
        className="grid h-24 w-full grid-cols-2 gap-1 rounded-lg bg-gray-50 p-2"
        style={{ borderColor: frame.color, borderWidth: 2, borderStyle: 'solid' }}
      >
        {frame.slots.map((s, i) => (
          <div
            key={i}
            className="rounded-md shadow-inner"
            style={{
              backgroundColor: `${frame.color}44`,
              minHeight: s.h * scale * 0.5,
            }}
          />
        ))}
      </div>
    )
  }
  return (
    <div className="flex h-24 w-full gap-1 rounded-lg bg-gray-50 p-2">
      {[0, 1].map((col) => (
        <div
          key={col}
          className="flex flex-1 flex-col gap-1 rounded-md p-1"
          style={{
            borderColor: frame.color,
            borderWidth: 2,
            borderStyle: 'solid',
          }}
        >
          {frame.slots.map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm shadow-inner"
              style={{ backgroundColor: `${frame.color}44` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('attract')
  const [eventName, setEventName] = useState('PhotoBooth ✨')
  const [selectedFrame, setSelectedFrame] = useState<Frame | null>(null)
  // ALL photos ever captured in this session — never deleted
  const [capturedBank, setCapturedBank] = useState<string[]>([])
  // Which photo from the bank goes into each slot. Index = slot position, value = bank index
  const [slotAssignment, setSlotAssignment] = useState<number[]>([])
  // Which slot is being reassigned (for the picker UI)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  // flipped is indexed by bank index (length = capturedBank.length)
  const [flipped, setFlipped] = useState<boolean[]>([])
  // photoIdx is used for capture/retake; in normal capture it equals bank index being written
  const [photoIdx, setPhotoIdx] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [allCaptured, setAllCaptured] = useState(false)
  const [flash, setFlash] = useState(false)
  const [retakeMode, setRetakeMode] = useState(false)
  const [demoMode, setDemoMode] = useState(false)
  const [filterId, setFilterId] = useState<string>('none')
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [reviewTab, setReviewTab] = useState<ReviewTab>('filters')
  const [composedDataUrl, setComposedDataUrl] = useState<string>('')
  const [printProg, setPrintProg] = useState(0)
  const [thanksSec, setThanksSec] = useState(10)
  const [adminTab, setAdminTab] = useState<AdminTab>('settings')
  const [cdSetting, setCdSetting] = useState<3 | 5 | 7>(3)
  const [soundOn, setSoundOn] = useState(true)
  const [lastThumb, setLastThumb] = useState<string | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('Camera')
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoDone, setAutoDone] = useState(false)
  const [allowRetake, setAllowRetake] = useState(true)
  const [boothSettingsOpen, setBoothSettingsOpen] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const stickerOverlayRef = useRef<HTMLDivElement>(null)
  const autoRef = useRef<{
    currentIdx: number
    total: number
    startIdx: number
    retake: boolean
  } | null>(null)
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    origX: number
    origY: number
  } | null>(null)

  const activePhotos = slotAssignment.map(
    (bankIdx) => capturedBank[bankIdx] ?? null,
  )

  const filterCss =
    FILTERS.find((f) => f.id === filterId)?.css ?? 'none'

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const reset = useCallback(() => {
    stopCamera()
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setScreen('attract')
    setSelectedFrame(null)
    setCapturedBank([])
    setSlotAssignment([])
    setActiveSlot(null)
    setFlipped([])
    setPhotoIdx(0)
    setCountdown(0)
    setAllCaptured(false)
    setFlash(false)
    setRetakeMode(false)
    setDemoMode(false)
    setFilterId('none')
    setStickers([])
    setReviewTab('filters')
    setComposedDataUrl('')
    setPrintProg(0)
    setThanksSec(10)
    setLastThumb(null)
    setCameraError(null)
    setActiveCameraLabel('Camera')
    setAutoRunning(false)
    setAutoDone(false)
    autoRef.current = null
  }, [stopCamera])

  useEffect(() => {
    if (screen !== 'camera') {
      stopCamera()
      return
    }
    let cancelled = false
    setCameraError(null)
    setDemoMode(false)
    void (async () => {
      try {
        const { stream, activeLabel } = await acquireVideoStream()
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        setActiveCameraLabel(activeLabel || 'Camera')
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          await v.play().catch(() => {})
        }
      } catch (e) {
        if (cancelled) return
        setCameraError(e instanceof Error ? e.message : String(e))
        setDemoMode(true)
      }
    })()
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [screen, stopCamera])

  // Device selection is automatic (prefer Camo); no admin picker needed.

  useEffect(() => {
    if (screen === 'attract' || screen === 'admin') return
    const bump = () => {
      lastActivityRef.current = Date.now()
    }
    bump()
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)
    const id = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > 60_000) {
        stopCamera()
        reset()
      }
    }, 1000)
    return () => {
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
      window.clearInterval(id)
    }
  }, [screen, reset, stopCamera])

  useEffect(() => {
    if (screen !== 'review' || !selectedFrame) return
    let cancelled = false
    void composeImage(
      selectedFrame,
      activePhotos,
      filterCss,
      stickers,
      flipped,
      eventName,
      false,
    ).then((url) => {
      if (!cancelled) setComposedDataUrl(url)
    })
    return () => {
      cancelled = true
    }
  }, [screen, selectedFrame, activePhotos, filterCss, stickers, flipped, eventName])

  useEffect(() => {
    if (screen !== 'printing') return
    setPrintProg(0)
    const timer = window.setInterval(() => {
      setPrintProg((p) => {
        const n = p + 2
        if (n >= 100) {
          window.clearInterval(timer)
          window.setTimeout(() => setScreen('thanks'), 500)
          return 100
        }
        return n
      })
    }, 60)
    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (screen !== 'thanks') return
    setThanksSec(10)
    const id = window.setInterval(() => {
      setThanksSec((s) => {
        if (s <= 1) {
          reset()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [screen, reset])

  const capturePhoto = useCallback(() => {
    if (demoMode) return genPlaceholder(photoIdx)
    const v = videoRef.current
    if (!v || !v.videoWidth) return genPlaceholder(photoIdx)
    const c = document.createElement('canvas')
    c.width = v.videoWidth
    c.height = v.videoHeight
    c.getContext('2d')!.drawImage(v, 0, 0)
    return c.toDataURL('image/jpeg', 0.92)
  }, [demoMode, photoIdx])

  const changeFrame = useCallback(
    (newFrame: Frame) => {
      setSelectedFrame(newFrame)
      const bankLen = capturedBank.length
      if (bankLen === 0) {
        setSlotAssignment(Array(newFrame.photos).fill(0))
        return
      }
      const newAssignment = Array.from(
        { length: newFrame.photos },
        (_, i) => (i < bankLen ? i : i % bankLen),
      )
      setSlotAssignment(newAssignment)
    },
    [capturedBank.length],
  )

  const startAutoCapture = useCallback(() => {
    if (!selectedFrame || countdownRef.current || autoRunning) return

    const total = retakeMode ? 1 : selectedFrame.photos
    const startIdx = retakeMode ? photoIdx : 0

    autoRef.current = {
      currentIdx: 0,
      total,
      startIdx,
      retake: retakeMode,
    }

    setAutoRunning(true)
    setAutoDone(false)
    setAllCaptured(false)
    setLastThumb(null)

    const captureNext = () => {
      const st = autoRef.current
      if (!st) return
      if (st.currentIdx >= st.total) {
        setAutoDone(true)
        window.setTimeout(() => {
          setAutoRunning(false)
          setRetakeMode(false)
          stopCamera()
          setScreen('review')
        }, 800)
        return
      }

      const idx = st.startIdx + st.currentIdx
      setPhotoIdx(idx)

      let t = cdSetting
      setCountdown(t)
      countdownRef.current = window.setInterval(() => {
        t -= 1
        if (t > 0) {
          setCountdown(t)
          if (soundOn) playBeep(660 + t * 100)
        } else {
          if (countdownRef.current) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
          }
          setCountdown(0)
          if (soundOn) playShutter()
          setFlash(true)
          window.setTimeout(() => setFlash(false), 200)

          const dataUrl = capturePhoto()
          setCapturedBank((prev) => {
            const next = [...prev]
            next[idx] = dataUrl
            return next
          })
          setFlipped((prev) => {
            const next = [...prev]
            if (next[idx] == null) next[idx] = false
            return next
          })
          setLastThumb(dataUrl)

          st.currentIdx += 1
          window.setTimeout(() => {
            setLastThumb(null)
            captureNext()
          }, 1000)
        }
      }, 1000)
    }

    captureNext()
  }, [
    selectedFrame,
    cdSetting,
    soundOn,
    capturePhoto,
    autoRunning,
    photoIdx,
    retakeMode,
    stopCamera,
    setCapturedBank,
  ])

  const exitCamera = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    setCountdown(0)
    reset()
  }

  const goPrint = () => {
    if (!selectedFrame) return
    void (async () => {
      const url = await composeImage(
        selectedFrame,
        activePhotos,
        filterCss,
        stickers,
        flipped,
        eventName,
        true,
      )
      void fetch('/api/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: url }),
      }).catch(() => {})
      setScreen('printing')
    })()
  }

  const downloadComposed = () => {
    if (!selectedFrame) return
    void (async () => {
      const url = await composeImage(
        selectedFrame,
        activePhotos,
        filterCss,
        stickers,
        flipped,
        eventName,
        true,
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `photobooth-${Date.now()}.png`
      a.click()
    })()
  }

  const onStickerPointerDown = (
    e: React.PointerEvent,
    id: string,
    x: number,
    y: number,
  ) => {
    e.stopPropagation()
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: x,
      origY: y,
    }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      const el = stickerOverlayRef.current
      if (!d || !el) return
      const rect = el.getBoundingClientRect()
      const dx = ((e.clientX - d.startX) / rect.width) * CANVAS_W
      const dy = ((e.clientY - d.startY) / rect.height) * CANVAS_H
      setStickers((prev) =>
        prev.map((s) =>
          s.id === d.id
            ? {
                ...s,
                x: Math.min(CANVAS_W - 20, Math.max(20, d.origX + dx)),
                y: Math.min(CANVAS_H - 20, Math.max(20, d.origY + dy)),
              }
            : s,
        ),
      )
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const attractFloaters = ATTRACT_EMOJIS.map((emoji, i) => ({
    emoji,
    left: `${5 + (i * 6.2) % 88}%`,
    top: `${8 + ((i * 13) % 72)}%`,
    delay: `${(i * 0.25).toFixed(2)}s`,
    duration: `${2.8 + (i % 5) * 0.35}s`,
  }))

  return (
    <div
      className="h-[100dvh] w-screen overflow-hidden font-sans text-gray-900 antialiased"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {screen === 'attract' && (
        <div
          className="relative flex h-full w-full flex-col items-center justify-center"
          style={{
            background:
              'linear-gradient(135deg, #7EC8E340, #FFB6C150, #FFF5F7)',
          }}
        >
          <button
            type="button"
            aria-label="Admin"
            className="absolute right-4 top-[4.5rem] z-20 opacity-10 transition-opacity hover:opacity-70"
            onClick={() => setScreen('admin')}
          >
            <Lock className="h-8 w-8 text-gray-700" />
          </button>
          <button
            type="button"
            className="absolute right-4 top-4 z-20 flex min-h-[48px] items-center gap-2 rounded-full border border-gray-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-md transition hover:bg-gray-50 active:scale-[0.98]"
            onClick={() => setBoothSettingsOpen(true)}
          >
            <Cog className="h-5 w-5 shrink-0 text-gray-700" />
            Settings
          </button>
          {boothSettingsOpen ? (
            <div
              className="absolute inset-0 z-30 flex items-center justify-center bg-black/35 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="booth-settings-title"
              onClick={() => setBoothSettingsOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2
                    id="booth-settings-title"
                    className="flex items-center gap-2 text-lg font-bold text-gray-900"
                  >
                    <Cog className="h-5 w-5 text-gray-600" />
                    Booth Settings
                  </h2>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
                    aria-label="Close settings"
                    onClick={() => setBoothSettingsOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-gray-900">
                        Allow Retake
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        Let guests retake individual photos after capture
                      </p>
                    </div>
                    <label className="flex shrink-0 cursor-pointer items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">
                        {allowRetake ? 'ON' : 'OFF'}
                      </span>
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-gray-300 text-[#FF6B6B] focus:ring-[#FF6B6B]"
                        checked={allowRetake}
                        onChange={(e) => setAllowRetake(e.target.checked)}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          {attractFloaters.map((f, i) => (
            <span
              key={i}
              className="anim-float pointer-events-none absolute select-none text-3xl md:text-4xl"
              style={
                {
                  left: f.left,
                  top: f.top,
                  animationDelay: f.delay,
                  animationDuration: f.duration,
                } as CSSProperties
              }
            >
              {f.emoji}
            </span>
          ))}
          <div className="relative z-10 flex flex-col items-center px-6 text-center">
            <div className="mb-4 text-8xl">📸</div>
            <h1
              className="mb-3 text-4xl font-bold sm:text-5xl"
              style={{ color: CORAL }}
            >
              {eventName}
            </h1>
            <p className="mb-10 max-w-md text-lg text-gray-600">
              Strike a pose · Get your prints · Keep the memories
            </p>
            <div className="relative">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#FF6B6B] opacity-15" />
              <button
                type="button"
                className="relative min-h-[48px] rounded-full px-14 py-5 text-2xl font-semibold text-white shadow-xl transition active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${CORAL}, #ff8787)`,
                  boxShadow: `0 12px 40px ${CORAL}55`,
                }}
                onClick={() => setScreen('frameSelect')}
              >
                TAP TO START ✨
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'frameSelect' && (
        <div
          className="flex h-full flex-col"
          style={{ backgroundColor: BG }}
        >
          <header className="flex min-h-[56px] items-center gap-3 border-b border-pink-100 bg-white/90 px-4 py-3 shadow-sm backdrop-blur">
            <button
              type="button"
              className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-xl bg-gray-100 text-gray-700"
              onClick={() => setScreen('attract')}
              aria-label="Back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <h2 className="text-xl font-bold text-gray-800">
              Choose Your Frame
            </h2>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2">
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`flex flex-col rounded-2xl border-4 bg-white p-4 text-left shadow-lg transition ${
                    selectedFrame?.id === f.id
                      ? 'border-[#FF6B6B]'
                      : 'border-transparent'
                  }`}
                  onClick={() => setSelectedFrame(f)}
                >
                  <FrameLayoutPreview frame={f} />
                  <div className="mt-3">
                    <div className="text-lg font-bold text-gray-900">
                      {f.name}
                    </div>
                    <div className="text-sm text-gray-500">{f.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mx-auto mt-6 max-w-4xl">
              <button
                type="button"
                disabled={!selectedFrame}
                className="min-h-[52px] w-full rounded-full py-4 text-lg font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, ${CORAL}, #ff8787)`,
                }}
                onClick={() => {
                  if (!selectedFrame) return
                  setCapturedBank([])
                  setFlipped([])
                  setSlotAssignment(
                    Array.from({ length: selectedFrame.photos }, (_, i) => i),
                  )
                  setActiveSlot(null)
                  setPhotoIdx(0)
                  setAllCaptured(false)
                  setRetakeMode(false)
                  setCountdown(0)
                  setLastThumb(null)
                  if (countdownRef.current) {
                    clearInterval(countdownRef.current)
                    countdownRef.current = null
                  }
                  setScreen('camera')
                }}
              >
                Let&apos;s Go! 📸
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'camera' && selectedFrame && (
        <div className="relative flex h-full flex-col bg-gray-950">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
            <div className="pointer-events-auto flex items-center justify-between text-white">
              <button
                type="button"
                className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-full bg-white/10"
                onClick={exitCamera}
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
              <div className="flex flex-col items-center gap-2">
                {!autoDone ? (
                  <>
                    <div className="flex items-center gap-2">
                      {Array.from({ length: selectedFrame.photos }).map((_, i) => {
                        const isCaptured = Boolean(capturedBank[i])
                        const isCurrent =
                          autoRunning && i === photoIdx && !isCaptured
                        return (
                          <span
                            key={i}
                            className="inline-block h-3 w-3 rounded-full"
                            style={{
                              backgroundColor: isCaptured
                                ? CORAL
                                : isCurrent
                                  ? CORAL
                                  : '#6b7280',
                              opacity: isCaptured ? 1 : isCurrent ? 1 : 0.55,
                              transform: isCurrent ? 'scale(1.15)' : 'scale(1)',
                              boxShadow: isCurrent
                                ? `0 0 0 6px ${CORAL}22`
                                : undefined,
                              transition: 'transform 150ms ease',
                            }}
                          />
                        )
                      })}
                      <span className="ml-1 text-sm text-white/90">
                        {Math.min(
                          selectedFrame.photos,
                          capturedBank.slice(0, selectedFrame.photos).filter(Boolean).length,
                        )}{' '}
                        / {selectedFrame.photos}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="rounded-full bg-white/10 px-4 py-1 text-sm font-semibold">
                    All done! ✓
                  </div>
                )}
              </div>
              <div className="w-10" />
            </div>
          </div>

          <div className="absolute left-4 top-[84px] z-20 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
            Cam:{' '}
            {(activeCameraLabel || 'Camera').slice(0, 20)}
            {(activeCameraLabel || '').length > 20 ? '…' : ''}
          </div>

          {demoMode && (
            <div className="absolute left-1/2 top-20 z-20 flex max-w-[90vw] -translate-x-1/2 flex-col items-center gap-1 rounded-2xl bg-black/70 px-4 py-2 text-center text-sm text-white">
              <span>Demo Mode — no camera stream</span>
              {cameraError ? (
                <span className="text-xs text-amber-200">{cameraError}</span>
              ) : null}
            </div>
          )}

          <div className="relative flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="absolute left-1/2 top-1/2 min-h-[120%] min-w-[120%] object-cover"
              style={{
                transform: 'translate(-50%, -50%) scaleX(-1)',
              }}
              autoPlay
              playsInline
              muted
            />
            {demoMode && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white"
                style={{
                  background:
                    'linear-gradient(135deg, #7EC8E3aa, #FFB6C1aa)',
                }}
              >
                <Camera className="h-16 w-16 opacity-90" />
                <p className="text-lg font-medium">Demo Mode</p>
              </div>
            )}

            {countdown > 0 && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
                <span
                  key={countdown}
                  className="anim-countPop text-9xl font-black text-white"
                  style={{ textShadow: `0 8px 32px ${CORAL}` }}
                >
                  {countdown}
                </span>
              </div>
            )}

            {flash && (
              <div
                className="pointer-events-none absolute inset-0 z-[25] bg-white"
                style={{ animation: 'flashOut 0.2s ease-out forwards' }}
              />
            )}

            {lastThumb && !allCaptured && (
              <div className="anim-slideup absolute bottom-24 left-4 z-20 h-20 w-16 overflow-hidden rounded-lg border-2 border-white shadow-xl">
                <img
                  src={lastThumb}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-6 pb-8 pt-16">
            <div className="pointer-events-auto flex justify-center">
              {!autoRunning ? (
                <button
                  type="button"
                  disabled={countdown > 0 || demoMode}
                  className="flex h-20 w-20 min-h-[48px] items-center justify-center rounded-full border-4 border-white shadow-xl disabled:opacity-40"
                  style={{ backgroundColor: CORAL }}
                  onClick={startAutoCapture}
                  aria-label="Capture"
                >
                  <Play className="h-9 w-9 text-white" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {screen === 'review' && selectedFrame && (
        <div
          className="flex h-full flex-row bg-gray-100"
          style={{ backgroundColor: BG }}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
            <div
              className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
              style={{ aspectRatio: '1181/1748', maxHeight: '82vh' }}
            >
              {composedDataUrl ? (
                <img
                  src={composedDataUrl}
                  alt="Composed"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">
                  Composing…
                </div>
              )}
              <div
                ref={stickerOverlayRef}
                className="pointer-events-none absolute inset-0"
              >
                {stickers.map((st) => (
                  <div
                    key={st.id}
                    className="pointer-events-auto absolute"
                    style={{
                      left: `${(st.x / CANVAS_W) * 100}%`,
                      top: `${(st.y / CANVAS_H) * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${st.size}px`,
                      lineHeight: 1,
                    }}
                    onPointerDown={(e) =>
                      onStickerPointerDown(e, st.id, st.x, st.y)
                    }
                  >
                    <span className="select-none">{st.emoji}</span>
                    <button
                      type="button"
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow"
                      onClick={(e) => {
                        e.stopPropagation()
                        setStickers((prev) => prev.filter((x) => x.id !== st.id))
                      }}
                    >
                      ×
                    </button>
                    <div className="absolute -bottom-6 right-0 flex gap-1">
                      <button
                        type="button"
                        className="rounded bg-gray-800/80 px-1.5 text-xs text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          setStickers((prev) =>
                            prev.map((x) =>
                              x.id === st.id
                                ? { ...x, size: Math.max(16, x.size - 4) }
                                : x,
                            ),
                          )
                        }}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="rounded bg-gray-800/80 px-1.5 text-xs text-white"
                        onClick={(e) => {
                          e.stopPropagation()
                          setStickers((prev) =>
                            prev.map((x) =>
                              x.id === st.id
                                ? { ...x, size: Math.min(120, x.size + 4) }
                                : x,
                            ),
                          )
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mx-auto w-full max-w-2xl rounded-2xl border border-gray-100 bg-white p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-bold tracking-wide text-gray-700">
                  YOUR PHOTOS
                </div>
                {allowRetake ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700"
                    onClick={() => {
                      // Retake uses active slot if one is selected; otherwise retake the first slot.
                      const slotIdx = activeSlot ?? 0
                      const bankIdx = slotAssignment[slotIdx] ?? 0
                      setPhotoIdx(bankIdx)
                      setRetakeMode(true)
                      setAllCaptured(false)
                      setAutoRunning(false)
                      setAutoDone(false)
                      setCountdown(0)
                      if (countdownRef.current) {
                        clearInterval(countdownRef.current)
                        countdownRef.current = null
                      }
                      setScreen('camera')
                    }}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retake
                  </button>
                ) : null}
              </div>

              <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                {capturedBank.map((p, i) => (
                  <div
                    key={i}
                    className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                    style={{ filter: filterCss === 'none' ? undefined : filterCss }}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(i))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                  >
                    <img src={p} alt="" className="h-full w-full object-cover" />
                    <span
                      className="absolute left-1 top-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: CORAL }}
                    >
                      {i + 1}
                    </span>
                  </div>
                ))}
                {capturedBank.length === 0 ? (
                  <div className="text-sm text-gray-400">No photos yet.</div>
                ) : null}
              </div>

              <div className="mb-2 text-sm font-bold tracking-wide text-gray-700">
                FRAME SLOTS
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: selectedFrame.photos }).map((_, slotIdx) => {
                  const bankIdx = slotAssignment[slotIdx] ?? 0
                  const src = capturedBank[bankIdx] ?? null
                  const isActive = activeSlot === slotIdx
                  return (
                    <div key={slotIdx} className="flex items-center gap-2">
                      <button
                        type="button"
                        className="relative h-14 w-20 overflow-hidden rounded-xl border-2 bg-gray-50 shadow-sm"
                        style={{
                          borderColor: isActive ? CORAL : '#e5e7eb',
                        }}
                        onClick={() => setActiveSlot(slotIdx)}
                        onDoubleClick={() => setActiveSlot((s) => (s === slotIdx ? null : slotIdx))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          const data = e.dataTransfer.getData('text/plain')
                          const nextIdx = Number(data)
                          if (!Number.isFinite(nextIdx)) return
                          if (nextIdx < 0 || nextIdx >= capturedBank.length) return
                          setSlotAssignment((prev) => {
                            const next = [...prev]
                            next[slotIdx] = nextIdx
                            return next
                          })
                        }}
                      >
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            className="h-full w-full object-cover"
                            style={{
                              transform: flipped[bankIdx] ? 'scaleX(-1)' : undefined,
                              filter: filterCss === 'none' ? undefined : filterCss,
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                            Slot {slotIdx + 1}
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          [{bankIdx + 1}] ↕
                        </span>
                      </button>

                      {slotIdx < selectedFrame.photos - 1 ? (
                        <button
                          type="button"
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700"
                          aria-label="Swap slots"
                          onClick={() => {
                            setSlotAssignment((prev) => {
                              const next = [...prev]
                              const a = next[slotIdx] ?? 0
                              const b = next[slotIdx + 1] ?? 0
                              next[slotIdx] = b
                              next[slotIdx + 1] = a
                              return next
                            })
                          }}
                        >
                          ⇄
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </div>

            {activeSlot != null && capturedBank.length > 0 ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
                  <div className="mb-3 text-center text-sm font-bold text-gray-800">
                    Choose photo for Slot {activeSlot + 1}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {capturedBank.map((p, i) => {
                      const isSel = (slotAssignment[activeSlot] ?? 0) === i
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`relative overflow-hidden rounded-xl border-2 ${isSel ? 'border-[#FF6B6B]' : 'border-gray-200'}`}
                          onClick={() => {
                            setSlotAssignment((prev) => {
                              const next = [...prev]
                              next[activeSlot] = i
                              return next
                            })
                            setActiveSlot(null)
                          }}
                        >
                          <div className="aspect-[4/3] w-full bg-gray-100">
                            <img src={p} alt="" className="h-full w-full object-cover" />
                          </div>
                          <span
                            className="absolute left-1 top-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: CORAL }}
                          >
                            {i + 1}
                          </span>
                          {isSel ? (
                            <span className="absolute right-1 top-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-bold text-white">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-700"
                    onClick={() => setActiveSlot(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="flex w-64 shrink-0 flex-col border-l border-pink-100 bg-white shadow-xl">
            <div className="flex border-b border-gray-100">
              {(
                [
                  ['filters', Sparkles],
                  ['stickers', Smile],
                  ['frame', Grid3x3],
                  ['flip', FlipHorizontal],
                ] as const
              ).map(([id, Icon]) => (
                <button
                  key={id}
                  type="button"
                  className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 py-2 text-xs font-medium ${
                    reviewTab === id
                      ? 'border-b-2 text-[#FF6B6B]'
                      : 'border-b-2 border-transparent text-gray-500'
                  }`}
                  style={{
                    borderBottomColor: reviewTab === id ? CORAL : 'transparent',
                  }}
                  onClick={() => setReviewTab(id)}
                >
                  <Icon className="h-5 w-5" />
                  {id[0]!.toUpperCase() + id.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {reviewTab === 'filters' && (
                <div className="grid grid-cols-3 gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`overflow-hidden rounded-xl border-2 bg-gray-50 ${
                        filterId === f.id ? 'border-[#FF6B6B] ring-2 ring-[#FF6B6B]/30' : 'border-transparent'
                      }`}
                      onClick={() => setFilterId(f.id)}
                    >
                      <div
                        className="aspect-square w-full overflow-hidden bg-gray-200"
                        style={{
                          filter: f.css === 'none' ? undefined : f.css,
                        }}
                      >
                        {activePhotos[0] ? (
                          <img
                            src={activePhotos[0]!}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="px-1 py-1 text-center text-[10px] font-medium text-gray-700">
                        {f.name}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {reviewTab === 'stickers' && (
                <div>
                  <p className="mb-2 text-xs text-gray-500">
                    Tap to add · Drag to move · ± to resize
                  </p>
                  <div className="grid grid-cols-5 gap-1">
                    {STICKER_EMOJIS.map((em, i) => (
                      <button
                        key={`${em}-${i}`}
                        type="button"
                        className="flex min-h-[40px] items-center justify-center rounded-lg bg-gray-50 text-xl hover:bg-gray-100"
                        onClick={() =>
                          setStickers((s) => [
                            ...s,
                            {
                              id: crypto.randomUUID(),
                              emoji: em,
                              x:
                                CANVAS_W / 2 -
                                40 +
                                Math.random() * 80,
                              y:
                                CANVAS_H / 2 -
                                40 +
                                Math.random() * 80,
                              size: 36,
                            },
                          ])
                        }
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  {stickers.length > 0 && (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-lg border border-red-200 py-2 text-sm text-red-600"
                      onClick={() => setStickers([])}
                    >
                      Clear all stickers
                    </button>
                  )}
                </div>
              )}

              {reviewTab === 'frame' && (
                <div className="grid grid-cols-2 gap-2">
                  {FRAMES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={`rounded-xl border-2 bg-white p-2 text-left text-xs shadow ${
                        selectedFrame.id === f.id
                          ? 'border-[#FF6B6B]'
                          : 'border-transparent'
                      }`}
                      onClick={() => {
                        changeFrame(f)
                      }}
                    >
                      <FrameLayoutPreview frame={f} />
                      <div className="mt-1 font-semibold">{f.name}</div>
                    </button>
                  ))}
                  <div className="flex min-h-[88px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-center text-[11px] text-gray-400">
                    Upload Frame
                    <span className="text-[10px]">(placeholder)</span>
                  </div>
                </div>
              )}

              {reviewTab === 'flip' && (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: selectedFrame.photos }).map((_, slotIdx) => {
                    const bankIdx = slotAssignment[slotIdx] ?? 0
                    const p = capturedBank[bankIdx]
                    if (!p) return null
                    return (
                      <button
                        key={slotIdx}
                        type="button"
                        className="flex min-h-[52px] items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-2 py-2 text-left"
                        onClick={() =>
                          setFlipped((fl) => {
                            const n = [...fl]
                            n[bankIdx] = !n[bankIdx]
                            return n
                          })
                        }
                      >
                        <img
                          src={p}
                          alt=""
                          className="h-12 w-10 rounded-md object-cover"
                          style={{
                            transform: flipped[bankIdx] ? 'scaleX(-1)' : undefined,
                          }}
                        />
                        <span className="flex-1 text-sm font-medium">
                          Slot {slotIdx + 1} → Photo {bankIdx + 1}
                        </span>
                        <FlipHorizontal className="h-5 w-5 text-gray-500" />
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-gray-100 p-3">
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl py-3.5 font-semibold text-white shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${CORAL}, #ff8787)`,
                }}
                onClick={goPrint}
              >
                <Printer className="h-5 w-5" />
                PRINT
              </button>
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 font-medium text-gray-700"
                onClick={downloadComposed}
              >
                <Download className="h-5 w-5" />
                Save
              </button>
              <button
                type="button"
                className="w-full py-2 text-center text-sm text-gray-500 underline"
                onClick={reset}
              >
                Start Over
              </button>
            </div>
          </aside>
        </div>
      )}

      {screen === 'printing' && (
        <div
          className="flex h-full flex-col items-center justify-center gap-6"
          style={{
            background:
              'linear-gradient(135deg, #7EC8E340, #FFB6C150, #FFF5F7)',
          }}
        >
          <div className="relative h-36 w-36">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke="#eee"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="none"
                stroke={CORAL}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={264}
                strokeDashoffset={264 * (1 - printProg / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Printer className="h-10 w-10 text-gray-700" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-xl font-semibold text-gray-800">Printing…</p>
            <p className="text-gray-600">{printProg}%</p>
          </div>
        </div>
      )}

      {screen === 'thanks' && (
        <div
          className="flex h-full flex-col items-center justify-center px-6"
          style={{
            background:
              'linear-gradient(135deg, #7EC8E340, #FFB6C150, #FFF5F7)',
          }}
        >
          <div className="mb-4 text-7xl">📸</div>
          <h2
            className="mb-2 text-3xl font-bold sm:text-4xl"
            style={{ color: CORAL }}
          >
            Grab your photo!
          </h2>
          <p className="mb-6 text-lg text-gray-600">{eventName}</p>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-xl bg-gray-200 text-center text-sm text-gray-500">
              Scan for digital gallery
            </div>
            <p className="text-center text-sm text-gray-500">
              Returning in {thanksSec}s…
            </p>
          </div>
        </div>
      )}

      {screen === 'admin' && (
        <div className="flex h-full bg-gray-100">
          <nav className="flex w-56 flex-col border-r border-gray-200 bg-white shadow-sm">
            <div className="p-4 text-lg font-bold text-gray-800">Admin</div>
            {(
              [
                ['projects', 'Projects'],
                ['frames', 'Frames'],
                ['stickers', 'Stickers'],
                ['settings', 'Settings'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`px-4 py-3 text-left text-sm font-medium ${
                  adminTab === id
                    ? 'border-l-4 bg-pink-50 text-[#FF6B6B]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                style={{ borderLeftColor: adminTab === id ? CORAL : 'transparent' }}
                onClick={() => setAdminTab(id)}
              >
                {label}
              </button>
            ))}
            <div className="mt-auto p-3">
              <button
                type="button"
                className="w-full rounded-xl bg-[#FF6B6B] py-3 text-sm font-semibold text-white shadow"
                onClick={() => setScreen('attract')}
              >
                ← Launch Booth
              </button>
            </div>
          </nav>
          <div className="flex-1 overflow-y-auto p-6">
            {adminTab === 'projects' && (
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-gray-900">Projects</h3>
                {[
                  { name: 'Spring Gala 2026', status: 'active' },
                  { name: 'Company Holiday Party', status: 'draft' },
                  { name: "Alex & Sam's Wedding", status: 'completed' },
                ].map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <span className="font-medium text-gray-800">{p.name}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        p.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : p.status === 'draft'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {adminTab === 'settings' && (
              <div className="max-w-md space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Settings</h3>
                <label className="block text-sm font-medium text-gray-700">
                  Event Name
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-3 text-base shadow-sm"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                  />
                </label>
                <p className="text-xs text-gray-500">
                  Camera selection is automatic: it will prefer a device whose
                  label contains “Camo”, otherwise the first available camera.
                </p>
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    Countdown
                  </p>
                  <div className="flex gap-2">
                    {([3, 5, 7] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`min-h-[48px] flex-1 rounded-xl border-2 py-2 font-semibold ${
                          cdSetting === s
                            ? 'border-[#FF6B6B] bg-pink-50 text-[#FF6B6B]'
                            : 'border-gray-200 bg-white text-gray-700'
                        }`}
                        onClick={() => setCdSetting(s)}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex min-h-[48px] cursor-pointer items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <span className="font-medium text-gray-800">Sound</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[#FF6B6B]"
                    checked={soundOn}
                    onChange={(e) => setSoundOn(e.target.checked)}
                  />
                </label>
              </div>
            )}
            {adminTab === 'frames' && (
              <div>
                <h3 className="mb-4 text-xl font-bold text-gray-900">
                  Frames
                </h3>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {FRAMES.map((f) => (
                    <div
                      key={f.id}
                      className="rounded-2xl border border-gray-200 bg-white p-3 shadow"
                    >
                      <FrameLayoutPreview frame={f} />
                      <div className="mt-2 font-semibold">{f.name}</div>
                    </div>
                  ))}
                  <div className="flex min-h-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white text-sm text-gray-400">
                    Upload Frame
                  </div>
                </div>
              </div>
            )}
            {adminTab === 'stickers' && (
              <div>
                <h3 className="mb-4 text-xl font-bold text-gray-900">
                  Stickers
                </h3>
                <div className="mb-4 grid grid-cols-6 gap-2 sm:grid-cols-8">
                  {STICKER_EMOJIS.map((em, i) => (
                    <div
                      key={`${em}-${i}`}
                      className="flex h-12 items-center justify-center rounded-lg bg-white text-2xl shadow"
                    >
                      {em}
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white py-12 text-center text-gray-400">
                  Upload Sticker (placeholder)
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
