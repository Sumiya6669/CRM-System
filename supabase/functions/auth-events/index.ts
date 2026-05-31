import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-application-name, x-application-env",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authorization = req.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization || !url || !anonKey || !serviceRoleKey) return json({ error: "Authentication required" }, 401);

    const token = authorization.replace(/^Bearer\s+/i, "");
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const serviceClient = createClient(url, serviceRoleKey);
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const { action } = await req.json();
    if (!["login", "logout"].includes(action)) return json({ error: "Unsupported auth event" }, 400);

    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, organization_id, branch_id, full_name, role, status")
      .eq("id", authData.user.id)
      .single();
    if (!profile || profile.status !== "active") return json({ error: "Active profile is required" }, 403);

    if (action === "login") {
      await serviceClient.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", profile.id);
      await serviceClient.from("users").update({ last_sign_in_at: new Date().toISOString() }).eq("id", profile.id);
    }

    await serviceClient.from("audit_logs").insert({
      organization_id: profile.organization_id,
      branch_id: profile.branch_id,
      user_id: profile.id,
      user_name: profile.full_name,
      role: profile.role,
      operation: action,
      action_type: `auth_${action}`,
      entity_type: "profiles",
      entity_id: profile.id,
      description: `auth: ${action}`,
      created_by: profile.id,
    });
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
