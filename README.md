# Classroom Ready / Pemeriksaan Kelas

Aplikasi web mobile-first untuk pemeriksaan kesiapan kelas, pembuatan issue tindak lanjut, dashboard status ruang, dan arsip log pemeriksaan. Project ini disiapkan sebagai fondasi self-hosted untuk alur operasional petugas kelas: inspeksi via HP/QR, supervisor menindaklanjuti temuan, admin mengelola kelas/petugas/template, dan manajemen melihat status kesiapan ruang.

## Ringkasan fungsi

- **Mobile petugas pemeriksa**: daftar kelas, detail kelas, form pemeriksaan, pilihan petugas aktif, upload foto bukti, dan submit checklist.
- **QR per kelas**: admin bisa membuka QR yang mengarah langsung ke form inspeksi kelas tertentu.
- **Dashboard readiness**: ringkasan kelas siap digunakan, perlu tindakan, belum diperiksa, dan issue aktif.
- **Issue management**: temuan otomatis dibuat dari jawaban `NOT_OK` atau item kritikal `NA`.
- **Supervisor / petugas tindak lanjut**: melihat issue aktif, tandai `IN_PROGRESS`, tutup issue dengan catatan penyelesaian.
- **Sinkron status ruang**: ketika semua issue aktif suatu kelas selesai, status kelas kembali menjadi `Siap digunakan`.
- **Admin ruang**: tambah/nonaktifkan kelas, kelola komponen/checklist per kelas, dan kelola petugas pemeriksa/tindak lanjut.
- **Template checklist**: checklist disimpan di database dan berversi.
- **Log/export**: riwayat issue lifecycle bisa difilter, dicetak, dan diekspor sebagai Excel-compatible `.xls`.
- **Upload lokal**: foto bukti disimpan di volume/host lokal, bukan database.
- **Security baseline**: security headers, pembatasan tipe/ukuran upload, dan proteksi path traversal untuk file upload.

## Stack teknis

- **Frontend/backend**: Next.js 16 App Router + React 19 + TypeScript.
- **Database**: PostgreSQL 16.
- **ORM**: Prisma 7 dengan generated client di `src/generated/prisma`.
- **Styling**: Tailwind CSS 4.
- **Validation/utilities**: Zod, qrcode, native Server Actions.
- **Container**: Dockerfile multi-stage Node 22 Alpine + Docker Compose.
- **Upload storage**: filesystem lokal melalui `UPLOAD_DIR` atau Docker volume `classroom_ready_uploads`.

## Struktur folder penting

- `src/app/mobile` — halaman mobile petugas pemeriksa.
- `src/app/mobile/rooms/[roomId]/inspect` — form inspeksi kelas.
- `src/app/supervisor/issues` — antrean issue untuk petugas tindak lanjut.
- `src/app/dashboard` — dashboard readiness/status kelas.
- `src/app/admin/rooms` — manajemen kelas, petugas, QR, dan komponen kelas.
- `src/app/admin/templates` — tampilan template checklist aktif.
- `src/app/admin/logs` — log issue, filter, print, dan export.
- `src/app/api/rooms/[roomId]/qr` — endpoint PNG QR kelas.
- `src/app/api/uploads/[...filePath]` — endpoint baca foto upload secara aman.
- `src/app/api/admin/logs/export/excel` — export Excel-compatible HTML `.xls`.
- `src/app/api/integration/dashboard-summary` — endpoint JSON ringkasan live untuk integrasi Dashboard JAR.
- `src/app/actions.ts` — Server Actions utama: submit inspeksi, CRUD kelas/petugas, update issue, override checklist.
- `src/lib/status.ts` — label status, prioritas, mapping kategori ke role tindak lanjut.
- `src/lib/checklist.ts` — resolusi item checklist efektif per kelas.
- `src/lib/upload-policy.ts` — batas tipe dan ukuran upload.
- `src/lib/admin-log-export.ts` — query dan formatting data export log.
- `src/proxy.ts` — security headers global.
- `prisma/schema.prisma` — schema database.
- `prisma/seed.ts` — seed data demo: petugas, supervisor, kelas, dan template pemeriksaan.
- `scripts/test-security.mjs` — smoke test security headers dan upload probes.
- `scripts/test-reliability.mjs` — smoke/load sederhana untuk route utama.

## Environment variables

Buat `.env` dari `.env.example`. Jangan commit `.env` ke Git.

```bash
cp .env.example .env
```

Variabel yang dipakai:

- `DATABASE_URL`
  - Connection string PostgreSQL.
  - Local host default mengikuti port compose `55438`.
  - Production container sebaiknya memakai hostname service Docker, contoh `db:5432`.
- `NEXT_PUBLIC_APP_URL`
  - Base URL publik aplikasi.
  - Dipakai untuk generate QR agar scan mengarah ke domain production yang benar.
  - Contoh production: `https://pemeriksaankelas.example.id`.
- `UPLOAD_DIR`
  - Folder penyimpanan foto upload.
  - Local default: `./uploads`.
  - Docker default: `/app/uploads`.
- `PORT`
  - Port app di container. Default compose: `3000`.
- `HOSTNAME`
  - Host bind Next.js di container. Compose memakai `0.0.0.0`.
- `APP_BASE_URL`
  - Opsional untuk scripts test (`test:security`, `test:reliability`). Default `http://127.0.0.1:3010`; di VPS admjar gunakan `http://127.0.0.1:3020`.
- `LOAD_TOTAL`, `LOAD_CONCURRENCY`
  - Opsional untuk `test:reliability`.
- `CLASSROOM_APP_BIND`
  - Bind port host untuk app container. Default sistem admjar: `127.0.0.1:3020`.
- `CLASSROOM_DB_BIND`
  - Bind port host untuk PostgreSQL jika perlu akses dari host. Default sistem admjar: `127.0.0.1:55438`.
- `BASIC_AUTH_USER` dan `BASIC_AUTH_PASSWORD`
  - Proteksi Basic Auth untuk route UI/admin/supervisor/mobile.
  - Endpoint integrasi read-only `/api/integration/dashboard-summary` tetap terbuka untuk Dashboard JAR.

Contoh `.env` development:

```env
POSTGRES_USER=classroom_ready
POSTGRES_PASSWORD=classroom_ready_dev_change_me
POSTGRES_DB=classroom_ready
DATABASE_URL="postgresql://classroom_ready:classroom_ready_dev_change_me@db:5432/classroom_ready?schema=public"
NEXT_PUBLIC_APP_URL="http://127.0.0.1:3020"
UPLOAD_DIR="/app/uploads"
CLASSROOM_APP_BIND=127.0.0.1:3020
CLASSROOM_DB_BIND=127.0.0.1:55438
```

Contoh nilai production harus dibuat langsung di VPS dan jangan disimpan di repo/source zip:

```env
POSTGRES_PASSWORD="[REDACTED]"
DATABASE_URL="postgresql://classroom_ready:[REDACTED]@db:5432/classroom_ready?schema=public"
NEXT_PUBLIC_APP_URL="https://domain-production"
UPLOAD_DIR="/app/uploads"
BASIC_AUTH_USER="[REDACTED]"
BASIC_AUTH_PASSWORD="[REDACTED]"
```

## Setup local development

Prerequisite:

- Node.js 22 atau versi kompatibel dengan Next.js 16.
- Docker + Docker Compose.
- npm.

Langkah awal:

```bash
cd classroom-ready
cp .env.example .env
npm install
docker compose up -d db
npm run db:generate
npm run db:push
npm run db:seed
npm run dev:host
```

Buka route berikut:

- Home: `http://localhost:3000`
- Mobile petugas: `http://localhost:3000/mobile`
- Dashboard: `http://localhost:3000/dashboard`
- Admin ruang: `http://localhost:3000/admin/rooms`
- Admin template: `http://localhost:3000/admin/templates`
- Petugas tindak lanjut: `http://localhost:3000/supervisor/issues`
- Log admin: `http://localhost:3000/admin/logs`
- Integrasi Dashboard JAR: `http://localhost:3000/api/integration/dashboard-summary`

## Integrasi dengan Dashboard JAR

Endpoint `GET /api/integration/dashboard-summary` disediakan untuk dashboard static seperti `dashboard-jar`.

Data yang dikirim:

- KPI kelas: total, siap digunakan, perlu tindakan, belum diperiksa.
- KPI issue: issue aktif dan issue prioritas `P1/P2`.
- Daftar kelas dengan status efektif, jumlah issue aktif, inspeksi terakhir, dan deep link ke report/form inspeksi.
- Issue aktif untuk antrean supervisor.
- Pemeriksaan terbaru untuk konteks audit.

Endpoint ini mengirim header CORS `Access-Control-Allow-Origin: *` karena dashboard-jar bisa dipublish sebagai static site/domain berbeda. Data yang diekspos hanya ringkasan operasional, bukan foto upload atau isi detail bukti.

Reset database demo:

```bash
npm run db:reset
```

## Alur operasional aplikasi

1. **Admin menyiapkan data**
   - Tambah kelas dari `/admin/rooms`.
   - Tambah petugas pemeriksa dan petugas tindak lanjut dari halaman admin.
   - Review template checklist dari `/admin/templates`.
   - Jika kelas tertentu butuh komponen khusus, buka detail/edit kelas lalu override checklist.

2. **Petugas melakukan pemeriksaan**
   - Buka `/mobile` atau scan QR kelas.
   - Pilih kelas dan petugas pemeriksa.
   - Isi checklist `OK`, `Tidak OK`, atau `N/A`.
   - Tambahkan catatan dan foto jika perlu.
   - Submit inspeksi.

3. **Sistem menghitung hasil**
   - Semua OK: kelas menjadi `Siap digunakan`.
   - Ada item non-kritikal gagal: kelas menjadi `Perlu tindakan`.
   - Item kritikal gagal atau N/A: kelas menjadi `Perlu tindakan`.
   - Sertifikasi berlaku 7 hari dari submit.

4. **Issue otomatis dibuat**
   - Jawaban `NOT_OK` membuat issue.
   - Item kritikal dengan `NA` juga membuat issue.
   - Issue diberi prioritas `P2` untuk kritikal dan `P3` untuk non-kritikal.
   - Role tindak lanjut dipetakan dari kategori item: AV/IT ke `IT_AV`, consumable ke `INSPECTOR`, lainnya ke `FACILITY`.

5. **Supervisor menindaklanjuti**
   - Buka `/supervisor/issues`.
   - Pilih petugas tindak lanjut satu kali per issue card.
   - Bisa tandai `Diproses` atau tutup `Selesai` dengan catatan.
   - Lifecycle tersimpan di `IssueLog`.

6. **Status kelas disinkronkan**
   - Jika issue aktif terakhir di kelas ditutup, status kelas otomatis kembali `Siap digunakan`.

7. **Admin melihat arsip/export**
   - Buka `/admin/logs`.
   - Filter berdasarkan kelas, status, dan rentang tanggal.
   - Print via `/admin/logs/print` atau export Excel-compatible `.xls`.

## Data model ringkas

- `User`
  - Menyimpan petugas/admin/supervisor/resolver dengan role dan status aktif.
- `RoomType`
  - Jenis ruang. Saat ini fokus ke `kelas`.
- `Room`
  - Data kelas: kode, nama, lantai, lokasi, kapasitas, status readiness, expiry sertifikasi.
- `ChecklistTemplate`
  - Template induk checklist.
- `ChecklistTemplateVersion`
  - Versi template. Hanya versi published yang dipakai operasional.
- `ChecklistSection`
  - Kelompok pertanyaan checklist.
- `ChecklistItem`
  - Item pertanyaan, kategori, critical flag, kebutuhan foto, sort order.
- `RoomChecklistItemOverride`
  - Override/penyesuaian item checklist khusus per kelas.
- `InspectionSession`
  - Satu sesi pemeriksaan kelas oleh petugas.
- `InspectionResponse`
  - Jawaban per item checklist.
- `Attachment`
  - Metadata foto upload dan public path-nya.
- `Issue`
  - Temuan yang perlu tindakan.
- `IssueLog`
  - Riwayat lifecycle issue.
- `Notification`
  - Notifikasi internal ke supervisor saat issue baru dibuat.

## Docker local/preview

Jalankan full stack app + database:

```bash
docker compose up -d --build
```

Compose default:

- App container: `classroom-ready-app`.
- DB container: `classroom-ready-db`.
- PostgreSQL host port local-only: `127.0.0.1:55438`.
- App host port local-only: `127.0.0.1:3020`.
- Upload volume: `classroom_ready_uploads`.
- DB volume: `classroom_ready_pg`.

Buka:

```text
http://127.0.0.1:3020
```

Cek log:

```bash
docker compose logs -f app
docker compose logs -f db
```

Stop stack:

```bash
docker compose down
```

Stop dan hapus volume data lokal:

```bash
docker compose down -v
```

## Deployment VPS production

Rekomendasi stack:

- Docker Compose untuk app + PostgreSQL.
- Caddy reverse proxy di host atau container global.
- Database tetap private di Docker network; jangan expose PostgreSQL publik.
- Port app sebaiknya hanya bind ke localhost, seperti compose saat ini `127.0.0.1:3020:3000`.
- Upload foto disimpan di Docker volume atau bind mount host yang dibackup rutin.
- Untuk sistem admjar, jangan pakai port `3010` karena sudah dipakai aplikasi lain.
- Jangan expose route UI/admin/supervisor/mobile tanpa `BASIC_AUTH_USER` dan `BASIC_AUTH_PASSWORD`, kecuali sudah diganti auth/RBAC proper.

Langkah deployment dasar:

```bash
# di VPS
mkdir -p /opt/classroom-ready
cd /opt/classroom-ready
# upload/copy source project ke folder ini
cp .env.example .env
# edit .env: isi DATABASE_URL production dan NEXT_PUBLIC_APP_URL domain publik

docker compose up -d --build
```

Jika memakai Caddy host/service, contoh reverse proxy:

```caddyfile
pemeriksaankelas.example.id {
  reverse_proxy 127.0.0.1:3010
}
```

Jika memakai Caddy container global, pastikan container Caddy bisa reach app. Opsi termudah: tetap expose app ke `127.0.0.1:3010` dan reverse proxy dari host Caddy. Jika Caddy juga container-only, sambungkan network Compose sesuai arsitektur VPS.

Set `NEXT_PUBLIC_APP_URL` ke domain HTTPS production sebelum generate QR:

```env
NEXT_PUBLIC_APP_URL="https://pemeriksaankelas.example.id"
```

Setelah deploy:

```bash
docker compose ps
docker compose logs --tail=100 app
curl -I http://127.0.0.1:3020/mobile
```

## Database migration dan seed

Project saat ini memakai `prisma db push` di Dockerfile CMD agar schema tersinkron saat container start:

```dockerfile
CMD ["sh", "-c", "./node_modules/.bin/prisma db push && node server.js"]
```

Untuk production awal:

```bash
docker compose exec app ./node_modules/.bin/prisma db push
```

Seed demo hanya untuk development atau initial demo, jangan jalankan di production berisi data real karena seed menghapus data existing sebelum mengisi demo:

```bash
npm run db:seed
```

atau di container bila memang sengaja reset demo:

```bash
docker compose exec app npm run db:seed
```

Peringatan: `prisma/seed.ts` menjalankan banyak `deleteMany()`. Jangan dipakai di database production berisi data operasional.

## Backup dan restore

Backup PostgreSQL dari Docker Compose:

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U classroom_ready classroom_ready | gzip > backups/classroom_ready_$(date +%F_%H%M%S).sql.gz
```

Restore ke database kosong:

```bash
gunzip -c backups/classroom_ready_YYYY-MM-DD_HHMMSS.sql.gz | docker compose exec -T db psql -U classroom_ready classroom_ready
```

Backup upload foto:

```bash
docker run --rm -v classroom_ready_uploads:/data -v "$PWD/backups:/backup" alpine tar -czf /backup/classroom_ready_uploads_$(date +%F_%H%M%S).tar.gz -C /data .
```

Untuk bind mount host, backup langsung folder host upload yang dipakai `UPLOAD_DIR`.

## Export dan pelaporan

Halaman log:

```text
/admin/logs
```

Filter didukung:

- `roomId`
- `status`: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`
- `from`: tanggal mulai
- `to`: tanggal akhir

Print page:

```text
/admin/logs/print?roomId=...&status=...&from=YYYY-MM-DD&to=YYYY-MM-DD
```

Excel-compatible export:

```text
/api/admin/logs/export/excel?roomId=...&status=...&from=YYYY-MM-DD&to=YYYY-MM-DD
```

Export berisi ringkasan issue: tanggal, kelas, judul, kategori, prioritas, status, petugas pemeriksa, hasil pemeriksaan, item checklist, catatan temuan, assigned role, waktu close, ditutup oleh, catatan close, dan lifecycle log.

## Upload foto dan keamanan file

Kebijakan upload:

- Maksimum ukuran file: 3 MB.
- Tipe yang diterima: JPG/JPEG, PNG, WebP.
- Nama file dibuat aman dengan slug + UUID.
- File disimpan per tanggal: `YYYY/MM/DD/nama-file.ext`.
- Public path lewat endpoint `/api/uploads/...`.
- Endpoint upload reader menolak path traversal dan ekstensi non-image.

Security headers dipasang lewat `src/proxy.ts`:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Content-Security-Policy`

## Testing dan verifikasi

Build production:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Security smoke test terhadap app yang sedang berjalan:

```bash
APP_BASE_URL=http://127.0.0.1:3020 npm run test:security
```

Reliability smoke/load sederhana:

```bash
APP_BASE_URL=http://127.0.0.1:3020 LOAD_TOTAL=120 LOAD_CONCURRENCY=12 npm run test:reliability
```

Catatan: scripts test butuh app aktif dan database sudah siap.

## Git/arsip source

File yang sengaja tidak boleh ikut commit/arsip:

- `.env` dan semua `.env*` runtime secret.
- `node_modules/`.
- `.next/`.
- `uploads/`.
- `backups/`.
- `.git/`.
- log/debug file.
- credential atau private key seperti `*.pem`.

`.gitignore` saat ini sudah mengecualikan folder dan file tersebut. Saat membuat zip handoff, tetap exclude ulang dari proses arsip agar aman.

## Troubleshooting

**App tidak bisa connect database**

- Pastikan `DATABASE_URL` sesuai konteks.
- Local host memakai `localhost:5438`.
- Container app memakai `db:5432`.
- Cek `docker compose ps` dan `docker compose logs db`.

**QR mengarah ke localhost di HP**

- Set `NEXT_PUBLIC_APP_URL` ke domain/IP yang bisa dibuka dari HP.
- Rebuild/restart app setelah mengganti env.

**Upload foto gagal**

- Pastikan format JPG/PNG/WebP.
- Pastikan ukuran maksimal 3 MB.
- Pastikan `UPLOAD_DIR` writable oleh proses app/container.
- Cek volume `classroom_ready_uploads` atau bind mount host.

**Route `/api/uploads/...` 404**

- File memang belum ada, upload volume tidak termount, atau `UPLOAD_DIR` berubah setelah file dibuat.
- Pastikan app membaca folder upload yang sama dengan lokasi file.

**Issue sudah selesai tapi kelas masih perlu tindakan**

- Sistem hanya auto-set `CERTIFIED` ketika semua issue aktif (`OPEN`, `IN_PROGRESS`) untuk kelas tersebut sudah selesai.
- Cek `/admin/logs` atau detail kelas untuk issue lain yang masih aktif.

**Security test gagal missing header**

- Pastikan route melewati `src/proxy.ts`.
- Pastikan matcher tidak mengecualikan route yang dites.
- Restart/rebuild app setelah perubahan proxy.

**Build gagal karena Prisma client**

- Jalankan `npm run db:generate`.
- Pastikan `src/generated/prisma` terbuat.
- Pastikan `DATABASE_URL` tersedia saat build karena server route bisa diimport saat build.

## Catatan pengembangan lanjutan

Prioritas berikutnya yang masuk akal:

1. Tambah auth/RBAC beneran untuk admin, inspector, supervisor.
2. Pisahkan environment production dari dev compose password.
3. Tambah migration workflow formal dengan Prisma Migrate ketika schema sudah stabil.
4. Tambah dashboard analytics tren issue per kategori/kelas/periode.
5. Tambah notifikasi eksternal: Telegram/WhatsApp/email untuk issue baru dan overdue.
6. Tambah SLA/aging issue dan eskalasi otomatis.
7. Tambah export PDF native jika print browser belum cukup.
8. Tambah API mobile native jika nanti dibuat aplikasi Android/iOS.
9. Tambah object storage/S3-compatible untuk foto jika volume lokal tidak cukup.
10. Tambah scheduled backup dan off-site backup untuk database + upload.

## Handoff cepat

Untuk developer baru:

```bash
npm install
cp .env.example .env
docker compose up -d db
npm run db:generate
npm run db:push
npm run db:seed
npm run dev:host
```

Untuk production preview di VPS:

```bash
docker compose up -d --build
curl -I http://127.0.0.1:3020/mobile
```

Route paling penting untuk QA:

- `/mobile`
- `/mobile/rooms/[roomId]/inspect`
- `/dashboard`
- `/admin/rooms`
- `/admin/templates`
- `/supervisor/issues`
- `/admin/logs`
- `/api/rooms/[roomId]/qr`
- `/api/admin/logs/export/excel`
