import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BarChart3, CheckCircle2, Clock, ListTodo, FolderKanban } from "lucide-react";

export const Route = createFileRoute("/_app/analytics")({ component: Analytics });

interface Row { project_id: string; status: "todo" | "in_progress" | "done" }
interface Project { id: string; name: string; color: string | null }

function Analytics() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Row[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: ts }, { data: ps }] = await Promise.all([
        supabase.from("tasks").select("project_id,status"),
        supabase.from("projects").select("id,name,color"),
      ]);
      setTasks((ts ?? []) as Row[]);
      setProjects((ps ?? []) as Project[]);
    };
    load();
    const ch = supabase.channel("analytics")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProg = tasks.filter((t) => t.status === "in_progress").length;
  const todo = tasks.filter((t) => t.status === "todo").length;

  const stats = [
    { icon: FolderKanban, label: "Projects", value: projects.length, tone: "text-primary" },
    { icon: ListTodo, label: "To do", value: todo, tone: "text-muted-foreground" },
    { icon: Clock, label: "In progress", value: inProg, tone: "text-warning" },
    { icon: CheckCircle2, label: "Completed", value: done, tone: "text-success" },
  ];

  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Overview of progress across your workspace.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <s.icon className={`h-4 w-4 ${s.tone}`} />
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border bg-card p-6">
        <h2 className="text-sm font-semibold">Completion by project</h2>
        <p className="mt-1 text-xs text-muted-foreground">Percentage of tasks marked done.</p>
        <div className="mt-5 space-y-4">
          {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
          {projects.map((p) => {
            const projTasks = tasks.filter((t) => t.project_id === p.id);
            const t = projTasks.length;
            const d = projTasks.filter((x) => x.status === "done").length;
            const pct = t ? Math.round((d / t) * 100) : 0;
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? "#5b7cfa" }} />
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="text-muted-foreground">{d}/{t} · {pct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {total > 0 && (
        <div className="mt-8 rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold">Status distribution</h2>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-secondary">
            <div style={{ width: `${(todo / total) * 100}%` }} className="bg-muted-foreground/60" />
            <div style={{ width: `${(inProg / total) * 100}%` }} className="bg-warning" />
            <div style={{ width: `${(done / total) * 100}%` }} className="bg-success" />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground/60" /> To do · {todo}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> In progress · {inProg}</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success" /> Done · {done}</span>
          </div>
        </div>
      )}
    </div>
  );
}
