import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Users, Trash2, MessageSquare, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { TaskDialog } from "@/components/TaskDialog";
import { MembersDialog } from "@/components/MembersDialog";

export const Route = createFileRoute("/_app/projects/$projectId")({ component: ProjectBoard });

type Status = "todo" | "in_progress" | "done";
interface Task {
  id: string; project_id: string; title: string; description: string | null;
  status: Status; assignee_id: string | null; created_by: string;
  position: number; due_date: string | null; created_at: string;
}
interface Member { user_id: string; role: string; profile?: { full_name: string | null; email: string | null } }

const COLUMNS: { key: Status; label: string; dot: string }[] = [
  { key: "todo", label: "To do", dot: "bg-muted-foreground" },
  { key: "in_progress", label: "In progress", dot: "bg-primary" },
  { key: "done", label: "Done", dot: "bg-success" },
];

const AVATAR_TONES = [
  "bg-primary/20 text-primary",
  "bg-warning/20 text-warning",
  "bg-success/20 text-success",
  "bg-pink-500/20 text-pink-400",
  "bg-purple-500/20 text-purple-400",
];
const toneFor = (id: string) => AVATAR_TONES[Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_TONES.length];

function ProjectBoard() {
  const { projectId } = Route.useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<{ id: string; name: string; description: string | null; color: string | null; owner_id: string } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [newTitles, setNewTitles] = useState<Record<Status, string>>({ todo: "", in_progress: "", done: "" });
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [openMembers, setOpenMembers] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const loadAll = async () => {
    const [p, t, m] = await Promise.all([
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase.from("tasks").select("*").eq("project_id", projectId).order("position"),
      supabase.from("project_members").select("user_id,role").eq("project_id", projectId),
    ]);
    setProject(p.data as any);
    setTasks((t.data ?? []) as Task[]);
    const userIds = (m.data ?? []).map((x) => x.user_id);
    let profiles: any[] = [];
    if (userIds.length) {
      const { data } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
      profiles = data ?? [];
    }
    setMembers((m.data ?? []).map((x) => ({ ...x, profile: profiles.find((p) => p.id === x.user_id) })));

    const taskIds = (t.data ?? []).map((x) => x.id);
    if (taskIds.length) {
      const { data: comments } = await supabase.from("comments").select("task_id").in("task_id", taskIds);
      const counts: Record<string, number> = {};
      comments?.forEach((c) => { counts[c.task_id] = (counts[c.task_id] ?? 0) + 1; });
      setCommentCounts(counts);
    } else {
      setCommentCounts({});
    }
  };

  useEffect(() => {
    loadAll();
    const ch = supabase.channel("project-" + projectId)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `project_id=eq.${projectId}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: `project_id=eq.${projectId}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const grouped = useMemo(() => {
    const g: Record<Status, Task[]> = { todo: [], in_progress: [], done: [] };
    tasks.forEach((t) => g[t.status].push(t));
    return g;
  }, [tasks]);

  const addTask = async (status: Status) => {
    const title = newTitles[status].trim();
    if (!title || !user) return;
    const position = (grouped[status].at(-1)?.position ?? 0) + 1;
    setNewTitles((p) => ({ ...p, [status]: "" }));
    const { error } = await supabase.from("tasks").insert({
      project_id: projectId, title, status, position, created_by: user.id,
    });
    if (error) toast.error(error.message);
  };

  const onDrop = async (status: Status) => {
    if (!dragId) return;
    const task = tasks.find((t) => t.id === dragId);
    if (!task || task.status === status) { setDragId(null); return; }
    setTasks((prev) => prev.map((t) => t.id === dragId ? { ...t, status } : t));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", dragId);
    if (error) { toast.error(error.message); loadAll(); }
    setDragId(null);
  };

  const deleteTask = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await supabase.from("tasks").delete().eq("id", id);
  };

  if (!project) return <div className="p-8 text-muted-foreground">Loading…</div>;

  const totalCount = tasks.length;
  const doneCount = grouped.done.length;
  const pct = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: project.color ?? "#5b7cfa" }} />
              <h1 className="truncate text-xl font-bold tracking-tight">{project.name}</h1>
              <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> On track
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="h-1 w-40 overflow-hidden rounded-full bg-secondary">
                <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--gradient-primary)" }} />
              </div>
              <span className="text-[11.5px] text-muted-foreground">{pct}% complete · {doneCount}/{totalCount} tasks</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((m) => (
                <Avatar key={m.user_id} className="h-7 w-7 border-2 border-card">
                  <AvatarFallback className={`${toneFor(m.user_id)} text-[10px] font-semibold`}>
                    {(m.profile?.full_name || m.profile?.email || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpenMembers(true)}>
              <Users className="mr-1.5 h-4 w-4" /> Members
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className="flex w-72 shrink-0 flex-col rounded-xl border bg-secondary/40"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(col.key)}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className={`h-2 w-2 rounded-full ${col.dot}`} />
              <h3 className="text-[13px] font-semibold">{col.label}</h3>
              <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[11px] text-muted-foreground">{grouped[col.key].length}</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
              {grouped[col.key].map((t) => {
                const assignee = members.find((m) => m.user_id === t.assignee_id);
                const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";
                const priorityColor = overdue ? "var(--destructive)" : t.status === "in_progress" ? "var(--warning)" : t.status === "done" ? "var(--success)" : "var(--muted-foreground)";
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onClick={() => setOpenTask(t.id)}
                    className="group relative cursor-pointer rounded-lg border bg-card p-3 transition hover:-translate-y-0.5 hover:border-border/60 hover:shadow-[var(--shadow-card)]"
                  >
                    <span className="absolute left-0 top-0 h-full w-[3px] rounded-l-lg" style={{ background: priorityColor }} />
                    <div className="flex items-start justify-between gap-2 pl-1">
                      <p className="text-[13px] font-medium leading-snug">{t.title}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteTask(t.id); }}
                        className="opacity-0 transition group-hover:opacity-100"
                        aria-label="Delete task"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                    {t.description && <p className="mt-1 line-clamp-2 pl-1 text-[11.5px] text-muted-foreground">{t.description}</p>}
                    <div className="mt-2.5 flex items-center gap-2 pl-1">
                      {assignee && (
                        <Avatar className="h-5 w-5">
                          <AvatarFallback className={`${toneFor(assignee.user_id)} text-[8px] font-semibold`}>
                            {(assignee.profile?.full_name || assignee.profile?.email || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {commentCounts[t.id] ? (
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><MessageSquare className="h-3 w-3" />{commentCounts[t.id]}</span>
                      ) : null}
                      {t.due_date && (
                        <span className={`ml-auto flex items-center gap-1 text-[11px] ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          <CalendarIcon className="h-3 w-3" />
                          {new Date(t.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-2">
              <form onSubmit={(e) => { e.preventDefault(); addTask(col.key); }} className="flex gap-1">
                <Input
                  placeholder="Add task…"
                  value={newTitles[col.key]}
                  onChange={(e) => setNewTitles((p) => ({ ...p, [col.key]: e.target.value }))}
                  className="h-8 border-transparent bg-card text-[12.5px] focus-visible:border-primary"
                />
                <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" disabled={!newTitles[col.key].trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <TaskDialog
        taskId={openTask}
        members={members}
        onClose={() => setOpenTask(null)}
      />
      <MembersDialog
        open={openMembers}
        onOpenChange={setOpenMembers}
        projectId={projectId}
        ownerId={project.owner_id}
        members={members}
        onChanged={loadAll}
      />
    </div>
  );
}
