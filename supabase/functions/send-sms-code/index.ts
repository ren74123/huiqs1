import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      throw new Error('Phone number is required');
    }

    const formattedPhone = `+86${phone.replace(/\D/g, '')}`;

    // ✅ Tencent Cloud SMS API configuration
    const tencentConfig = {
      SDKAppID: 'YOUR_SDK_APP_ID', // Replace with your SDKAppID
      SecretId: 'YOUR_SECRET_ID',     // Replace with your SecretId
      SecretKey: 'YOUR_SECRET_KEY',   // Replace with your SecretKey
      TemplateId: 'YOUR_TEMPLATE_ID', // Replace with your TemplateId
      SignName: 'YOUR_SIGN_NAME',     // Replace with your SignName
    };

    // ✅ Generate a random verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ Construct the Tencent Cloud SMS API request
    const endpoint = 'sms.tencentcloudapi.com';
    const version = '2019-07-11';
    const action = 'SendSms';
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = Math.floor(Math.random() * 1000000);
    const params = {
      Action: action,
      Version: version,
      Region: 'AP_Guangzhou', // Replace with your region
      PhoneNumberSet: [formattedPhone],
      TemplateId: tencentConfig.TemplateId,
      SignName: tencentConfig.SignName,
      TemplateParamSet: [verificationCode],
      SmsSdkAppid: tencentConfig.SDKAppID,
      Timestamp: timestamp,
      Nonce: nonce,
    };

    // ✅ Construct the signature string
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    const stringToSign = `GET${endpoint}/?${queryString}`;

    // ✅ Generate the signature
    const crypto = await import('https://deno.land/std/crypto/mod.ts');
    const encoder = new TextEncoder();
    const secretKeyBytes = encoder.encode(tencentConfig.SecretKey);
    const stringToSignBytes = encoder.encode(stringToSign);
    const hmac = await crypto.subtle.sign(
      { name: 'HMAC', hash: 'SHA-256' },
      await crypto.subtle.importKey(
        'raw',
        secretKeyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
      ),
      stringToSignBytes
    );
    const signature = btoa(String.fromCharCode(...new Uint8Array(hmac)));

    // ✅ Construct the final URL
    const apiUrl = `https://${endpoint}/?${queryString}&Signature=${encodeURIComponent(signature)}`;

    // ✅ Send the request to Tencent Cloud SMS API
    const smsResponse = await fetch(apiUrl);
    const smsData = await smsResponse.json();

    if (smsData.Response?.Error) {
      console.error('Tencent Cloud SMS API error:', smsData.Response.Error);
      throw new Error(smsData.Response.Error.Message);
    }

    // ✅ Store the verification code (replace with a secure method in production)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: dbError } = await supabaseClient
      .from('sms_verification_codes') // Create this table
      .upsert({
        phone: formattedPhone,
        code: verificationCode,
        created_at: new Date().toISOString(),
      }, { onConflict: 'phone' });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store verification code');
    }

    return new Response(JSON.stringify({ success: true, message: 'SMS code sent successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending SMS code:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: corsHeaders,
      status: 400,
    });
  }
});
