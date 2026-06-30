# 🎮 RABAVA STUDIO — Telegram Order Bot

One bot **you own** that takes service orders on Telegram and DMs every
order straight to you. Runs on a **Cloudflare Worker** (webhook, not
polling) — so it's free, always-on, and there's **no server to babysit**.
Same ecosystem as your Pages sites.

```
Client taps /start → builds an order from your services → leaves contact
        → you get a formatted order in your Telegram, instantly.
Payment stays manual (USDT / P2P), exactly like the rest of your model.
```

---

## What you edit

| File | What it is |
|------|------------|
| `src/bot.js` | **The only file you normally touch.** Services, prices, bundles, budgets, all the wording. |
| `src/worker.js` | Plumbing (KV + Telegram API). Leave it alone. |
| `wrangler.toml` | Worker name + KV namespace id. |
| `test/bot.test.js` | The order-flow tests (`bun test`). |

Adding a service = copy a block in `SERVICES`. That's it. New buttons,
detail screens and the cart all pick it up automatically.

---

## One-time setup (~10 min)

You need a [Cloudflare account](https://dash.cloudflare.com) and Node installed.

### 1. Create the bot
- In Telegram, message **@BotFather** → `/newbot` → pick a name + username.
- Copy the **token** it gives you (looks like `12345:AAH...`).

### 2. Get YOUR chat id (so orders reach you)
- Message **@userinfobot** in Telegram → it replies with your numeric **Id**.
- That number is your `OWNER_CHAT_ID`.

### 3. Install + log in
```bash
npm install
npx wrangler login
```

### 4. Create the session store (KV)
```bash
npx wrangler kv namespace create SESSIONS
```
Copy the printed `id` into **`wrangler.toml`** (replace `PASTE_YOUR_KV_NAMESPACE_ID`).

### 5. Set your secrets (never put these in files)
```bash
npx wrangler secret put BOT_TOKEN        # paste the BotFather token
npx wrangler secret put OWNER_CHAT_ID    # paste your numeric id
npx wrangler secret put WEBHOOK_SECRET   # paste any random string, e.g. a UUID
```

### 6. Deploy
```bash
npx wrangler deploy
```
Wrangler prints your Worker URL, e.g. `https://kick-rabava-bot.<you>.workers.dev`.

### 7. Point Telegram at the Worker (the step everyone forgets)
Run this once, swapping in your token, Worker URL, and the same
`WEBHOOK_SECRET` you set in step 5:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://kick-rabava-bot.<you>.workers.dev/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```
You should see `{"ok":true,...}`.

### 8. Try it
Open your bot in Telegram → `/start`. Build an order, send it, and watch
it land in your own chat. ✅

---

## Day-to-day

- **Change a price / service / wording** → edit `src/bot.js` → `npx wrangler deploy`. Live in seconds.
- **Test before deploy** → `bun test` (or `npm test`). The whole order flow is covered.
- **See live logs** → `npx wrangler tail`.
- The bot link (`t.me/yourbotname`) goes in your portfolio, your Kick bio,
  your Telegram channel — anywhere you'd put "order here."

## How it stays cheap & safe
- **Free tier**: Workers (100k req/day) + KV are free for this volume.
- Abandoned carts auto-expire after 24h (KV TTL).
- The `WEBHOOK_SECRET` header means only Telegram can trigger your bot.
- Secrets live in Wrangler, never in the repo — same discipline as your
  GitHub Secrets / scoped-token setup.

---

## Order flow (what the client sees)
```
/start
  └─ Service menu  (7 services + 2 bundles + How it works + Cart)
       ├─ tap a service → details + ➕ Add to order
       ├─ tap a bundle  → adds several at once
       └─ 🛒 Cart → ✅ Place order
                       ├─ Step 1/4  name / handle
                       ├─ Step 2/4  best contact
                       ├─ Step 3/4  budget (buttons)
                       ├─ Step 4/4  notes (or /skip)
                       └─ Review → ✅ Send  →  order DM'd to YOU
```
Commands: `/start` (menu), `/cancel` (abort, keeps cart), `/help`, `/skip` (skip notes).
