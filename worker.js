/**
 * Cloudflare Worker for CyberChat
 * - Handles CORS for GitHub Pages / browser clients
 * - Accepts POST JSON: { message: "text" }
 * - Calls HuggingFace and always returns JSON: { reply: "..." }
 */

const HF_API_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
    }

    try {
      const body = await request.json();
      const message = typeof body?.message === "string" ? body.message.trim() : "";

      if (!message) {
        return jsonResponse({ error: "`message` is required." }, 400);
      }

      if (!env.HF_TOKEN) {
        return jsonResponse({ error: "Server misconfigured: missing HF_TOKEN." }, 500);
      }

      const hfResponse = await fetch(HF_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: message,
          parameters: {
            max_new_tokens: 250,
            temperature: 0.7,
            return_full_text: false
          },
          options: {
            wait_for_model: true
          }
        })
      });

      const hfPayload = await safeJson(hfResponse);

      if (!hfResponse.ok) {
        const err = hfPayload?.error || `HuggingFace request failed (${hfResponse.status})`;
        return jsonResponse({ error: err }, hfResponse.status);
      }

      let reply = "";
      if (Array.isArray(hfPayload) && typeof hfPayload[0]?.generated_text === "string") {
        reply = hfPayload[0].generated_text.trim();
      } else if (typeof hfPayload?.generated_text === "string") {
        reply = hfPayload.generated_text.trim();
      }

      if (!reply) {
        return jsonResponse({ error: "Model returned empty output." }, 502);
      }

      // Always return expected contract.
      return jsonResponse({ reply }, 200);
    } catch (error) {
      return jsonResponse({ error: "Unexpected server error." }, 500);
    }
  }
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
