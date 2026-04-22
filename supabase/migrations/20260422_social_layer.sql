-- SPEC-SOCIAL-001: Social layer (visitors, reactions, suggestions, extra tracks)

-- Visitors: anonymous cookie-signed identity
create table public.visitors (
  id          uuid primary key,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);

-- Track reactions
create table public.track_reactions (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  track_ref    text not null,
  actor_kind   text not null check (actor_kind in ('visitor','user')),
  visitor_id   uuid references public.visitors(id) on delete cascade,
  user_id      uuid references public.users(id)    on delete cascade,
  emoji        text not null,
  created_at   timestamptz not null default now(),
  check (
    (actor_kind = 'visitor' and visitor_id is not null and user_id is null)
    or
    (actor_kind = 'user'    and user_id    is not null and visitor_id is null)
  )
);
create index track_reactions_room_track_idx
  on public.track_reactions (room_id, track_ref);
-- Idempotency: uniqueness on the actor (either visitor_id or user_id) + emoji.
-- Expressed as a unique expression index because Postgres does not allow
-- function calls inside a plain UNIQUE constraint column list.
create unique index track_reactions_actor_emoji_unique_idx
  on public.track_reactions (
    room_id, track_ref, actor_kind,
    coalesce(visitor_id::text, user_id::text),
    emoji
  );

-- Track suggestions (auth-required queue)
create table public.track_suggestions (
  id                   uuid primary key default gen_random_uuid(),
  room_id              uuid not null references public.rooms(id) on delete cascade,
  suggested_by         uuid not null references public.users(id) on delete cascade,
  source_provider      text not null check (source_provider in ('youtube','spotify')),
  external_track_id    text not null,
  title                text not null,
  artist               text not null,
  thumbnail_url        text,
  duration_sec         int,
  status               text not null default 'pending'
                         check (status in ('pending','approved','rejected')),
  created_at           timestamptz not null default now(),
  resolved_at          timestamptz,
  unique (room_id, suggested_by, external_track_id)
);
create index track_suggestions_room_status_idx
  on public.track_suggestions (room_id, status);

-- Room extra tracks (approved suggestions, room-scoped only)
create table public.room_extra_tracks (
  id              uuid primary key default gen_random_uuid(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  suggestion_id   uuid not null references public.track_suggestions(id) on delete cascade,
  position        int not null,
  created_at      timestamptz not null default now(),
  unique (room_id, suggestion_id),
  unique (room_id, position)
);

-- RLS: service-role-only initial access (mirrors Phase 1)
alter table public.visitors          enable row level security;
alter table public.track_reactions   enable row level security;
alter table public.track_suggestions enable row level security;
alter table public.room_extra_tracks enable row level security;
