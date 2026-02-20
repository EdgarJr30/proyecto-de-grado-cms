#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const HELP = `
Uso:
  npm run admin:create-first -- --email admin@demo.com --password "12345678" --name "Admin" --last-name "Principal"

Opcionales:
  --location-id 1
  --role-name Administrator
  --no-email-confirm

Variables de entorno requeridas:
  SUPABASE_SERVICE_ROLE_KEY
  SUPABASE_URL (o VITE_SUPABASE_URL)

Notas:
  - El script crea/actualiza usuario en auth.users.
  - Luego hace upsert en public.users.
  - Asigna el rol Administrator en public.user_roles.
`;

function parseArgs(argv) {
  const parsed = new Map();

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith('--')) {
      parsed.set(key, true);
      continue;
    }

    parsed.set(key, next);
    i += 1;
  }

  return parsed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const idx = line.indexOf('=');
    if (idx <= 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function isAlreadyExistsAuthError(error) {
  const msg = String(error?.message ?? '').toLowerCase();
  return (
    msg.includes('already') ||
    msg.includes('exists') ||
    msg.includes('registered')
  );
}

async function findAuthUserIdByEmail(adminClient, email) {
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw error;

    const users = data?.users ?? [];
    const found = users.find(
      (u) => String(u.email ?? '').toLowerCase() === normalized
    );

    if (found?.id) return found.id;
    if (users.length < perPage) return null;

    page += 1;
  }
}

async function ensureAdminRoleId(adminClient, roleName) {
  const selectRole = await adminClient
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .limit(1);

  if (selectRole.error) throw selectRole.error;
  if ((selectRole.data ?? []).length > 0) {
    return selectRole.data[0].id;
  }

  const insertRole = await adminClient
    .from('roles')
    .insert({
      name: roleName,
      description: 'Acceso total',
      is_system: true,
    })
    .select('id')
    .single();

  if (!insertRole.error && insertRole.data?.id) {
    return insertRole.data.id;
  }

  if (insertRole.error?.code !== '23505') {
    throw insertRole.error;
  }

  const reselect = await adminClient
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .limit(1)
    .single();

  if (reselect.error) throw reselect.error;
  return reselect.data.id;
}

async function ensureAuthUser(
  adminClient,
  { email, password, name, lastName, emailConfirm }
) {
  const create = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: emailConfirm,
    user_metadata: {
      name,
      last_name: lastName,
    },
  });

  if (!create.error) {
    const userId = create.data?.user?.id;
    if (!userId) throw new Error('Auth creó el usuario pero no retornó id.');
    return userId;
  }

  if (!isAlreadyExistsAuthError(create.error)) {
    throw create.error;
  }

  const existingUserId = await findAuthUserIdByEmail(adminClient, email);
  if (!existingUserId) {
    throw new Error(
      'El usuario ya existe en auth, pero no se pudo resolver su id por email.'
    );
  }

  const update = await adminClient.auth.admin.updateUserById(existingUserId, {
    password,
    email_confirm: emailConfirm,
    user_metadata: {
      name,
      last_name: lastName,
    },
  });

  if (update.error) throw update.error;
  return existingUserId;
}

async function main() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, '.env'));
  loadEnvFile(path.join(cwd, '.env.local'));
  loadEnvFile(path.join(cwd, '.env.admin.local'));

  const args = parseArgs(process.argv.slice(2));

  if (args.has('help') || args.has('h')) {
    console.log(HELP);
    process.exit(0);
  }

  const email = String(args.get('email') ?? '').trim();
  const password = String(args.get('password') ?? '').trim();
  const name = String(args.get('name') ?? '').trim();
  const lastName = String(
    args.get('last-name') ?? args.get('lastName') ?? ''
  ).trim();

  const locationArg = args.get('location-id') ?? args.get('locationId');
  const locationId =
    locationArg !== undefined && locationArg !== true
      ? Number(locationArg)
      : null;

  const roleName = String(args.get('role-name') ?? 'Administrator');
  const emailConfirm = !args.has('no-email-confirm');

  if (!email || !password || !name || !lastName) {
    console.error('Faltan argumentos obligatorios. Usa --help para ver uso.');
    process.exit(1);
  }

  if (locationId !== null && Number.isNaN(locationId)) {
    console.error('location-id debe ser numerico.');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    console.error('Falta SUPABASE_URL o VITE_SUPABASE_URL en el entorno.');
    process.exit(1);
  }

  if (!serviceRoleKey) {
    console.error('Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const roleId = await ensureAdminRoleId(adminClient, roleName);

    const userId = await ensureAuthUser(adminClient, {
      email,
      password,
      name,
      lastName,
      emailConfirm,
    });

    const upsertUser = await adminClient.from('users').upsert(
      {
        id: userId,
        rol_id: roleId,
        name,
        last_name: lastName,
        location_id: locationId,
        email,
        is_active: true,
      },
      { onConflict: 'id' }
    );

    if (upsertUser.error) throw upsertUser.error;

    const upsertUserRole = await adminClient.from('user_roles').upsert(
      {
        user_id: userId,
        role_id: roleId,
      },
      { onConflict: 'user_id,role_id' }
    );

    if (upsertUserRole.error) throw upsertUserRole.error;

    console.log('Admin creado/actualizado correctamente.');
    console.log(`- auth.users.id: ${userId}`);
    console.log(`- email: ${email}`);
    console.log(`- role: ${roleName} (id=${roleId})`);
  } catch (error) {
    console.error('No se pudo crear/actualizar el primer admin.');
    console.error(error);
    process.exit(1);
  }
}

main();
