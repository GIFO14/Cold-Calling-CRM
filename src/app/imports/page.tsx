import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { CsvImporter } from "@/components/imports/CsvImporter";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export default async function ImportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const imports = await prisma.importBatch.findMany({
    where: user.role === "ADMIN" ? undefined : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { createdBy: { select: { name: true } } }
  });

  return (
    <AppShell user={user}>
      <div className="page-header">
        <div>
          <h1>Importar leads</h1>
          <p>Mapeig lliure de columnes CSV a camps CRM, custom fields o columnes ignorades.</p>
        </div>
      </div>
      <CsvImporter />
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Historial d'importacions</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fitxer</th>
                <th>Files</th>
                <th>Creats</th>
                <th>Actualitzats</th>
                <th>Omesos</th>
                <th>Errors</th>
                <th>Per</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.id}>
                  <td>{item.filename}</td>
                  <td>{item.totalRows}</td>
                  <td>{item.createdRows}</td>
                  <td>{item.updatedRows}</td>
                  <td>{item.skippedRows}</td>
                  <td>{item.errorRows}</td>
                  <td>{item.createdBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
