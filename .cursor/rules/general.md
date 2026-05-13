# General Rules

## Project
Personal PhotoBooth app. Monorepo với client (React) và server (Express).

## Stack
- Frontend: React 18 + Vite + TypeScript + TailwindCSS v4 + lucide-react
- Backend: Express.js + TypeScript (chạy bằng tsx)
- Database: SQLite via Prisma
- Image: HTML Canvas API + Cloudinary
- Camera: WebRTC getUserMedia + Camo Studio
- QR Code: qrcode.react
- Print: Canon Selphy CP1500 (CUPS/Windows Print API)

## Ports
- Client: http://localhost:3000
- Server: http://localhost:3001

## Coding style
- Dùng TypeScript strict, không dùng `any`
- Dùng async/await, không dùng .then()
- Tên biến/hàm tiếng Anh, comment tiếng Việt nếu cần giải thích
- Không tạo file mới nếu có thể sửa file hiện có

## Quan trọng
- Không tự ý refactor code ngoài phạm vi yêu cầu
- Không thêm dependency mới nếu chưa hỏi
- Giải thích ngắn gọn những gì đã thay đổi sau khi xong