// api/op-login.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const OPERADOR_DOMAIN = process.env.OPERADOR_DOMAIN || 'operador.local';
const OPERADOR_PASSWORD = process.env.OPERADOR_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req: any, res: any) {
  // (CORS opcional; pode remover se same-origin)
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!OPERADOR_PASSWORD) {
    return res.status(500).json({ error: 'server_misconfigured_password' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const pin: string = body?.pin;

  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'pin_invalido' });
  }

  const email = `${pin}@${OPERADOR_DOMAIN}`;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: OPERADOR_PASSWORD,
  });

  if (error || !data?.session) {
    // dica de log (aparece nos Function Logs da Vercel)
    console.warn('[op-login] auth failed', { email, reason: error?.message || 'no_session' });
    return res.status(401).json({ error: 'credenciais_invalidas' });
  }

  // Retorno plano (casa com o AuthProvider)
  return res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: { id: data.user.id, email: data.user.email },
  });
}
