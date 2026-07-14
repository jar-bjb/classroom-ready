# Operational Change Log

Log operasional detail untuk perubahan, deploy, backup, verifikasi, dan rollback project **Classroom Ready / Pemeriksaan Kelas**.

Gunakan file ini untuk catatan yang lebih detail daripada `CHANGELOG.md`.

## Template Entry

```md
## YYYY-MM-DD HH:mm WITA — Judul perubahan

| Item | Detail |
|---|---|
| Operator | ... |
| Scope | ... |
| Alasan | ... |
| Backup | ... |
| Files changed | ... |
| Deploy command | ... |
| Verification | ... |
| Rollback | ... |
| Notes | ... |
```

---

## 2026-06-22 09:05 WITA — Refactor Progress Checklist ke Atas Form Mobile

| Item | Detail |
|---|---|
| Operator | Emes via Hermes Agent, atas instruksi Bos Rozaq |
| Scope | UX mobile petugas Classroom Ready; tidak mengubah database/schema |
| Alasan | Untuk mengikuti pola kerja petugas yang mengisi checklist dari atas ke bawah; progress lebih berguna di atas, sedangkan submit/finalisasi lebih natural di akhir form |
| Target runtime | Docker Compose resmi di `/opt/apps/classroom-ready` |
| Public path | `https://pengajaran.updlbanjarbaru.web.id/classroom-ready` |
| Local path | `http://127.0.0.1:3031/classroom-ready` |

### Backup Sebelum Perubahan

```text
/home/jar/.hermes/workspace/backups/classroom-ready-progress-top-refactor-20260622-090532
```

Isi backup:

- `source-files/inspection-submit-panel.tsx`
- `source-files/inspect-page.tsx`
- `source-files/CHANGELOG.md`
- `source-files/ops-log.md`
- `git/status-before.txt`
- `git/target-files-before.diff`
- `RESTORE.md`

### File yang Diubah

| File | Perubahan |
|---|---|
| `src/components/inspection-submit-panel.tsx` | Menambah `InspectionProgressPanel`, memisahkan progress atas dari submit final, shared progress hook/validation |
| `src/app/mobile/rooms/[roomId]/inspect/page.tsx` | Menaruh `InspectionProgressPanel` setelah info ruang dan sebelum checklist; submit tetap di akhir form |
| `CHANGELOG.md` | Menambah ringkasan refactor progress-top |
| `docs/ops-log.md` | Menambah log operasional refactor ini |

### Command Verifikasi Source

```bash
cd /home/jar/.openclaw/workspace/classroom-ready
npm run lint
npm run build
```

Hasil:

- `npm run lint` sukses.
- `npm run build` sukses.
- Warning Turbopack NFT trace lama masih muncul, tetapi tidak menggagalkan build.

### Deploy Command

```bash
cd /opt/apps/classroom-ready
sg docker -c 'docker compose up -d --build'
```

Hasil:

- Image `classroom-ready-app:docker` berhasil dibuild.
- Container `classroom-ready-app` direcreate dan kembali `healthy`.
- Container `classroom-ready-db` tetap berjalan dan `healthy`.

### Verifikasi Runtime

```bash
curl -fsS http://127.0.0.1:3031/classroom-ready/api/health
curl -fsS -H 'Host: pengajaran.updlbanjarbaru.web.id' \
  http://127.0.0.1:8080/classroom-ready/api/health
```

Hasil body health:

```json
{"status":"ok","checks":{"database":"ok","uploadDirectory":"ok"}}
```

### Verifikasi Browser Post-Fix

Script audit:

```text
/home/jar/.hermes/workspace/qa-reports/classroom-ready/mobile-progress-top-audit.js
```

Result JSON:

```text
/home/jar/.hermes/workspace/qa-reports/classroom-ready/mobile-progress-top-result.json
```

Screenshot evidence:

```text
/home/jar/.hermes/workspace/qa-reports/classroom-ready/screenshots-progress-top/
```

Hasil penting:

| Check | Hasil |
|---|---|
| Progress atas muncul | ✅ `Checklist 0/26` + helper top-to-bottom |
| Submit final di akhir form | ✅ ada `Finalisasi pemeriksaan` |
| Bottom nav di inspect | ✅ tidak muncul (`bottomNavVisible: 0`) |
| Progress setelah 1 jawaban | ✅ `Checklist 1/26` |
| Helper setelah 1 jawaban | ✅ `1 selesai, 25 item belum diisi.` |
| Tombol final saat belum lengkap | ✅ `Cek yang belum lengkap`, `data-ready=false` |
| Validasi setelah klik final | ✅ muncul pesan item pertama yang belum diisi |

### Rollback

Jika perlu restore source:

```bash
cd /home/jar/.openclaw/workspace/classroom-ready
cp /home/jar/.hermes/workspace/backups/classroom-ready-progress-top-refactor-20260622-090532/source-files/inspection-submit-panel.tsx src/components/inspection-submit-panel.tsx
cp /home/jar/.hermes/workspace/backups/classroom-ready-progress-top-refactor-20260622-090532/source-files/inspect-page.tsx 'src/app/mobile/rooms/[roomId]/inspect/page.tsx'
cp /home/jar/.hermes/workspace/backups/classroom-ready-progress-top-refactor-20260622-090532/source-files/CHANGELOG.md CHANGELOG.md
cp /home/jar/.hermes/workspace/backups/classroom-ready-progress-top-refactor-20260622-090532/source-files/ops-log.md docs/ops-log.md
npm run lint && npm run build
```

Jika perubahan sudah dideploy dan perlu redeploy hasil restore:

```bash
cd /opt/apps/classroom-ready
sg docker -c 'docker compose up -d --build'
curl -fsS http://127.0.0.1:3031/classroom-ready/api/health
```

### Catatan

- Tidak ada reset database.
- Tidak ada penghapusan volume/container rollback Podman.
- Tidak ada secret yang dicetak ke log ini.
- Perubahan fokus pada alur UX mobile petugas: progress di atas, submit final di bawah.

## 2026-06-22 08:36 WITA — Koreksi lokasi log perubahan Classroom Ready

| Item | Detail |
|---|---|
| Operator | admjar via OpenClaw, atas koreksi Boss Rozaq |
| Scope | SOP workspace dan pencatatan operasional lintas project, termasuk Classroom Ready |
| Alasan | Host menjalankan dua agen, sehingga perubahan perlu dicatat di file log resmi project masing-masing, bukan root workspace |
| Backup | Tidak dibuat; perubahan kecil pada instruksi dan file log yang baru dibuat keliru |
| Files changed | `AGENTS.md`, `classroom-ready/CHANGELOG.md`, `classroom-ready/docs/ops-log.md`; menghapus `CHANGELOG.md` dan `docs/ops-log.md` root workspace yang sempat dibuat keliru |
| Deploy command | Tidak ada deploy |
| Verification | `AGENTS.md` dicek memuat pola umum `<project>/CHANGELOG.md` dan `<project>/docs/ops-log.md`, plus path resmi Classroom Ready |
| Rollback | Kembalikan bagian aturan logging di `AGENTS.md`; jika perlu, pulihkan file root log dari riwayat patch |
| Notes | Tidak ada perubahan service, database, secret, atau runtime OpenClaw/Hermes |

## 2026-06-22 06:08 WITA — Perbaikan UX Mobile Petugas

| Item | Detail |
|---|---|
| Operator | Emes via Hermes Agent, atas instruksi Bos Rozaq |
| Scope | UI/UX mobile petugas Classroom Ready; tidak mengubah database/schema |
| Target runtime | Docker Compose resmi di `/opt/apps/classroom-ready` |
| Public path | `https://pengajaran.updlbanjarbaru.web.id/classroom-ready` |
| Local path | `http://127.0.0.1:3031/classroom-ready` |

### Latar Belakang

Audit mobile petugas menemukan beberapa masalah utama:

- Bottom navigation menutupi konten checklist dan area sticky submit.
- Tombol submit terlihat seperti disabled sehingga validasi tidak mudah dipicu oleh petugas.
- Progress checklist kurang informatif saat item belum lengkap.
- Copy di home mobile ambigu: `Perlu tindakan` tetapi tertulis `Terakhir dicek: Bagus`.
- Tombol Scan QR terlihat seperti sudah aktif penuh, padahal integrasi kamera/PWA masih disiapkan.

### Backup Sebelum Perubahan

Backup dibuat sebelum edit source:

```text
/home/jar/.hermes/workspace/backups/classroom-ready-mobile-fix-20260622-060824
```

Isi backup:

- `source-files/app-shell.tsx`
- `source-files/inspection-submit-panel.tsx`
- `source-files/mobile-page.tsx`
- `source-files/globals.css`
- `git/status-before.txt`
- `git/target-files-before.diff`
- `RESTORE.md`

### File yang Diubah

| File | Perubahan |
|---|---|
| `src/components/app-shell.tsx` | Safe-area bottom padding, subtitle header tidak truncate, bottom nav padding diperbaiki |
| `src/components/inspection-submit-panel.tsx` | Sticky panel dipindah ke `bottom-4`, tombol validasi bisa diklik saat belum ready, helper text progress ditambah |
| `src/app/mobile/page.tsx` | Copy Scan QR dan `Terakhir dicek oleh` diperjelas |
| `src/app/mobile/rooms/[roomId]/inspect/page.tsx` | Bottom nav di halaman inspect dihapus agar tidak overlap dengan form/submit |
| `src/app/globals.css` | Safe-area body padding ditambahkan |

### Command Verifikasi Source

```bash
cd /home/jar/.openclaw/workspace/classroom-ready
npm run lint
npm run build
```

Hasil:

- `npm run lint` sukses.
- `npm run build` sukses.
- Warning Turbopack NFT trace masih muncul, tetapi tidak menggagalkan build.

### Deploy Command

```bash
cd /opt/apps/classroom-ready
sg docker -c 'docker compose up -d --build'
```

Hasil:

- Image `classroom-ready-app:docker` berhasil dibuild.
- Container `classroom-ready-app` direcreate dan kembali `healthy`.
- Container `classroom-ready-db` tetap berjalan dan `healthy`.

### Verifikasi Runtime

```bash
curl -fsS http://127.0.0.1:3031/classroom-ready/api/health
curl -fsS -H 'Host: pengajaran.updlbanjarbaru.web.id' \
  http://127.0.0.1:8080/classroom-ready/api/health
```

Hasil body health:

```json
{"status":"ok","checks":{"database":"ok","uploadDirectory":"ok"}}
```

### Verifikasi Browser Post-Fix

Script audit:

```text
/home/jar/.hermes/workspace/qa-reports/classroom-ready/mobile-petugas-postfix-audit.js
```

Result JSON:

```text
/home/jar/.hermes/workspace/qa-reports/classroom-ready/mobile-petugas-postfix-result.json
```

Screenshot evidence:

```text
/home/jar/.hermes/workspace/qa-reports/classroom-ready/screenshots-postfix/
```

Hasil penting:

| Check | Hasil |
|---|---|
| Home mobile status | `200` |
| Copy Scan QR baru | ✅ muncul |
| Copy `Terakhir dicek oleh` | ✅ muncul |
| Inspect page terbuka | ✅ |
| Bottom nav di inspect | ✅ tidak muncul (`bottomNavVisible: 0`) |
| Submit validasi | ✅ bisa diklik saat belum ready (`submitDisabled: false`) |
| `data-ready` awal | `false` |
| Pesan pilih petugas | ✅ muncul setelah klik validasi |
| Progress setelah 1 jawaban | ✅ `Checklist 1/26` |
| Helper text setelah 1 jawaban | ✅ `1 selesai, 25 item belum diisi.` |

### Rollback

Jika perlu restore source:

```bash
cd /home/jar/.openclaw/workspace/classroom-ready
cp /home/jar/.hermes/workspace/backups/classroom-ready-mobile-fix-20260622-060824/source-files/app-shell.tsx src/components/app-shell.tsx
cp /home/jar/.hermes/workspace/backups/classroom-ready-mobile-fix-20260622-060824/source-files/inspection-submit-panel.tsx src/components/inspection-submit-panel.tsx
cp /home/jar/.hermes/workspace/backups/classroom-ready-mobile-fix-20260622-060824/source-files/mobile-page.tsx src/app/mobile/page.tsx
cp /home/jar/.hermes/workspace/backups/classroom-ready-mobile-fix-20260622-060824/source-files/globals.css src/app/globals.css
npm run lint && npm run build
```

Jika perubahan sudah dideploy dan perlu redeploy hasil restore:

```bash
cd /opt/apps/classroom-ready
sg docker -c 'docker compose up -d --build'
curl -fsS http://127.0.0.1:3031/classroom-ready/api/health
```

### Catatan

- Tidak ada reset database.
- Tidak ada penghapusan volume/container rollback Podman.
- Tidak ada secret yang dicetak ke log ini.
- Perubahan fokus pada UI/UX dan deploy aplikasi Docker yang sudah menjadi runtime resmi.
