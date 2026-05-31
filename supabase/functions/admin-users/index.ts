import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Authentication required" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const { data: owner, error: ownerError } = await serviceClient
      .from("profiles")
      .select("id, organization_id, full_name, role, status")
      .eq("id", authData.user.id)
      .single();
    if (ownerError || owner?.role !== "owner" || owner?.status !== "active") {
      return json({ error: "Доступ запрещен. Операция доступна только Owner." }, 403);
    }

    const body = await req.json();
    const action = String(body.action || "");
    const payload = body.payload || {};

    const writeAudit = async (actionType: string, entityId: string | null, metadata = {}) => {
      await serviceClient.from("audit_logs").insert({
        organization_id: owner.organization_id,
        user_id: owner.id,
        user_name: owner.full_name,
        role: "owner",
        operation: actionType,
        action_type: actionType,
        entity_type: "profiles",
        entity_id: entityId,
        description: actionType,
        metadata,
        created_by: owner.id,
      });
    };

    if (action === "create_admin") {
      const email = String(payload.email || "").trim().toLowerCase();
      const password = String(payload.password || "");
      const fullName = String(payload.full_name || "").trim();
      const slotNumber = Number(payload.slot_number);
      const branchId = payload.branch_id || null;
      const assignedBranchIds = Array.isArray(payload.assigned_branch_ids)
        ? payload.assigned_branch_ids
        : branchId
          ? [branchId]
          : [];

      if (!email || !email.includes("@") || !fullName || password.length < 12) {
        return json({ error: "Укажите имя, корректный email и временный пароль не короче 12 символов." }, 400);
      }
      if (![1, 2, 3].includes(slotNumber)) return json({ error: "Выберите слот Admin 1, Admin 2 или Admin 3." }, 400);

      const { data: slot } = await serviceClient
        .from("admin_slots")
        .select("id, profile_id")
        .eq("organization_id", owner.organization_id)
        .eq("slot_number", slotNumber)
        .single();
      if (!slot || slot.profile_id) return json({ error: "Выбранный слот администратора уже занят." }, 409);

      const { count } = await serviceClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", owner.organization_id)
        .eq("role", "admin")
        .eq("status", "active");
      if ((count || 0) >= 3) return json({ error: "Доступно не более трех активных администраторов." }, 409);

      const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: "admin", organization_id: owner.organization_id },
      });
      if (createError || !created.user) throw createError || new Error("Auth user was not created");

      const profile = {
        id: created.user.id,
        organization_id: owner.organization_id,
        branch_id: branchId,
        full_name: fullName,
        email,
        role: "admin",
        status: "active",
        invited_by: owner.id,
        admin_slot: slotNumber,
        assigned_branch_ids: assignedBranchIds,
        permissions: payload.permissions || {},
      };

      const { error: profileError } = await serviceClient.from("profiles").insert(profile);
      if (profileError) {
        await serviceClient.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }
      await serviceClient.from("users").insert({
        id: created.user.id,
        profile_id: created.user.id,
        organization_id: owner.organization_id,
        email,
        status: "active",
        assigned_branch_ids: assignedBranchIds,
      });
      await serviceClient.from("admin_slots").update({ profile_id: created.user.id }).eq("id", slot.id);
      await writeAudit("admin_created", created.user.id, { slot_number: slotNumber, email });
      return json({ ok: true, user_id: created.user.id });
    }

    const profileId = String(payload.profile_id || "");
    if (!profileId) return json({ error: "Не выбран администратор." }, 400);
    const { data: admin } = await serviceClient
      .from("profiles")
      .select("id, organization_id, role")
      .eq("id", profileId)
      .eq("organization_id", owner.organization_id)
      .single();
    if (!admin || admin.role !== "admin") return json({ error: "Администратор не найден." }, 404);

    if (action === "set_status") {
      const status = payload.status === "active" ? "active" : "inactive";
      await serviceClient.from("profiles").update({ status }).eq("id", profileId);
      await serviceClient.from("users").update({ status }).eq("id", profileId);
      await writeAudit(status === "active" ? "admin_activated" : "admin_deactivated", profileId);
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const password = String(payload.password || "");
      if (password.length < 12) return json({ error: "Временный пароль должен содержать не менее 12 символов." }, 400);
      const { error } = await serviceClient.auth.admin.updateUserById(profileId, { password });
      if (error) throw error;
      await writeAudit("admin_password_reset", profileId);
      return json({ ok: true });
    }

    if (action === "update_access") {
      const branchId = payload.branch_id || null;
      const assignedBranchIds = Array.isArray(payload.assigned_branch_ids) ? payload.assigned_branch_ids : [];
      const permissions = payload.permissions || {};
      await serviceClient.from("profiles").update({
        branch_id: branchId,
        assigned_branch_ids: assignedBranchIds,
        permissions,
      }).eq("id", profileId);
      await serviceClient.from("users").update({ assigned_branch_ids: assignedBranchIds }).eq("id", profileId);
      await writeAudit("admin_access_updated", profileId, { branch_id: branchId, assigned_branch_ids: assignedBranchIds });
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
