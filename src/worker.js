/* =============================================================
   RABAVA STUDIO — Order Bot  ·  CLOUDFLARE WORKER ENTRY
   --------------------------------------------------------------
   Receives Telegram webhooks, runs the pure router (bot.js),
   persists each user's session in KV, and performs the actions
   against the Telegram Bot API. You normally never edit this —
   all the content lives in bot.js.

   Bindings required (see wrangler.toml + README):
     env.BOT_TOKEN        secret  — from @BotFather
     env.OWNER_CHAT_ID    secret  — your numeric Telegram chat id
     env.WEBHOOK_SECRET   secret  — random string; verifies callers
     env.SESSIONS         KV      — per-user session store
============================================================= */

import { route } from "./bot.js";

const API = (token, method) => `https://api.telegram.org/bot${token}/${method}`;
const SESSION_TTL = 60 * 60 * 24; // 24h — abandoned carts expire

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // health check / friendly GET
    if (request.method === "GET") {
      return new Response("RABAVA STUDIO order bot — alive ✓", { status: 200 });
    }
    if (request.method !== "POST" || url.pathname !== "/webhook") {
      return new Response("Not found", { status: 404 });
    }

    // verify the call really came from Telegram (secret token header)
    if (env.WEBHOOK_SECRET) {
      const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (got !== env.WEBHOOK_SECRET) return new Response("Forbidden", { status: 403 });
    }

    let update;
    try { update = await request.json(); }
    catch { return new Response("Bad request", { status: 400 }); }

    try {
      await handle(update, env);
    } catch (err) {
      console.error("handler error", err);
    }
    // Always 200 fast so Telegram doesn't retry-storm us.
    return new Response("ok", { status: 200 });
  },
};

/* ---- identify the user (session key) ------------------------ */
function chatIdOf(update) {
  if (update.callback_query) return update.callback_query.from?.id;
  if (update.message) return update.message.chat?.id;
  return null;
}

async function handle(update, env) {
  const uid = chatIdOf(update);
  if (!uid) return;

  // load session
  let session = null;
  const raw = await env.SESSIONS.get(`sess:${uid}`);
  if (raw) { try { session = JSON.parse(raw); } catch { session = null; } }

  // run the brain
  const ctx = { ref: makeRef(), now: nowUTC() };
  const { session: next, actions } = route(update, session, ctx);

  // persist (or delete) session
  if (next === null) {
    await env.SESSIONS.delete(`sess:${uid}`);
  } else if (next) {
    await env.SESSIONS.put(`sess:${uid}`, JSON.stringify(next), { expirationTtl: SESSION_TTL });
  }

  // perform actions in order
  for (const a of actions) {
    await perform(a, env);
  }
}

/* ---- perform one action against Telegram -------------------- */
async function perform(a, env) {
  const t = env.BOT_TOKEN;
  if (a.type === "answerCallback") {
    return tg(t, "answerCallbackQuery", { callback_query_id: a.id, text: a.text || undefined });
  }
  if (a.type === "send") {
    return tg(t, "sendMessage", {
      chat_id: a.chat_id, text: a.text, parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: a.keyboard || undefined,
    });
  }
  if (a.type === "edit") {
    const r = await tg(t, "editMessageText", {
      chat_id: a.chat_id, message_id: a.message_id, text: a.text, parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: a.keyboard || undefined,
    });
    // if the message is identical/too old to edit, fall back to a fresh send
    if (r && r.ok === false) {
      return tg(t, "sendMessage", {
        chat_id: a.chat_id, text: a.text, parse_mode: "HTML",
        disable_web_page_preview: true, reply_markup: a.keyboard || undefined,
      });
    }
    return r;
  }
  if (a.type === "sendOwner") {
    return tg(t, "sendMessage", {
      chat_id: env.OWNER_CHAT_ID, text: a.text, parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
}

async function tg(token, method, body) {
  try {
    const res = await fetch(API(token, method), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json().catch(() => ({ ok: res.ok }));
  } catch (e) {
    console.error("telegram call failed", method, e);
    return { ok: false };
  }
}

/* ---- tiny utils --------------------------------------------- */
function makeRef() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}
function nowUTC() {
  return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
}
