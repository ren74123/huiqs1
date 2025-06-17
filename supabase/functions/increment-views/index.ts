import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { package_id } = await req.json();
    if (!package_id) throw new Error("Missing package_id");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 查询当前 views
    const { data: pkg, error: fetchError } = await supabaseClient
      .from("travel_packages")
      .select("views")
      .eq("id", package_id)
      .single();

    if (fetchError) throw fetchError;

    const currentViews = pkg?.views || 0;

    // 更新 views + 1
    const { error: updateError } = await supabaseClient
      .from("travel_packages")
      .update({ views: currentViews + 1 })
      .eq("id", package_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400
    });
  }
});
