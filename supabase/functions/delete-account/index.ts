// supabase/functions/delete-account/index.ts
//
// Cancella l'account dell'utente che chiama: prima i dati applicativi
// (via la RPC delete_my_account(), che gira con i permessi dell'utente
// stesso), poi la riga in auth.users, che richiede la service_role key —
// motivo per cui questo passaggio non può stare nel browser.
//
// Deploy: `supabase functions deploy delete-account` (richiede la Supabase
// CLI collegata al progetto). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sono
// già disponibili come variabili d'ambiente per ogni Edge Function del
// progetto: non serve impostarle a mano.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  // Client "come l'utente": rispetta la RLS, usato solo per identificarlo
  // e per far girare la RPC con i suoi permessi.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const { error: rpcError } = await userClient.rpc('delete_my_account');
  if (rpcError) {
    return json({ error: rpcError.message }, 500);
  }

  // Solo da qui in poi serve la service_role key, e solo per questa
  // singola operazione: cancellare la riga auth.users dell'utente.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return json({ error: deleteError.message }, 500);
  }

  return json({ success: true }, 200);
});

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
