import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/my-tasks")({ component: MyTasks });

interface Task {
  id: string; title: string; status: "todo" | "in_progress" | "done";
  due_date: string | null; project_id: string;
  projects?: { name: string; color: string | null } | null;
}

const STATUS_LABEL: Record<Task["status"], string> = {
  todo: "To do", in_progress: "In progress", done: "Done",
};
const STATUS_TONE: Record<Task["status"], string> = {
  todo: "bg-muted-foreground/20 text-muted-foreground",
  in_progress: "bg-primary/20 text-primary",
  done: "bg-success/20 text-success",
};

function MyTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<"all" | Task["status"]>("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: ts } = await supabase
        .from("tasks")
        .select("id,title,status,due_date,project_id")
        .eq("assignee_id", user.id)
        .order("due_date", { ascending: true, nullsFirst: false });
      const ids = Array.from(new Set((ts ?? []).map((t) => t.project_id)));
      let projMap: Record<string, { name: string; color: string | null }> = {};
      if (ids.length) {
        const { data: ps } = await supabase.from("projects").select("id,name,color").in("id", ids);
        ps?.forEach((p) => { projMap[p.id] = { name: p.name, color: p.color }; });
      }
      setTasks(((ts ?? []) as any[]).map((t) => ({ ...t, projects: projMap[t.project_id] ?? null })));
    };
    load();
    const ch = supabase.channel("my-tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="flex items-center gap-3">
        <ListChecks className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">My Tasks</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Everything assigned to you across projects.</p>

      <div className="mt-6 inline-flex rounded-lg bg-secondary p-1">
        {(["all", "todo", "in_progress", "done"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              filter === s ? "bg-card text-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "all" ? "All" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No tasks here.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((t) => (
              <li key={t.id}>
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: t.project_id }}
                  className="flex items-center gap-3 px-5 py-3 transition hover:bg-secondary/50"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.projects?.color ?? "#5b7cfa" }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.projects?.name ?? "Project"}</p>
                  </div>
                  {t.due_date && (
                    <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                      <Calendar className="h-3 w-3" />
                      {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                  <Badge className={`${STATUS_TONE[t.status]} border-0 text-[10px] uppercase tracking-wide`}>
                    {STATUS_LABEL[t.status]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
