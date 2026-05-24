import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Member { user_id: string; profile?: { full_name: string | null; email: string | null } }

interface Comment {
  id: string; content: string; created_at: string; user_id: string;
  profile?: { full_name: string | null; email: string | null };
}

export function TaskDialog({ taskId, members, onClose }: { taskId: string | null; members: Member[]; onClose: () => void }) {
  const { user } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string>("todo");
  const [assignee, setAssignee] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    if (!taskId) return;
    const load = async () => {
      const { data } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
      if (data) {
        setTask(data);
        setTitle(data.title);
        setDescription(data.description ?? "");
        setStatus(data.status);
        setAssignee(data.assignee_id ?? "unassigned");
        setDueDate(data.due_date ? new Date(data.due_date) : undefined);
      }
      const { data: cmts } = await supabase.from("comments").select("*").eq("task_id", taskId).order("created_at");
      const userIds = [...new Set((cmts ?? []).map((c) => c.user_id))];
      let profiles: any[] = [];
      if (userIds.length) {
        const { data: p } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
        profiles = p ?? [];
      }
      setComments((cmts ?? []).map((c) => ({ ...c, profile: profiles.find((p) => p.id === c.user_id) })));
    };
    load();
    const ch = supabase.channel("task-" + taskId)
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `task_id=eq.${taskId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `id=eq.${taskId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [taskId]);

  const save = async () => {
    if (!taskId) return;
    const { error } = await supabase.from("tasks").update({
      title, description, status: status as "todo" | "in_progress" | "done",
      assignee_id: assignee === "unassigned" ? null : assignee,
      due_date: dueDate ? dueDate.toISOString() : null,
    }).eq("id", taskId);
    if (error) return toast.error(error.message);
    toast.success("Task updated");
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim() || !taskId) return;
    const content = newComment;
    setNewComment("");
    const { error } = await supabase.from("comments").insert({ task_id: taskId, user_id: user.id, content });
    if (error) toast.error(error.message);
  };

  const deleteComment = async (id: string) => {
    await supabase.from("comments").delete().eq("id", id);
  };

  const initials = (name: string | null | undefined, email: string | null | undefined) =>
    (name || email || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Dialog open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {task && (
          <>
            <DialogHeader>
              <DialogTitle>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save}
                  className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0" />
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={(v) => { setStatus(v); setTimeout(save, 0); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To do</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Assignee</Label>
                <Select value={assignee} onValueChange={(v) => { setAssignee(v); setTimeout(save, 0); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profile?.full_name || m.profile?.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Due date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("mt-1 w-full justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "MMM d, yyyy") : <span>Set date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={(d) => { setDueDate(d); setTimeout(save, 0); }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                    {dueDate && (
                      <div className="border-t p-2">
                        <Button variant="ghost" size="sm" className="w-full" onClick={() => { setDueDate(undefined); setTimeout(save, 0); }}>
                          Clear date
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={save}
                rows={4} placeholder="Add more details…" className="mt-1" />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Activity</Label>
              <div className="mt-2 max-h-64 space-y-3 overflow-y-auto pr-1">
                {comments.length === 0 && <p className="text-sm text-muted-foreground">Be the first to comment.</p>}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2">
                    <Avatar className="h-7 w-7"><AvatarFallback className="text-[10px]">{initials(c.profile?.full_name, c.profile?.email)}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1 rounded-lg bg-secondary p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold">{c.profile?.full_name || c.profile?.email}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </span>
                          {c.user_id === user?.id && (
                            <button onClick={() => deleteComment(c.id)}>
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={postComment} className="mt-3 flex gap-2">
                <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment…" />
                <Button type="submit" size="icon" disabled={!newComment.trim()}><Send className="h-4 w-4" /></Button>
              </form>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
