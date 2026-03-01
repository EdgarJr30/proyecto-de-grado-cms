-- DROPS TABLE
    DROP TABLE IF EXISTS public.roles CASCADE;
    DROP TABLE IF EXISTS public.users CASCADE;
    DROP TABLE IF EXISTS public.permissions CASCADE;
    DROP TABLE IF EXISTS public.role_permissions CASCADE;
    DROP TABLE IF EXISTS public.user_roles CASCADE;
    DROP TABLE IF EXISTS public.assignees CASCADE;
    DROP TABLE IF EXISTS public.tickets CASCADE;
    DROP TABLE IF EXISTS public.app_settings CASCADE;
    DROP TABLE IF EXISTS public.announcements CASCADE;
    DROP TABLE IF EXISTS public.announcement_audience_roles CASCADE;
    DROP TABLE IF EXISTS public.locations CASCADE;
    DROP TABLE IF EXISTS public.societies CASCADE;
    DROP TABLE IF EXISTS public.report_layout_preferences CASCADE;
    DROP TABLE IF EXISTS public.work_order_assignees CASCADE;
    DROP TABLE IF EXISTS public.special_incidents CASCADE;

CREATE TABLE IF NOT EXISTS public.roles (
        id serial primary key,
        name text not null,
        created_at timestamptz default now (),
        description varchar null,
        is_system boolean not null default false,
        constraint roles_nombre_key unique (name)
    );

-- users (perfil público; FK a auth.users se añade al final del archivo)
CREATE TABLE IF NOT EXISTS public.users (
        id uuid primary key,
        rol_id bigint null references public.roles (id),
        name text not null,
        last_name text not null,
        location_id bigint,
        email text,
        phone text,
        created_at timestamp default now () not null,
        is_active boolean not null default true,
        created_by uuid null default auth.uid (),
        updated_at timestamptz not null default now (),
        updated_by uuid null,
        password_reset_at timestamptz null,
        password_reset_by uuid null
    );

CREATE TABLE IF NOT EXISTS public.permissions (
        id uuid primary key default gen_random_uuid (),
        resource text not null,
        action permission_action not null,
        code text not null unique,
        label text not null,
        description text,
        is_active boolean not null default true,
        created_at timestamptz not null default now ()
    );

CREATE TABLE IF NOT EXISTS public.role_permissions (
        role_id int not null references public.roles (id) on delete cascade,
        permission_id uuid not null references public.permissions (id) on delete cascade,
        primary key (role_id, permission_id)
    );

CREATE TABLE IF NOT EXISTS public.user_roles (
        user_id uuid not null references auth.users (id) on delete cascade,
        role_id int not null references public.roles (id) on delete cascade,
        primary key (user_id, role_id)
    );

CREATE TABLE IF NOT EXISTS public.assignees (
        id bigserial primary key,
        name text not null,
        last_name text not null,
        section assignee_section_enum not null default 'SIN ASIGNAR',
        user_id uuid references public.users (id),
        email text,
        phone text,
        is_active boolean not null default true,
        created_at timestamptz not null default now (),
        updated_at timestamptz not null default now (),
        created_by uuid default auth.uid () references public.users (id),
        updated_by uuid references public.users (id),
        constraint assignees_name_section_uk unique (name, section)
    );

CREATE TABLE IF NOT EXISTS public.tickets (
    id bigserial primary key,
    title text not null,
    description text not null,
    is_accepted boolean not null default false,
    is_urgent boolean not null,
    priority priority_enum not null,
    requester text not null,
    location_id bigint,
    assignee text not null, -- legado visible
    special_incident_id integer,
    incident_date date not null,
    deadline_date date,
    is_archived boolean not null default false,
    finalized_at timestamp null,
    image text not null,
    email text,
    phone text,
    comments text,
    created_at timestamp default now () not null,
    updated_at timestamptz,
    status text default 'Pendiente',
    created_by uuid,
    updated_by uuid,
    assignee_id bigint
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  updated_at  timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_by  uuid REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message      TEXT NOT NULL,                       -- Texto del anuncio
  level        TEXT NOT NULL DEFAULT 'info',        -- info | warning | danger | success
  url          TEXT,                                -- Link opcional
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,       -- Switch general
  dismissible  BOOLEAN NOT NULL DEFAULT TRUE,       -- Si el usuario puede cerrarlo
  starts_at    TIMESTAMPTZ DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'), -- Vigencia desde
  ends_at      TIMESTAMPTZ,                         -- Vigencia hasta (opcional)

  -- NUEVO: control de audiencia
  audience_all BOOLEAN NOT NULL DEFAULT TRUE,       -- true: todos los roles; false: roles específicos

  -- Trazabilidad
  created_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by   UUID REFERENCES public.users(id),
  updated_by   UUID REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.announcement_audience_roles (
  announcement_id BIGINT NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  role_id         INT    NOT NULL REFERENCES public.roles(id)         ON DELETE CASCADE,
  PRIMARY KEY (announcement_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.locations (
  id bigserial primary key,
  name text not null unique,
  code text not null unique, -- slug para UI/API, ej: ubicacion_1
  description text,
  is_active boolean not null default true,

  created_at timestamptz not null default (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at timestamptz not null default (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by uuid null references public.users(id),
  updated_by uuid null references public.users(id)
);

CREATE TABLE IF NOT EXISTS public.societies (
  id bigserial primary key,
  name text not null,
  logo_url text null,
  login_img_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at timestamptz not null default (now() AT TIME ZONE 'America/Santo_Domingo')
);

CREATE TABLE IF NOT EXISTS public.report_layout_preferences (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tab_id text NOT NULL,
  widget_order text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz not null default (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at timestamptz not null default (now() AT TIME ZONE 'America/Santo_Domingo'),
  CONSTRAINT report_layout_preferences_pkey PRIMARY KEY (user_id, tab_id),
  CONSTRAINT report_layout_tab_id_chk CHECK (char_length(tab_id) > 0)
);

CREATE TABLE IF NOT EXISTS public.work_order_assignees (
  work_order_id     bigint NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  assignee_id       bigint NOT NULL REFERENCES public.assignees(id),
  role              assignee_role_enum NOT NULL,
  is_active         boolean NOT NULL DEFAULT true,
  assigned_at       timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  unassigned_at     timestamp,

  created_at        timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  updated_at        timestamp NOT NULL DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo'),
  created_by        uuid DEFAULT auth.uid() REFERENCES public.users(id),
  updated_by        uuid REFERENCES public.users(id)
);

CREATE TABLE IF NOT EXISTS public.special_incidents (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,               -- Ej: “Huracán”, “Tormenta eléctrica”
  code TEXT UNIQUE NOT NULL,               -- Ej: “huracan”, “tormenta_electrica”
  description TEXT,                        -- Texto opcional que explica el tipo
  is_active BOOLEAN DEFAULT TRUE,          -- Para activar/desactivar en la UI
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo') NOT NULL,
  updated_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'America/Santo_Domingo') NOT NULL,
  created_by UUID REFERENCES public.users(id) NOT NULL,
  updated_by UUID REFERENCES public.users(id)
);
