# Backend Rules

## Files chính
- `server/index.ts` — toàn bộ Express backend
- `prisma/schema.prisma` — SQLite schema
- `.env` — Cloudinary credentials (không commit)
- `uploads/` — ảnh đã chụp/composed
- `photobooth.db` — SQLite database

## API
- Base URL: http://localhost:3001
- Dùng Express Router nếu thêm route mới
- Luôn có try/catch và trả về lỗi rõ ràng dạng `{ error: string }`

## Database
- ORM: Prisma với SQLite
- Sau khi sửa schema.prisma → chạy `npx prisma migrate dev`
- Không viết raw SQL nếu Prisma làm được

## Cloudinary
- Upload ảnh lên Cloudinary → trả về URL download
- Credentials trong `.env`, dùng qua `process.env`

## Print
- Canon Selphy CP1500
- Windows: Windows Print API