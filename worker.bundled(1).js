/* =============================================================
   RABAVA STUDIO — Order Bot  ·  SINGLE-FILE BUILD
   Paste this whole file into the Cloudflare Worker editor.
   To change services/prices/text, edit the SERVICES block below.
   (Generated from src/bot.js + src/worker.js — edit those if you
    prefer the multi-file repo, then re-bundle.)
============================================================= */

/* =============================================================
   RABAVA STUDIO — Order Bot  ·  PURE CORE (no Cloudflare imports)
   --------------------------------------------------------------
   Everything here is testable without a network or a token.
   `route(update, session, ctx)` takes one Telegram update + the
   user's current session and returns { session, actions }.
   The worker (worker.js) persists the session to KV and performs
   the actions against the Telegram API. Edit SERVICES / BUNDLES /
   text below — this is your single source of truth.
============================================================= */

/* ---- IDENTITY ------------------------------------------------ */
const BRAND = "RABAVA STUDIO";
const REPLY_WITHIN = "24h";
const PAYMENT_NOTE = "USDT / crypto P2P";

/* ---- SERVICES (mirror of the portfolio config) -------------- */
const SERVICES = [
  {
    id: "hub", icon: "🎮", title: "Creator Hub", price: "$80–300",
    featured: true, delivery: "2–4 days",
    tagline: "The flagship — replaces Linktree",
    desc: "A branded mini-site that makes you look like a serious creator: donations, crypto, live status, goals and every link in one fast, mobile-perfect page.",
    includes: ["Custom homepage", "Donations + crypto / QR", "Live status + goals", "All socials + Discord", "Fully branded", "Mobile + fast"],
  },
  {
    id: "kick", icon: "⚡", title: "Kick Profile Makeover", price: "from $40",
    delivery: "1–2 days",
    tagline: "Turn an empty Kick page into a real channel",
    desc: "Banner, avatar, bio, about, panels and an offline screen — all on-brand so your channel looks established.",
    includes: ["Banner + avatar", "Bio + about", "Profile panels", "Offline screen", "Branding pass"],
  },
  {
    id: "brand", icon: "🎨", title: "Brand & Identity Kit", price: "from $60",
    delivery: "2–3 days",
    tagline: "Not just graphics — an identity",
    desc: "Logo, colors, fonts, your creator voice and ready-to-paste bios for every platform.",
    includes: ["Logo", "Colors + fonts", "Creator voice", "Social bios", "Usage guide"],
  },
  {
    id: "overlays", icon: "📺", title: "Overlays & Stream Assets", price: "from $50",
    delivery: "2–3 days",
    tagline: "The assets that make a channel feel finished",
    desc: "A clean, minimal overlay set plus the screens, alerts, panels, emotes and badges a polished channel needs.",
    includes: ["Starting / BRB / Offline / Ending", "Webcam frame + alerts", "Panels + chat box", "Emotes + sub badges"],
  },
  {
    id: "content", icon: "🤖", title: "Content & AI Automation", price: "from $70",
    delivery: "setup in 3–5 days",
    tagline: "Turn one stream into a content machine",
    desc: "VOD → Shorts and TikToks with hooks and captions, AI titles and descriptions, and auto social posting.",
    includes: ["VOD → Shorts / TikToks", "Auto captions + hooks", "AI titles + descriptions", "Social auto-posting", "Notify automation"],
  },
  {
    id: "community", icon: "💬", title: "Community & Links", price: "from $20",
    delivery: "1–2 days",
    tagline: "Where your audience gathers",
    desc: "A set-up Discord server and a Telegram channel that pings on live, plus tracked links you control.",
    includes: ["Discord server setup", "Telegram + live alerts", "Tracked short links", "Monthly clicks report"],
  },
  {
    id: "website", icon: "🌐", title: "Full Site & Sponsor Kit", price: "from $150",
    delivery: "4–7 days",
    tagline: "When one page isn't enough",
    desc: "A multi-section site with videos, sponsors, merch and a press/media kit that lands real deals.",
    includes: ["Multi-section site", "Videos + live status", "Sponsors + merch", "Press / media kit", "Audience stats"],
  },
];

/* ---- BUNDLES (quick multi-add — your Starter / Full Kit) ----- */
const BUNDLES = [
  {
    id: "starter", icon: "🚀", title: "Starter Pack",
    services: ["hub", "community"],
    note: "Creator Hub + Discord/Telegram + tracked links. Everything to launch.",
  },
  {
    id: "pro", icon: "👑", title: "Full Creator Kit",
    services: ["hub", "kick", "brand", "overlays", "community"],
    note: "The works — hub, Kick profile, brand, overlays and community.",
  },
];

/* ---- BUDGET BANDS (mirror portfolio) ------------------------- */
const BUDGETS = ["Under $50", "$50 – $150", "$150 – $400", "$400+", "Not sure yet"];

/* =============================================================
   HELPERS
============================================================= */
const svc = (id) => SERVICES.find((s) => s.id === id);
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function parsePrice(str) {
  const nums = (str.match(/\d+/g) || []).map(Number);
  if (nums.length === 0) return { min: 0, max: 0, open: true };
  if (nums.length === 1) return { min: nums[0], max: nums[0], open: true }; // "from $40"
  return { min: nums[0], max: nums[1], open: false };                       // "$80–300"
}

function estimate(cart) {
  if (!cart.length) return "$0";
  let min = 0, max = 0, open = false;
  for (const id of cart) {
    const s = svc(id);
    if (!s) continue;
    const p = parsePrice(s.price);
    min += p.min; max += p.max; if (p.open) open = true;
  }
  return open ? `$${min}+` : `$${min}–${max}`;
}

function freshSession(from = {}) {
  return { cart: [], step: null, fields: {}, uname: from.username || null, name: from.first_name || null };
}

/* keyboards are arrays of rows; each button = { text, data } */
const kb = (rows) => ({
  inline_keyboard: rows.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))),
});

function cartButton(session) {
  const n = session.cart.length;
  return { text: n ? `🛒 Cart (${n})` : "🛒 Cart", data: "cart" };
}

/* =============================================================
   SCREEN RENDERERS  → { text, keyboard }
============================================================= */
function screenMenu(session) {
  const text =
    `🎮 <b>${BRAND}</b> — Order Desk\n\n` +
    `I build the kit that turns viewers into income:\n` +
    `creator hubs, Kick profiles, brand kits, overlays,\n` +
    `automation &amp; community setup.\n\n` +
    `Tap a service to see exactly what's inside 👇`;

  const rows = [];
  rows.push([{ text: "🎮 Creator Hub  ★", data: "svc:hub" }]); // featured, full width
  rows.push([{ text: "⚡ Kick Profile", data: "svc:kick" }, { text: "🎨 Brand Kit", data: "svc:brand" }]);
  rows.push([{ text: "📺 Overlays", data: "svc:overlays" }, { text: "🤖 Automation", data: "svc:content" }]);
  rows.push([{ text: "💬 Community", data: "svc:community" }, { text: "🌐 Full Site", data: "svc:website" }]);
  rows.push([{ text: "🚀 Starter Pack", data: "bnd:starter" }, { text: "👑 Full Kit", data: "bnd:pro" }]);
  rows.push([{ text: "❓ How it works", data: "how" }, cartButton(session)]);
  return { text, keyboard: kb(rows) };
}

function screenService(session, id) {
  const s = svc(id);
  if (!s) return screenMenu(session);
  const inCart = session.cart.includes(id);
  const text =
    `${s.icon} <b>${esc(s.title)}</b>\n` +
    `<i>${esc(s.tagline)}</i>\n\n` +
    `💵 <b>${esc(s.price)}</b>   ·   ⏱ ${esc(s.delivery)}\n\n` +
    `${esc(s.desc)}\n\n` +
    `<b>What's included</b>\n` +
    s.includes.map((i) => `✓ ${esc(i)}`).join("\n");

  const toggle = inCart
    ? { text: "✓ In your order — tap to remove", data: `del:${id}` }
    : { text: "➕ Add to order", data: `add:${id}` };
  return {
    text,
    keyboard: kb([
      [toggle],
      [cartButton(session), { text: "← Services", data: "menu" }],
    ]),
  };
}

function screenBundle(session, id) {
  const b = BUNDLES.find((x) => x.id === id);
  if (!b) return screenMenu(session);
  const items = b.services.map(svc).filter(Boolean);
  const est = estimate(b.services);
  const text =
    `${b.icon} <b>${esc(b.title)}</b>\n` +
    `<i>${esc(b.note)}</i>\n\n` +
    `<b>Includes</b>\n` +
    items.map((s) => `• ${s.icon} ${esc(s.title)} — ${esc(s.price)}`).join("\n") +
    `\n\n<i>Bundle estimate: ${est}</i>`;
  return {
    text,
    keyboard: kb([
      [{ text: `➕ Add ${b.title} to order`, data: `addb:${id}` }],
      [cartButton(session), { text: "← Services", data: "menu" }],
    ]),
  };
}

function screenCart(session) {
  if (!session.cart.length) {
    return {
      text: `🛒 <b>Your order is empty.</b>\n\nTap a service to add it.`,
      keyboard: kb([[{ text: "← See services", data: "menu" }]]),
    };
  }
  const lines = session.cart.map((id) => {
    const s = svc(id);
    return `• ${s.icon} ${esc(s.title)} — ${esc(s.price)}`;
  });
  const text =
    `🛒 <b>Your order</b>\n\n` +
    lines.join("\n") +
    `\n\n<i>Estimated total: ${estimate(session.cart)}</i>\n` +
    `<i>Final quote confirmed before any payment.</i>`;
  return {
    text,
    keyboard: kb([
      [{ text: "✅ Place this order", data: "checkout" }],
      [{ text: "➕ Add more", data: "menu" }, { text: "🗑 Clear", data: "clear" }],
    ]),
  };
}

function screenHow() {
  const text =
    `❓ <b>How it works</b>\n\n` +
    `1️⃣  Tap the services you want — build your order.\n` +
    `2️⃣  Leave your handle + best contact.\n` +
    `3️⃣  I reply within ${REPLY_WITHIN} with a final quote.\n` +
    `4️⃣  You pay (${PAYMENT_NOTE}), I build it in ~48h.\n` +
    `5️⃣  It goes live on your own link. You own it all.`;
  return { text, keyboard: kb([[{ text: "← Back", data: "menu" }]]) };
}

/* checkout summary before sending */
function screenSummary(session) {
  const f = session.fields;
  const lines = session.cart.map((id) => {
    const s = svc(id);
    return `• ${s.icon} ${esc(s.title)} — ${esc(s.price)}`;
  });
  const text =
    `📋 <b>Review your request</b>\n\n` +
    `<b>Services</b> (${session.cart.length}) — est. ${estimate(session.cart)}\n` +
    lines.join("\n") +
    `\n\n👤 <b>Name:</b> ${esc(f.name || "—")}\n` +
    `📞 <b>Contact:</b> ${esc(f.contact || "—")}\n` +
    `💰 <b>Budget:</b> ${esc(f.budget || "—")}\n` +
    `📝 <b>Notes:</b> ${esc(f.notes || "—")}\n\n` +
    `Send it over?`;
  return {
    text,
    keyboard: kb([
      [{ text: "✅ Send order", data: "confirm" }],
      [{ text: "✏️ Start over", data: "checkout" }, { text: "✕ Cancel", data: "cart" }],
    ]),
  };
}

/* owner + client final messages */
function buildOwnerMessage(session, from, ctx) {
  const f = session.fields;
  const handle = from.username ? `@${from.username}` : "(no username)";
  const lines = session.cart.map((id) => {
    const s = svc(id);
    return `   • ${s.icon} ${esc(s.title)} — ${esc(s.price)}`;
  });
  return (
    `🔔 <b>NEW ORDER #${ctx.ref}</b>\n` +
    `━━━━━━━━━━━━━━━\n` +
    `🛒 <b>Services (${session.cart.length})</b> — est. ${estimate(session.cart)}\n` +
    lines.join("\n") +
    `\n\n👤 <b>${esc(f.name || "—")}</b>  ${esc(handle)}\n` +
    `📞 ${esc(f.contact || "—")}\n` +
    `💰 ${esc(f.budget || "—")}\n` +
    `📝 ${esc(f.notes || "—")}\n\n` +
    `🕐 ${ctx.now}\n` +
    `↩️ Reply to ${esc(handle)} to close it.`
  );
}

function buildClientConfirm(session, ctx) {
  const lines = session.cart.map((id) => `   • ${svc(id).icon} ${esc(svc(id).title)}`);
  return (
    `✅ <b>Order received — #${ctx.ref}</b>\n\n` +
    `You asked for:\n` +
    lines.join("\n") +
    `\n\nI'll reach you within <b>${REPLY_WITHIN}</b> with a final quote.\n` +
    `Payment is ${PAYMENT_NOTE} once we lock the details.\n\n` +
    `Thanks for choosing ${BRAND} 🎮\n` +
    `Need to change something? Just tap /start.`
  );
}

/* =============================================================
   ROUTER  — the brain. Pure: (update, session, ctx) → {session, actions}
   ctx = { ref, now }  (only used at confirm; safe to omit elsewhere)
============================================================= */
function route(update, session, ctx = {}) {
  const actions = [];

  /* ---------- CALLBACK QUERIES (button taps) ---------- */
  if (update.callback_query) {
    const cq = update.callback_query;
    const from = cq.from || {};
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    const data = cq.data || "";
    let s = session || freshSession(from);
    let toast = null;

    const editTo = (screen) =>
      actions.push({ type: "edit", chat_id: chatId, message_id: messageId, text: screen.text, keyboard: screen.keyboard });
    const sendNew = (text, keyboard) =>
      actions.push({ type: "send", chat_id: chatId, text, keyboard });

    if (data === "menu") { s.step = null; editTo(screenMenu(s)); }
    else if (data === "how") { editTo(screenHow()); }
    else if (data === "cart") { s.step = null; editTo(screenCart(s)); }
    else if (data === "clear") { s.cart = []; toast = "Order cleared"; editTo(screenCart(s)); }
    else if (data.startsWith("svc:")) { editTo(screenService(s, data.slice(4))); }
    else if (data.startsWith("bnd:")) { editTo(screenBundle(s, data.slice(4))); }
    else if (data.startsWith("add:")) {
      const id = data.slice(4);
      if (!s.cart.includes(id)) s.cart.push(id);
      toast = "Added ✓";
      editTo(screenService(s, id));
    }
    else if (data.startsWith("del:")) {
      const id = data.slice(4);
      s.cart = s.cart.filter((x) => x !== id);
      toast = "Removed";
      editTo(screenService(s, id));
    }
    else if (data.startsWith("addb:")) {
      const b = BUNDLES.find((x) => x.id === data.slice(5));
      if (b) { for (const id of b.services) if (!s.cart.includes(id)) s.cart.push(id); toast = `${b.title} added ✓`; }
      editTo(screenCart(s));
    }
    else if (data === "checkout") {
      if (!s.cart.length) { toast = "Add a service first"; editTo(screenCart(s)); }
      else {
        s.step = "name"; s.fields = {};
        sendNew(`📝 <b>Step 1 of 4</b>\nWhat's your name or streamer handle?`);
      }
    }
    else if (data.startsWith("bud:")) {
      const i = Number(data.slice(4));
      s.fields.budget = BUDGETS[i] || "Not sure yet";
      s.step = "notes";
      sendNew(`📝 <b>Step 4 of 4</b>\nAnything else? Platform, niche, colors, deadline…\n\n<i>Or tap</i> /skip <i>to finish.</i>`);
    }
    else if (data === "confirm") {
      if (!s.cart.length) { toast = "Your order is empty"; editTo(screenCart(s)); }
      else {
        actions.push({ type: "sendOwner", text: buildOwnerMessage(s, from, ctx) });
        sendNew(buildClientConfirm(s, ctx));
        s = null; // clear session
      }
    }
    else { editTo(screenMenu(s)); }

    actions.unshift({ type: "answerCallback", id: cq.id, text: toast });
    return { session: s, actions };
  }

  /* ---------- PLAIN MESSAGES (commands + typed answers) ---------- */
  if (update.message) {
    const msg = update.message;
    const from = msg.from || {};
    const chatId = msg.chat?.id;
    const text = (msg.text || "").trim();
    let s = session || freshSession(from);

    const send = (t, keyboard) => actions.push({ type: "send", chat_id: chatId, text: t, keyboard });

    // commands always work, even mid-flow
    if (/^\/start\b/.test(text)) {
      s.step = null;
      if (!s.uname && from.username) s.uname = from.username;
      const m = screenMenu(s);
      send(m.text, m.keyboard);
      return { session: s, actions };
    }
    if (/^\/cancel\b/.test(text)) {
      s.step = null;
      send(`Cancelled. Your order is still saved — tap /start to continue.`);
      return { session: s, actions };
    }
    if (/^\/help\b/.test(text)) {
      const h = screenHow();
      send(h.text, h.keyboard);
      return { session: s, actions };
    }

    // typed answers during checkout
    if (s.step === "name") {
      s.fields.name = text.slice(0, 80);
      s.step = "contact";
      const suggest = from.username ? ` (e.g. @${from.username})` : "";
      send(`📝 <b>Step 2 of 4</b>\nBest way to reach you?${suggest}\nTelegram @, Discord, or email.`);
      return { session: s, actions };
    }
    if (s.step === "contact") {
      s.fields.contact = text.slice(0, 120);
      s.step = "budget";
      send(`📝 <b>Step 3 of 4</b>\nWhat's your budget?`, kb([
        [{ text: BUDGETS[0], data: "bud:0" }, { text: BUDGETS[1], data: "bud:1" }],
        [{ text: BUDGETS[2], data: "bud:2" }, { text: BUDGETS[3], data: "bud:3" }],
        [{ text: BUDGETS[4], data: "bud:4" }],
      ]));
      return { session: s, actions };
    }
    if (s.step === "notes") {
      s.fields.notes = /^\/skip\b/.test(text) ? "—" : text.slice(0, 500);
      s.step = null;
      const sum = screenSummary(s);
      send(sum.text, sum.keyboard);
      return { session: s, actions };
    }

    // anything else
    send(`👋 Tap /start to see the menu and build your order.`);
    return { session: s, actions };
  }

  // unknown update type — ignore
  return { session, actions };
}


/* ===== WORKER ENTRY ===== */
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