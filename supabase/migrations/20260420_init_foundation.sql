-- Foundation schema: users, music_connections, rooms
-- SPEC: F1/F2 Foundation — persist user identity, OAuth connections per provider,
--       and per-user published "rooms" that will be served at onrepeat.cc/@handle/slug.

-- =====================================================
-- users: core identity, populated from NextAuth on login
-- =====================================================
create table public.users (
  id            uuid        primary key default gen_random_uuid(),
  google_id     text        unique not null,
  email         text        not null,
  display_name  text,
  avatar_url    text,
  handle        text        unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.users is
  'Core user identity. Populated on NextAuth login. Handle is chosen via a one-time modal after first sign-in.';

-- Fast OAuth-subject lookup on every login
create index users_google_id_idx on public.users (google_id);

-- @handle route resolution
create index users_handle_idx on public.users (handle) where handle is not null;

-- =====================================================
-- music_connections: stored OAuth tokens per provider
--   google arrives with current NextAuth flow.
--   spotify arrives with C track.
-- =====================================================
create table public.music_connections (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.users (id) on delete cascade,
  provider             text        not null check (provider in ('google', 'spotify')),
  provider_account_id  text        not null,
  access_token         text,
  refresh_token        text,
  expires_at           timestamptz,
  scope                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, provider)
);
comment on table public.music_connections is
  'OAuth token storage per provider. Accessed only via service_role on the server.';

create index music_connections_user_idx on public.music_connections (user_id);

-- =====================================================
-- rooms: a user's published 3D listening room
-- URL: onrepeat.cc/@handle/slug
-- =====================================================
create table public.rooms (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null references public.users (id) on delete cascade,
  slug                 text        not null,
  title                text        not null,
  preset_key           text        not null default 'late-night',
  source_provider      text        not null check (source_provider in ('youtube', 'spotify')),
  source_playlist_id   text        not null,
  mood_vector          jsonb       not null default '{}'::jsonb,
  visibility           text        not null default 'public' check (visibility in ('public', 'unlisted', 'private')),
  cover_colors         text[]      not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, slug)
);
comment on table public.rooms is
  'A user''s published listening room. preset_key maps to a 3D visual preset registered in the client.';

create index rooms_user_idx on public.rooms (user_id);
create index rooms_public_recent_idx on public.rooms (created_at desc) where visibility = 'public';

-- =====================================================
-- updated_at auto-update trigger
-- =====================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger music_connections_set_updated_at
  before update on public.music_connections
  for each row execute function public.set_updated_at();

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

-- =====================================================
-- Row Level Security
-- =====================================================
-- All tables have RLS enabled. Initial policy: no anon/authenticated
-- access — the Next.js server (service_role) is the only reader/writer.
-- Specific anon SELECT policies will be added in a later migration
-- (e.g. rooms with visibility = 'public' for visitor pages).
alter table public.users             enable row level security;
alter table public.music_connections enable row level security;
alter table public.rooms             enable row level security;
