import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js';

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Alipay configuration
const ALIPAY_APP_ID = Deno.env.get('ALIPAY_APP_ID') || '';
const ALIPAY_GATEWAY = Deno.env.get('ALIPAY_GATEWAY') || 'https://openapi.alipay.com/gateway.do';
const ALIPAY_RETURN_URL = Deno.env.get('ALIPAY_RETURN_URL') || 'https://d.huiqs.top/alipay/return';
const ALIPAY_NOTIFY_URL = Deno.env.get('ALIPAY_NOTIFY_URL') || 'https://d.huiqs.top/alipay/notify';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { outTradeNo, amount, subject, sessionId, returnUrl } = await req.json();

    // Validate required parameters
    if (!outTradeNo || !amount || !subject || !sessionId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Create timestamp for Alipay request
    const timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

    // Create Alipay request parameters
    const bizContent = {
      out_trade_no: outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: amount,
      subject: subject,
    };

    const params = {
      app_id: ALIPAY_APP_ID,
      method: 'alipay.trade.page.pay',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: timestamp,
      version: '1.0',
      notify_url: ALIPAY_NOTIFY_URL,
      return_url: returnUrl || ALIPAY_RETURN_URL,
      biz_content: JSON.stringify(bizContent),
    };

    // In a real implementation, you would sign the parameters here
    // For this example, we'll simulate the signed parameters
    const signedParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      signedParams.append(key, value as string);
    }
    // Add a dummy signature
    signedParams.append('sign', 'simulated_signature_for_development');

    // Create the form URL for the client to submit
    const formUrl = `${ALIPAY_GATEWAY}?${signedParams.toString()}`;

    // Return the form URL to the client
    return new Response(
      JSON.stringify({
        success: true,
        formUrl,
        orderId: outTradeNo,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error creating Alipay order:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to create Alipay order',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});