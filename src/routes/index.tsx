import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Users, MessageSquare, Zap, Bell, Layout } from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

function Landing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && user) nav({ to: "/dashboard" });
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen" style={{ background: "var(--gradient-subtle)" }}>
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Layout className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold">Flow</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild><Link to="/login">Sign in</Link></Button>
          <Button asChild><Link to="/signup">Get started</Link></Button>
        </div>
      </header>

      <section className="container mx-auto px-6 pt-16 pb-24 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Real-time collaboration
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
          Where teams turn ideas <br />
          into <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>shipped work</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Plan projects on visual boards, assign tasks to teammates, and chat inside every card — all updated live.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button size="lg" asChild className="shadow-[var(--shadow-elegant)]">
            <Link to="/signup">Start free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">I have an account</Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto grid gap-6 px-6 pb-24 md:grid-cols-3">
        {[
          { icon: Layout, title: "Kanban boards", desc: "Drag tasks across To do, In progress, and Done." },
          { icon: Users, title: "Team projects", desc: "Invite teammates and assign work to anyone." },
          { icon: MessageSquare, title: "Threaded comments", desc: "Discuss tasks without leaving the card." },
          { icon: Zap, title: "Live updates", desc: "See changes from teammates instantly." },
          { icon: Bell, title: "Smart notifications", desc: "Get pinged when work needs you." },
          { icon: CheckCircle2, title: "Built for focus", desc: "Clean, fast, opinionated UI." },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-elegant)]">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent">
              <f.icon className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
