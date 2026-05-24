
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "Users can insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  color text default '#6366f1',
  created_at timestamptz not null default now()
);
alter table public.projects enable row level security;

-- Project members
create type public.member_role as enum ('owner','member');
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table public.project_members enable row level security;

-- Helper: is member (security definer to avoid recursion)
create or replace function public.is_project_member(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members
    where project_id = _project_id and user_id = _user_id);
$$;

create or replace function public.is_project_owner(_project_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.project_members
    where project_id = _project_id and user_id = _user_id and role = 'owner');
$$;

-- Project policies
create policy "Members can view projects"
  on public.projects for select to authenticated
  using (public.is_project_member(id, auth.uid()));
create policy "Authenticated can create projects"
  on public.projects for insert to authenticated
  with check (owner_id = auth.uid());
create policy "Owners can update projects"
  on public.projects for update to authenticated
  using (public.is_project_owner(id, auth.uid()));
create policy "Owners can delete projects"
  on public.projects for delete to authenticated
  using (public.is_project_owner(id, auth.uid()));

-- Auto-add owner as member when project created
create or replace function public.handle_new_project()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end; $$;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- project_members policies
create policy "Members can view project members"
  on public.project_members for select to authenticated
  using (public.is_project_member(project_id, auth.uid()));
create policy "Owners can add members"
  on public.project_members for insert to authenticated
  with check (public.is_project_owner(project_id, auth.uid()) or user_id = auth.uid() and not exists (select 1 from public.project_members where project_id = project_members.project_id));
create policy "Owners can remove members"
  on public.project_members for delete to authenticated
  using (public.is_project_owner(project_id, auth.uid()) or user_id = auth.uid());

-- Tasks
create type public.task_status as enum ('todo','in_progress','done');
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status task_status not null default 'todo',
  assignee_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tasks enable row level security;

create policy "Members can view tasks"
  on public.tasks for select to authenticated
  using (public.is_project_member(project_id, auth.uid()));
create policy "Members can create tasks"
  on public.tasks for insert to authenticated
  with check (public.is_project_member(project_id, auth.uid()) and created_by = auth.uid());
create policy "Members can update tasks"
  on public.tasks for update to authenticated
  using (public.is_project_member(project_id, auth.uid()));
create policy "Members can delete tasks"
  on public.tasks for delete to authenticated
  using (public.is_project_member(project_id, auth.uid()));

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.touch_updated_at();

-- Comments
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.comments enable row level security;

create or replace function public.can_access_task(_task_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tasks t
    join public.project_members pm on pm.project_id = t.project_id
    where t.id = _task_id and pm.user_id = _user_id
  );
$$;

create policy "Members can view comments"
  on public.comments for select to authenticated
  using (public.can_access_task(task_id, auth.uid()));
create policy "Members can create comments"
  on public.comments for insert to authenticated
  with check (public.can_access_task(task_id, auth.uid()) and user_id = auth.uid());
create policy "Users can delete own comments"
  on public.comments for delete to authenticated
  using (user_id = auth.uid());

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  content text not null,
  task_id uuid references public.tasks(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

create policy "Users see own notifications"
  on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "System inserts notifications"
  on public.notifications for insert to authenticated with check (true);
create policy "Users update own notifications"
  on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "Users delete own notifications"
  on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Notify on task assignment
create or replace function public.notify_task_assignment()
returns trigger language plpgsql security definer set search_path = public as $$
declare proj_name text;
begin
  if new.assignee_id is not null and new.assignee_id <> coalesce(old.assignee_id, '00000000-0000-0000-0000-000000000000'::uuid) and new.assignee_id <> auth.uid() then
    select name into proj_name from public.projects where id = new.project_id;
    insert into public.notifications (user_id, type, content, task_id, project_id)
    values (new.assignee_id, 'task_assigned', 'You were assigned to "' || new.title || '" in ' || coalesce(proj_name,'a project'), new.id, new.project_id);
  end if;
  return new;
end; $$;
create trigger tasks_notify_assign
  after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assignment();

-- Notify on comment
create or replace function public.notify_task_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare t record;
begin
  select project_id, title, assignee_id, created_by into t from public.tasks where id = new.task_id;
  -- notify assignee and creator (excluding the commenter)
  if t.assignee_id is not null and t.assignee_id <> new.user_id then
    insert into public.notifications (user_id, type, content, task_id, project_id)
    values (t.assignee_id, 'task_comment', 'New comment on "' || t.title || '"', new.task_id, t.project_id);
  end if;
  if t.created_by is not null and t.created_by <> new.user_id and t.created_by <> coalesce(t.assignee_id,'00000000-0000-0000-0000-000000000000'::uuid) then
    insert into public.notifications (user_id, type, content, task_id, project_id)
    values (t.created_by, 'task_comment', 'New comment on "' || t.title || '"', new.task_id, t.project_id);
  end if;
  return new;
end; $$;
create trigger comments_notify after insert on public.comments
  for each row execute function public.notify_task_comment();

-- Realtime
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.project_members;
