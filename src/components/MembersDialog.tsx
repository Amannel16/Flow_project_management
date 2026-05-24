import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";

interface Member { user_id: string; role: string; profile?: { full_name: string | null; email: string | null } }

export function MembersDialog({
  open, onOpenChange, projectId, ownerId, members, onChanged,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  projectId: string; ownerId: string; members: Member[]; onChanged: () => void;
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = user?.id === ownerId;

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email.trim()).maybeSingle();
    if (!profile) { setBusy(false); return toast.error("No user found with that email"); }
    if (members.some((m) => m.user_id === profile.id)) { setBusy(false); return toast.error("Already a member"); }
    const { error } = await supabase.from("project_members").insert({ project_id: projectId, user_id: profile.id, role: "member" });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Member added");
    setEmail("");
    onChanged();
  };

  const remove = async (uid: string) => {
    const { error } = await supabase.from("project_members").delete().eq("project_id", projectId).eq("user_id", uid);
    if (error) return toast.error(error.message);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Project members</DialogTitle></DialogHeader>
        {isOwner && (
          <form onSubmit={invite} className="flex gap-2">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@email.com" />
            <Button type="submit" disabled={busy}><UserPlus className="mr-1.5 h-4 w-4" /> Add</Button>
          </form>
        )}
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-3 rounded-md border p-2">
              <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">
                {(m.profile?.full_name || m.profile?.email || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback></Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.profile?.full_name || m.profile?.email}</p>
                <p className="truncate text-xs text-muted-foreground">{m.profile?.email}</p>
              </div>
              <span className="rounded bg-secondary px-2 py-0.5 text-xs capitalize">{m.role}</span>
              {isOwner && m.user_id !== ownerId && (
                <Button variant="ghost" size="icon" onClick={() => remove(m.user_id)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
