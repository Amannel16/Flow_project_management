import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut, LayoutDashboard, Plus, ListChecks, CalendarDays, BarChart3, Hexagon,
} from "lucide-react";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";

const WORKSPACE = [
  { to: "/dashboard", label: "Board", icon: LayoutDashboard },
  { to: "/my-tasks", label: "My Tasks", icon: ListChecks },
  { to: "/timeline", label: "Timeline", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell() {
  const { user, loading, signOut } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [onlineCount, setOnlineCount] = useState(1);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [user, loading, nav]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase.from("projects").select("id,name,color").order("created_at", { ascending: false });
      setProjects(data ?? []);
    };
    load();
    const ch = supabase.channel("projects-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const presence = supabase.channel("global-presence", { config: { presence: { key: user.id } } });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        setOnlineCount(Object.keys(state).length || 1);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await presence.track({ at: Date.now() });
      });
    return () => { supabase.removeChannel(presence); };
  }, [user]);

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading…</div>;
  }

  const fullName = (user.user_metadata?.full_name as string) || user.email || "User";
  const initials = fullName.split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        {/* Logo */}
        <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
            <Hexagon className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">Nexus</span>
        </div>

        {/* Workspace */}
        <div className="px-3 py-3">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Workspace</p>
          <div className="space-y-0.5">
            {WORKSPACE.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-primary/15 text-primary" }}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13.5px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <div className="flex items-center justify-between px-2 pb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Projects</p>
            <button
              onClick={() => setOpenCreate(true)}
              className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="New project"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {projects.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects yet</p>
            )}
            {projects.map((p) => (
              <Link
                key={p.id}
                to="/projects/$projectId"
                params={{ projectId: p.id }}
                activeProps={{ className: "bg-primary/15 text-primary" }}
                className="flex items-center gap-2.5 truncate rounded-md px-2 py-1.5 text-[13.5px] text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color ?? "#5b7cfa" }} />
                <span className="truncate">{p.name}</span>
              </Link>
            ))}
            <button
              onClick={() => setOpenCreate(true)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] text-primary hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5" /> New project
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 flex items-center gap-1.5 px-2 text-[11.5px] font-medium text-success">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live · {onlineCount} online
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2 rounded-md p-1.5 text-left transition hover:bg-secondary">
                <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/20 text-[11px] text-primary">{initials}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{fullName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await signOut(); nav({ to: "/" }); }}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-2 border-b bg-card px-6">
          <NotificationsBell />
        </header>
        <main className="min-w-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <CreateProjectDialog open={openCreate} onOpenChange={setOpenCreate} />
    </div>
  );
}
