import Link from "next/link";
import { BarChart3, Kanban, PhoneCall, Settings, Upload, Users } from "lucide-react";
import { SessionUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/layout/LogoutButton";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>Cold Calling CRM</strong>
          <span>Leads, pipeline, and calling</span>
        </div>
        <nav className="nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
          <div className="badge" style={{ alignSelf: "start" }}>
            <PhoneCall size={13} />
            WebRTC
          </div>
        </nav>
        <div style={{ marginTop: "auto", display: "grid", gap: 12 }}>
          <div>
            <strong>{user.name}</strong>
            <div className="user-meta">{user.role}</div>
          </div>
          <nav className="nav">
            <LogoutButton />
          </nav>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
