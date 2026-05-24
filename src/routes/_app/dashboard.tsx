import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Plus, FolderKanban, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

interface Project {
  id: string; name: string; description: string | null; color: string | null;
}

function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [counts, setCounts] = useState<Record<string, { total: number; done: number; inProg: number }>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      const list = (data ?? []) as Project[];
      setProjects(list);
      if (list.length) {
        const { data: tasks } = await supabase.from("tasks").select("project_id,status").in("project_id", list.map(p => p.id));
        const c: Record<string, { total: number; done: number; inProg: number }> = {};
        list.forEach(p => c[p.id] = { total: 0, done: 0, inProg: 0 });
        tasks?.forEach(t => {
          c[t.project_id].total++;
          if (t.status === "done") c[t.project_id].done++;
          if (t.status === "in_progress") c[t.project_id].inProg++;
        });
        setCounts(c);
      }
    };
    load();
    const ch = supabase.channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const totalProjects = projects.length;
  const totalTasks = Object.values(counts).reduce((s, c) => s + c.total, 0);
  const totalDone = Object.values(counts).reduce((s, c) => s + c.done, 0);

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Board</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Pick up where you left off.</p>
          </div>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New project</Button>
      </div>

      {projects.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Active projects" value={totalProjects} />
          <Stat label="Open tasks" value={totalTasks - totalDone} />
          <Stat label="Completed" value={totalDone} />
        </div>
      )}

      {projects.length === 0 ? (
        <div className="mt-12 rounded-2xl border-2 border-dashed border-border p-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15">
            <FolderKanban className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Create your first project</h3>
          <p className="mt-1 text-sm text-muted-foreground">Organize tasks on a Kanban board, invite teammates, and ship.</p>
          <Button className="mt-6 gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New project</Button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const c = counts[p.id] ?? { total: 0, done: 0, inProg: 0 };
            const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
            return (
              <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}
                className="group relative overflow-hidden rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-elegant)]">
                <div className="absolute left-0 top-0 h-full w-1" style={{ background: p.color ?? "#5b7cfa" }} />
                <div className="flex items-center gap-2 pl-2">
                  <h3 className="truncate font-semibold group-hover:text-primary">{p.name}</h3>
                </div>
                {p.description && <p className="mt-2 line-clamp-2 pl-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-4 pl-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{c.done} of {c.total} tasks</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
                  </div>
                  <div className="mt-3 flex gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> {c.inProg} active</span>
                    <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-success" /> {c.done} done</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <CreateProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}
