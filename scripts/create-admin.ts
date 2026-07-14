// Bootstrap or reset the first ADMIN login account (needed before basic-auth is
// retired, so nobody is locked out). The auth columns must already exist in the
// DB (added by a deploy running `prisma db push` / migrate).
//
// Usage:
//   DATABASE_URL=... npx tsx scripts/create-admin.ts <username> <password> [nama]
// Or inside the stack:
//   sg docker -c "docker compose run --rm app npx tsx scripts/create-admin.ts <username> <password>"
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";

async function main() {
  const [username, password, name] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Usage: DATABASE_URL=... npx tsx scripts/create-admin.ts <username> <password> [nama]");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Password minimal 10 karakter.");
    process.exit(1);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL wajib di-set.");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const passwordHash = await hashPassword(password);
    const email = `${username}@admin.local`;
    const user = await prisma.user.upsert({
      where: { username },
      update: { passwordHash, role: "ADMIN", isActive: true },
      create: { username, email, name: name || username, role: "ADMIN", isActive: true, passwordHash },
    });
    console.log(`OK: admin '${user.username}' (${user.id}) siap login.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
