import { prisma } from "@/lib/prisma";
import { categoryLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const templates = await prisma.checklistTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        include: {
          sections: { orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 lg:py-10">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Admin</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em]">Template Checklist</h1>
        <p className="mt-2 text-muted">Template dibuat berversi agar nanti Daily Check, Post-Class Reset, atau checklist khusus lab bisa ditambah tanpa bongkar struktur.</p>
      </div>

      <div className="mt-5 space-y-5">
        {templates.map((template) => (
          <article key={template.id} className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted">{template.cadence}</p>
                <h2 className="text-2xl font-black tracking-[-0.04em]">{template.name}</h2>
                <p className="mt-1 text-sm text-muted">{template.description}</p>
              </div>
              <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold">{template.versions.length} versi</span>
            </div>
            {template.versions.map((version) => (
              <div key={version.id} className="mt-5 rounded-2xl border border-border bg-background p-4">
                <h3 className="font-black">Versi {version.version} • {version.status}</h3>
                <div className="mt-4 space-y-4">
                  {version.sections.map((section) => (
                    <section key={section.id}>
                      <h4 className="font-bold">{section.title}</h4>
                      <ul className="mt-2 space-y-2 text-sm text-muted">
                        {section.items.map((item) => (
                          <li key={item.id} className="rounded-xl border border-border bg-card px-3 py-2">
                            <span className="font-semibold text-foreground">{item.prompt}</span>
                            <span className="ml-2">• {categoryLabel(item.category)} {item.isCritical ? "• kritikal" : ""}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </div>
            ))}
          </article>
        ))}
      </div>
    </main>
  );
}
