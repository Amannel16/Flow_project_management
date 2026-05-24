import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CalendarDays } from "lucide-react";

export const Route = createFileRoute("/_app/timeline")({ component: Timeline });

interface Task {
  id: string; title: string; status: "todo" | "in_progress" | "done";
  due_date: string | null; project_id: string;
  projects?: { name: string; color: string | null } | null;
}

function Timeline() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: ts } = await supabase
        .from("tasks")
        .select("id,title,status,due_date,project_id")
        .not("due_date", "is", null)
        .order("due_date", { ascending: true });
      const ids = Array.from(new Set((ts ?? []).map((t) => t.project_id)));
      let projMap: Record<string, { name: string; color: string | null }> = {};
      if (ids.length) {
        const { data: ps } = await supabase.from("projects").select("id,name,color").in("id", ids);
        ps?.forEach((p) => { projMap[p.id] = { name: p.name, color: p.color }; });
      }
      setTasks(((ts ?? []) as any[]).map((t) => ({ ...t, projects: projMap[t.project_id] ?? null })));
    };
    load();
    const ch = supabase.channel("timeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const groups = useMemo(() => {
    const out: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      const d = new Date(t.due_date!);
      const key = d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      (out[key] ??= []).push(t);
    });
    return out;
  }, [tasks]);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="flex items-center gap-3">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Upcoming work, ordered by due date.</p>

      {tasks.length === 0 ? (
        <div className="mt-12 rounded-xl border-2 border-dashed p-16 text-center text-sm text-muted-foreground">
          No tasks with due dates yet.
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {Object.entries(groups).map(([day, items]) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                {items.map((t) => (
                  <Link
                    key={t.id}
                    to="/projects/$projectId"
                    params={{ projectId: t.project_id }}
                    className="flex items-center gap-3 rounded-lg border bg-card p-3 transition hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <span className="h-8 w-1 rounded-full" style={{ background: t.projects?.color ?? "#5b7cfa" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.projects?.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">{t.status.replace("_", " ")}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
