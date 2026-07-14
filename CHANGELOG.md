# Changelog

Catatan perubahan penting project **Classroom Ready / Pemeriksaan Kelas**.

Format mengikuti prinsip ringkas: tanggal, kategori perubahan, verifikasi, dan backup/rollback jika ada.

## 2026-06-22

### Changed
- Refactor UX mobile petugas: progress checklist dipindah menjadi panel sticky di atas alur form agar mengikuti pola isi dari atas ke bawah.
- Submit/finalisasi pemeriksaan dibuat static di akhir form, bukan floating/sticky bawah.
- Menambah komponen `InspectionProgressPanel` untuk progress atas dan mempertahankan `InspectionSubmitPanel` sebagai final action di akhir.
- Validasi tetap bisa dipicu dari tombol final: klik `Cek yang belum lengkap` akan scroll ke item/petugas pertama yang belum lengkap.

### Verified
- `npm run lint` ✅
- `npm run build` ✅
- `docker compose up -d --build` ✅
- Docker app `classroom-ready-app` healthy ✅
- Local health endpoint `/classroom-ready/api/health` ✅
- Caddy local route health dengan Host `pengajaran.updlbanjarbaru.web.id` ✅
- Browser mobile audit progress-top via Playwright ✅

### Evidence
- Audit result: `/home/jar/.hermes/workspace/qa-reports/classroom-ready/mobile-progress-top-result.json`
- Screenshot folder: `/home/jar/.hermes/workspace/qa-reports/classroom-ready/screenshots-progress-top/`

### Backup / Rollback
- Backup source sebelum refactor: `/home/jar/.hermes/workspace/backups/classroom-ready-progress-top-refactor-20260622-090532`
- Restore guide: `/home/jar/.hermes/workspace/backups/classroom-ready-progress-top-refactor-20260622-090532/RESTORE.md`

### Known Notes
- Build masih menampilkan warning Turbopack NFT trace lama dari `next.config.ts` → `src/app/api/uploads/[...filePath]/route.ts`, tetapi build/deploy sukses.

### Changed
- Menggeneralisasi SOP pencatatan perubahan agar berlaku untuk semua aplikasi/project: gunakan `<project>/CHANGELOG.md` dan `<project>/docs/ops-log.md` di root project masing-masing.
- Memperbaiki SOP workspace agar pencatatan perubahan Classroom Ready diarahkan ke `classroom-ready/CHANGELOG.md` dan `classroom-ready/docs/ops-log.md`, bukan file log root workspace.
- Menghapus file log root workspace yang sempat dibuat keliru agar tidak ada sumber catatan ganda.

### Verified
- `AGENTS.md` memuat pola umum log per project serta path resmi khusus Classroom Ready.
- `AGENTS.md` memuat path log Classroom Ready yang benar.
- File log resmi Classroom Ready tetap berada di `classroom-ready/CHANGELOG.md` dan `classroom-ready/docs/ops-log.md`.

### Backup / Rollback
- Rollback: kembalikan bagian aturan logging di `AGENTS.md` ke versi sebelumnya jika diperlukan.

### Changed
- Memperbaiki UX **mobile petugas pemeriksa** pada halaman `/mobile` dan `/mobile/rooms/[roomId]/inspect`.
- Halaman inspect mobile tidak lagi menampilkan bottom nav supaya checklist dan sticky submit tidak tertutup.
- Menambah safe-area/bottom padding pada layout mobile.
- Memperbaiki sticky submit panel: tombol bisa diklik untuk memunculkan validasi meski checklist belum lengkap.
- Menambah helper text progress checklist, contoh: `Pilih nama petugas dulu...` dan `1 selesai, 25 item belum diisi.`
- Memperjelas copy di home mobile:
  - `Terakhir dicek` → `Terakhir dicek oleh`
  - Info Scan QR diperjelas bahwa kamera/PWA masih tahap integrasi.
- Header mobile tidak lagi memotong subtitle secara paksa.

### Verified
- `npm run lint` ✅
- `npm run build` ✅
- `docker compose up -d --build` ✅
- Local health endpoint `/classroom-ready/api/health` ✅
- Caddy local route health dengan Host `pengajaran.updlbanjarbaru.web.id` ✅
- Browser mobile post-fix audit via Playwright ✅

### Evidence
- Audit result: `/home/jar/.hermes/workspace/qa-reports/classroom-ready/mobile-petugas-postfix-result.json`
- Screenshot folder: `/home/jar/.hermes/workspace/qa-reports/classroom-ready/screenshots-postfix/`

### Backup / Rollback
- Backup source sebelum perubahan: `/home/jar/.hermes/workspace/backups/classroom-ready-mobile-fix-20260622-060824`
- Restore guide: `/home/jar/.hermes/workspace/backups/classroom-ready-mobile-fix-20260622-060824/RESTORE.md`

### Known Notes
- Build masih menampilkan warning Turbopack NFT trace lama dari `next.config.ts` → `src/app/api/uploads/[...filePath]/route.ts`, tetapi build/deploy sukses.
