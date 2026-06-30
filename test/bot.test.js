/* End-to-end test of the PURE router — no network, no token.
   Simulates a real user: /start → add services → bundle → checkout
   → type answers → confirm → owner gets the order. Run: node --test */

import { test } from "node:test";
import assert from "node:assert/strict";
import { route, SERVICES, BUDGETS } from "../src/bot.js";

const FROM = { id: 555, username: "rabava", first_name: "Rab" };
const ctx = { ref: "T3ST", now: "2026-06-30 12:00 UTC" };

// helpers to fake Telegram updates
const cb = (data) => ({ callback_query: { id: "cq1", from: FROM, data, message: { chat: { id: 555 }, message_id: 10 } } });
const msg = (text) => ({ message: { from: FROM, chat: { id: 555 }, text } });

// drive a sequence of updates, threading the session through
function run(steps) {
  let session = null;
  const log = [];
  for (const u of steps) {
    const r = route(u, session, ctx);
    session = r.session;
    log.push(r.actions);
  }
  return { session, log };
}

test("/start shows the menu with all services", () => {
  const { actions } = route(msg("/start"), null, ctx);
  const send = actions.find((a) => a.type === "send");
  assert.ok(send, "sends a message");
  assert.match(send.text, /Order Desk/);
  // featured + 6 others + 2 bundles + how + cart rows present
  const flat = send.keyboard.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(flat.includes("svc:hub"));
  assert.ok(flat.includes("svc:website"));
  assert.ok(flat.includes("bnd:starter"));
  assert.ok(flat.includes("cart"));
});

test("tapping a service shows its details + Add button", () => {
  const { actions } = route(cb("svc:hub"), null, ctx);
  assert.equal(actions[0].type, "answerCallback");
  const edit = actions.find((a) => a.type === "edit");
  assert.match(edit.text, /Creator Hub/);
  assert.match(edit.text, /What's included/);
  const flat = edit.keyboard.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(flat.includes("add:hub"));
});

test("adding a service updates the cart and flips the button to remove", () => {
  let session = null;
  ({ session } = route(cb("svc:hub"), session, ctx));
  const r = route(cb("add:hub"), session, ctx);
  session = r.session;
  assert.deepEqual(session.cart, ["hub"]);
  const edit = r.actions.find((a) => a.type === "edit");
  const flat = edit.keyboard.inline_keyboard.flat().map((b) => b.callback_data);
  assert.ok(flat.includes("del:hub"), "now shows a remove button");
  const toast = r.actions.find((a) => a.type === "answerCallback");
  assert.equal(toast.text, "Added ✓");
});

test("a bundle adds several services at once, no duplicates", () => {
  let session = { cart: ["hub"], step: null, fields: {}, uname: "rabava" };
  const r = route(cb("addb:pro"), session, ctx);
  session = r.session;
  // pro = hub,kick,brand,overlays,community — hub already there, not duplicated
  assert.deepEqual(session.cart, ["hub", "kick", "brand", "overlays", "community"]);
});

test("full checkout flow produces an owner order + client confirmation", () => {
  const steps = [
    msg("/start"),
    cb("svc:hub"), cb("add:hub"),
    cb("svc:community"), cb("add:community"),
    cb("cart"),
    cb("checkout"),
    msg("RABAVA"),
    msg("@rabava on telegram"),
    cb("bud:1"),
    msg("kick streamer, green theme, casino niche later"),
    cb("confirm"),
  ];
  const { session, log } = run(steps);

  // session cleared after confirm
  assert.equal(session, null);

  const finalActions = log[log.length - 1];
  const owner = finalActions.find((a) => a.type === "sendOwner");
  const client = finalActions.find((a) => a.type === "send");

  assert.ok(owner, "owner gets the order");
  assert.match(owner.text, /NEW ORDER #T3ST/);
  assert.match(owner.text, /Creator Hub/);
  assert.match(owner.text, /Community/);
  assert.match(owner.text, /RABAVA/);
  assert.match(owner.text, /@rabava on telegram/);
  assert.match(owner.text, /\$50 – \$150/);          // budget band
  assert.match(owner.text, /casino niche later/);     // notes

  assert.ok(client, "client gets a confirmation");
  assert.match(client.text, /Order received — #T3ST/);
});

test("budget step records the right band", () => {
  let session = { cart: ["hub"], step: "budget", fields: { name: "x", contact: "y" }, uname: "z" };
  const r = route(cb("bud:3"), session, ctx);
  assert.equal(r.session.fields.budget, BUDGETS[3]); // "$400+"
  assert.equal(r.session.step, "notes");
});

test("/skip on notes finishes with a summary", () => {
  let session = { cart: ["hub"], step: "notes", fields: { name: "x", contact: "y", budget: "$400+" }, uname: "z" };
  const r = route(msg("/skip"), session, ctx);
  assert.equal(r.session.fields.notes, "—");
  const send = r.actions.find((a) => a.type === "send");
  assert.match(send.text, /Review your request/);
});

test("checkout with empty cart is blocked", () => {
  const r = route(cb("checkout"), { cart: [], step: null, fields: {} }, ctx);
  const toast = r.actions.find((a) => a.type === "answerCallback");
  assert.equal(toast.text, "Add a service first");
});

test("clearing the cart empties it", () => {
  const r = route(cb("clear"), { cart: ["hub", "kick"], step: null, fields: {} }, ctx);
  assert.deepEqual(r.session.cart, []);
});

test("HTML in user input is escaped in the owner message", () => {
  let session = { cart: ["hub"], step: "notes", fields: { name: "<b>x</b>", contact: "a&b", budget: "$400+" }, uname: "z" };
  let r = route(msg("note <script>"), session, ctx);
  session = r.session;
  r = route(cb("confirm"), session, ctx);
  const owner = r.actions.find((a) => a.type === "sendOwner");
  assert.ok(!owner.text.includes("<script>"), "script tag escaped");
  assert.match(owner.text, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(owner.text, /a&amp;b/);
});

test("unknown text nudges the user to /start", () => {
  const r = route(msg("hello?"), null, ctx);
  const send = r.actions.find((a) => a.type === "send");
  assert.match(send.text, /\/start/);
});
