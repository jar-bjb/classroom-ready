import "dotenv/config";
import { PrismaClient, ItemCategory, TemplateVersionStatus, UserRole } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for seed");
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const weeklySections = [
  {
    title: "Kondisi Ruang",
    description: "Kesiapan fisik ruang sebelum dipakai pembelajaran.",
    items: [
      ["room-clean", "Ruangan bersih dan siap digunakan", "CLEANLINESS", false, false],
      ["furniture-ready", "Meja/kursi tertata baik dan tidak menghambat akses", "FACILITY", false, false],
      ["no-odor", "Tidak ada bau mengganggu", "FACILITY", false, false],
      ["no-visible-damage", "Tidak ada kebocoran/kerusakan fisik terlihat", "SAFETY", true, true],
    ],
  },
  {
    title: "AC & Kenyamanan",
    description: "AC dan kenyamanan dasar ruang.",
    items: [
      ["ac-on", "AC menyala", "HVAC", true, true],
      ["ac-cold", "AC terasa dingin/stabil", "HVAC", true, true],
      ["ac-remote", "Remote AC tersedia dan berfungsi", "HVAC", false, false],
      ["ac-no-leak", "Tidak ada tetesan air dari AC", "HVAC", true, true],
      ["ac-no-noise", "Tidak ada suara/bau tidak normal dari AC", "HVAC", false, false],
    ],
  },
  {
    title: "Pencahayaan & Listrik",
    description: "Lampu dan kelistrikan yang berdampak ke kelas.",
    items: [
      ["main-light-on", "Lampu utama menyala", "LIGHTING", true, true],
      ["light-enough", "Cahaya cukup untuk pembelajaran", "LIGHTING", false, false],
      ["no-flicker", "Tidak ada lampu flicker/redup parah", "LIGHTING", false, false],
      ["main-outlet-safe", "Stop kontak utama aman", "ELECTRICAL", true, true],
      ["power-strip-ready", "Extension/power strip tersedia jika diperlukan", "ELECTRICAL", false, false],
    ],
  },
  {
    title: "AV/IT",
    description: "Perangkat presentasi, audio, dan koneksi dasar.",
    items: [
      ["display-on", "Display/proyektor/TV menyala", "AV", true, true],
      ["pc-to-screen", "PC/laptop bisa tampil ke layar", "AV", true, true],
      ["hdmi-ready", "Kabel HDMI tersedia dan dapat digunakan", "AV", true, true],
      ["adapter-ready", "Adapter presentasi tersedia", "AV", false, false],
      ["speaker-ok", "Speaker/audio berfungsi", "AV", false, false],
      ["wifi-ok", "Internet/WiFi tersedia jika dibutuhkan", "IT", false, false],
    ],
  },
  {
    title: "Perlengkapan Pembelajaran",
    description: "Consumable dan alat bantu mengajar.",
    items: [
      ["mic-ready", "Mic tersedia", "CONSUMABLE", true, true],
      ["mic-working", "Mic berfungsi saat dites", "AV", true, true],
      ["mic-battery", "Baterai mic aman/tersedia cadangan", "CONSUMABLE", true, false],
      ["pointer-ready", "Pointer/clicker tersedia jika diperlukan", "CONSUMABLE", false, false],
      ["marker-ready", "Spidol/penghapus tersedia jika pakai whiteboard", "CONSUMABLE", false, false],
      ["remotes-returned", "Remote display/AC tersimpan di tempatnya", "CONSUMABLE", false, false],
    ],
  },
] as const;

async function main() {
  await prisma.attachment.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.inspectionResponse.deleteMany();
  await prisma.inspectionSession.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.checklistSection.deleteMany();
  await prisma.checklistTemplateVersion.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.room.deleteMany();
  await prisma.roomType.deleteMany();
  await prisma.user.deleteMany();

  const inspector = await prisma.user.create({
    data: { name: "Petugas Demo", email: "petugas@example.local", role: UserRole.INSPECTOR },
  });
  await prisma.user.create({
    data: { name: "Koordinator Demo", email: "koordinator@example.local", role: UserRole.COORDINATOR },
  });

  const regular = await prisma.roomType.create({ data: { slug: "kelas-reguler", name: "Kelas Reguler" } });
  const lab = await prisma.roomType.create({ data: { slug: "lab-komputer", name: "Lab Komputer" } });
  const aula = await prisma.roomType.create({ data: { slug: "aula", name: "Aula" } });

  await prisma.room.createMany({
    data: [
      { code: "R.201", name: "Ruang 201", floor: "2", location: "Gedung Utama", capacity: 30, typeId: regular.id },
      { code: "R.202", name: "Ruang 202", floor: "2", location: "Gedung Utama", capacity: 30, typeId: regular.id },
      { code: "R.305", name: "Ruang 305", floor: "3", location: "Gedung Utama", capacity: 35, typeId: regular.id },
      { code: "LAB.1", name: "Lab Komputer 1", floor: "1", location: "Gedung IT", capacity: 25, typeId: lab.id },
      { code: "AULA", name: "Aula Pembelajaran", floor: "1", location: "Gedung Utama", capacity: 120, typeId: aula.id },
    ],
  });

  const template = await prisma.checklistTemplate.create({
    data: {
      key: "weekly-room-certification",
      name: "Pemeriksaan Kelas",
      description: "Pemeriksaan mingguan untuk memastikan kesiapan ruang pembelajaran.",
      cadence: "WEEKLY",
    },
  });

  const version = await prisma.checklistTemplateVersion.create({
    data: { templateId: template.id, version: 1, status: TemplateVersionStatus.PUBLISHED },
  });

  for (const [sectionIndex, section] of weeklySections.entries()) {
    const createdSection = await prisma.checklistSection.create({
      data: {
        versionId: version.id,
        title: section.title,
        description: section.description,
        sortOrder: sectionIndex + 1,
      },
    });

    await prisma.checklistItem.createMany({
      data: section.items.map(([code, prompt, category, isCritical, requiresPhotoOnFail], itemIndex) => ({
        sectionId: createdSection.id,
        code,
        prompt,
        category: category as ItemCategory,
        isCritical,
        requiresPhotoOnFail,
        sortOrder: itemIndex + 1,
      })),
    });
  }

  console.log(`Seeded classroom-ready MVP with inspector ${inspector.email}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
