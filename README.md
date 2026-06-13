# Classroom Ready

Mobile-first web app untuk Weekly Room Certification dan fondasi pengembangan Daily Check, Post-Class Reset, Issue Management, Asset Register, dan notifikasi.

## Prinsip desain

- Template-based checklist: pertanyaan checklist disimpan di database dan berversi.
- API/backend-first: mobile app native nanti bisa memakai data model dan API yang sama.
- Mobile-first untuk petugas pemeriksa.
- Postgres sebagai source of truth.
- Upload foto disimpan lokal dulu melalui volume `uploads`.

## Local development

```bash
cp .env.example .env
docker compose up -d db
npm run db:generate
npm run db:push
npm run db:seed
npm run dev:host
```

Buka:
- Mobile petugas: http://localhost:3000/mobile
- Dashboard: http://localhost:3000/dashboard
- Admin ruang: http://localhost:3000/admin/rooms
- Template: http://localhost:3000/admin/templates

## Docker app preview

```bash
docker compose up -d --build
```

App akan listen lokal di `127.0.0.1:3010`, siap dipasang di Caddy reverse proxy.
