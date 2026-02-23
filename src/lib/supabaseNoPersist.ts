const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or anon key');
}

/**
 * Wrapper mínimo para crear usuarios en Auth sin instanciar otro GoTrueClient.
 * Evita el warning de múltiples instancias y no toca la sesión actual del admin.
 */
type SignUpParams = {
  email: string;
  password: string;
  options?: {
    data?: Record<string, unknown>;
  };
};

type SignUpData = {
  user: { id: string } | null;
};

type SignUpResult = {
  data: SignUpData;
  error: Error | null;
};

type AuthErrorPayload = {
  msg?: string;
  message?: string;
  error_description?: string;
  error?: string;
};

function getAuthErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === 'object') {
    const p = payload as AuthErrorPayload;
    return (
      p.msg ??
      p.error_description ??
      p.message ??
      p.error ??
      `Error en signup de Auth (HTTP ${status})`
    );
  }
  return `Error en signup de Auth (HTTP ${status})`;
}

async function signUpNoPersist(params: SignUpParams): Promise<SignUpResult> {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/signup`;
  const body = {
    email: params.email,
    password: params.password,
    data: params.options?.data ?? {},
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        data: { user: null },
        error: new Error(getAuthErrorMessage(payload, response.status)),
      };
    }

    const userId =
      payload &&
      typeof payload === 'object' &&
      'user' in payload &&
      payload.user &&
      typeof payload.user === 'object' &&
      'id' in payload.user &&
      typeof payload.user.id === 'string'
        ? payload.user.id
        : null;

    return {
      data: { user: userId ? { id: userId } : null },
      error: null,
    };
  } catch (err: unknown) {
    return {
      data: { user: null },
      error: err instanceof Error ? err : new Error('Error de red en signup de Auth'),
    };
  }
}

export const supabaseNoPersist = {
  auth: {
    signUp: signUpNoPersist,
  },
};
