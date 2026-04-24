import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="login-page">
      <section className="login-card">
        <h1>Cold Calling CRM</h1>
        <p className="muted">
          Accés privat per gestionar leads, pipeline, imports CSV i trucades WebRTC.
        </p>
        <LoginForm />
      </section>
    </div>
  );
}
