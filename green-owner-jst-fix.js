(() => {
  "use strict";

  const VERSION = "GREEN-OWNER-JST-DATETIME-FIX-R1.1-20260915";
  if (!/\/owner\.html$/.test(location.pathname)) return;
  if (typeof window.fetch !== "function") return;

  document.documentElement.dataset.greenOwnerJstDatetimeFix = VERSION;

  const originalFetch = window.fetch.bind(window);
  let lastReplacementScheduledAt = "";

  function withTokyoOffset(value) {
    if (!value || typeof value !== "string") return value;
    const text = value.trim();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text)) return value;
    return `${text.length === 16 ? `${text}:00` : text}+09:00`;
  }

  function tokyoInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      })
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value])
    );

    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function replacementPath(urlLike) {
    try {
      return new URL(String(urlLike), location.href).pathname;
    } catch {
      return "";
    }
  }

  function isReplacementApiPath(path) {
    return /^\/api\/admin\/replacements(?:\/|$)/.test(path);
  }

  function isReplacementDetailPath(path) {
    return /^\/api\/admin\/replacements\/[0-9a-f-]{36}$/i.test(path);
  }

  function patchJsonBody(body) {
    if (typeof body !== "string" || !body.trim().startsWith("{")) return body;

    let json;
    try {
      json = JSON.parse(body);
    } catch {
      return body;
    }

    let changed = false;

    if (typeof json.scheduledAt === "string") {
      const next = withTokyoOffset(json.scheduledAt);
      if (next !== json.scheduledAt) {
        json.scheduledAt = next;
        changed = true;
      }
    }

    if (typeof json.scheduled_at === "string") {
      const next = withTokyoOffset(json.scheduled_at);
      if (next !== json.scheduled_at) {
        json.scheduled_at = next;
        changed = true;
      }
    }

    return changed ? JSON.stringify(json) : body;
  }

  function applyReplacementInputFix() {
    const dialog = document.querySelector("#owner-dialog");
    if (!dialog || !dialog.open || !lastReplacementScheduledAt) return;

    const form =
      dialog.querySelector("#replacement-edit-form") ||
      dialog.querySelector("#replacement-approve-form");

    if (!form) return;

    const input = form.querySelector('input[name="scheduledAt"]');
    if (!input) return;

    const corrected = tokyoInputValue(lastReplacementScheduledAt);
    if (!corrected) return;

    input.value = corrected;
    input.step = "900";
    input.dataset.greenJstFixed = VERSION;
    input.title = "日本時間（Asia/Tokyo）で入力します。";
  }

  window.fetch = async function greenJstFetch(input, init = undefined) {
    const url = typeof input === "string" ? input : input?.url;
    const path = replacementPath(url);
    let nextInit = init;

    if (isReplacementApiPath(path) && init && typeof init === "object") {
      const patchedBody = patchJsonBody(init.body);
      if (patchedBody !== init.body) {
        nextInit = { ...init, body: patchedBody };
      }
    }

    const response = await originalFetch(input, nextInit);

    const method = String(nextInit?.method || "GET").toUpperCase();
    if (method === "GET" && isReplacementDetailPath(path)) {
      response.clone().json().then((payload) => {
        lastReplacementScheduledAt = payload?.data?.request?.scheduled_at || "";
        queueMicrotask(applyReplacementInputFix);
        setTimeout(applyReplacementInputFix, 0);
        setTimeout(applyReplacementInputFix, 50);
        setTimeout(applyReplacementInputFix, 150);
      }).catch(() => {});
    }

    return response;
  };

  const dialog = document.querySelector("#owner-dialog");
  if (dialog) {
    const observer = new MutationObserver(() => applyReplacementInputFix());
    observer.observe(dialog, { childList: true, subtree: true });
  }

  console.info(`[DPRO GREEN] ${VERSION} active`);
})();
