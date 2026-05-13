# Frontend Rules

## Files chính
- `client/src/App.tsx` — toàn bộ app (file lớn, cẩn thận khi sửa)
- `client/src/index.css` — global styles
- `client/vite.config.ts` — Vite config

## UI
- Dùng TailwindCSS v4, không viết CSS inline trừ khi bắt buộc
- Icon dùng lucide-react
- Không cài thêm UI library (shadcn, MUI...) nếu chưa hỏi

## Camera / Canvas
- Camera qua WebRTC `getUserMedia()`
- Xử lý ảnh bằng HTML Canvas API phía client
- QR Code dùng `qrcode.react`

## Lưu ý App.tsx
- File này lớn, khi sửa hãy chỉ đọc và sửa đúng phần được yêu cầu
- Không restructure toàn bộ file trừ khi được yêu cầu rõ ràng