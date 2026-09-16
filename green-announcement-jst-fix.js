(() => {
  "use strict";

  const VERSION = "GREEN-ANNOUNCEMENT-JST-FIX-R1.0-20260916";
  if (!/\/owner\.html$/.test(location.pathname)) return;
  if (!window.Green || typeof window.Green.api !== "function") return;
  if (window.Green.api.__greenAnnouncementJstFix === VERSION) return;

  const Green = window.Green;
  const originalApi = Green.api.bind(Green);
  let announcementMap = new Map();

  function isAnnouncementPath(path) {
    return /^\/api\/admin\/announcements(?:\/[^/?]+)?(?:\?.*)?$/.test(String(path || ""));
  }

  function withTokyoOffset(value) {
    if (value === null || value === undefined || value === "") return value || null;
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (!text) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return text;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text)) return value;
    return `${text.length === 16 ? `${text}:00` : text}+09:00`;
  }

  function tokyoParts(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return map;
  }

  function toTokyoInput(value) {
    const p = tokyoParts(value);
    return p ? `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` : "";
  }

  function toTokyoDisplay(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  }

  function patchAnnouncementJson(options) {
    if (!options || typeof options !== "object" || !options.json || typeof options.json !== "object") return options;
    const json = { ...options.json };
    if (Object.prototype.hasOwnProperty.call(json, "publishFrom")) json.publishFrom = withTokyoOffset(json.publishFrom);
    if (Object.prototype.hasOwnProperty.call(json, "publishUntil")) json.publishUntil = withTokyoOffset(json.publishUntil);
    return { ...options, json };
  }

  function captureAnnouncements(payload) {
    const items = payload?.data?.items;
    if (!Array.isArray(items)) return;
    announcementMap = new Map(items.map((row) => [String(row.id), row]));
    setTimeout(syncAnnouncementPeriods, 0);
  }

  async function patchedApi(path, options = {}) {
    const method = String(options?.method || "GET").toUpperCase();
    let nextOptions = options;
    if (isAnnouncementPath(path) && ["POST", "PATCH", "PUT"].includes(method)) {
      nextOptions = patchAnnouncementJson(options);
    }
    const payload = await originalApi(path, nextOptions);
    if (String(path).split("?")[0] === "/api/admin/announcements" && method === "GET") {
      captureAnnouncements(payload);
    }
    return payload;
  }

  patchedApi.__greenAnnouncementJstFix = VERSION;
  Green.api = patchedApi;

  function syncAnnouncementEditor(id = "") {
    const editor = document.querySelector("#announcement-editor");
    if (!editor || editor.hidden) return;
    const itemId = String(id || document.querySelector("#announcement-id")?.value || "");
    if (!itemId) return;
    const item = announcementMap.get(itemId);
    if (!item) return;

    const key = `${itemId}|${item.publish_from || ""}|${item.publish_until || ""}`;
    if (editor.dataset.greenAnnouncementJstSynced === key) return;

    const from = document.querySelector("#announcement-from");
    const until = document.querySelector("#announcement-until");
    if (from) from.value = toTokyoInput(item.publish_from);
    if (until) until.value = toTokyoInput(item.publish_until);
    editor.dataset.greenAnnouncementJstSynced = key;
  }

  function syncAnnouncementPeriods() {
    document.querySelectorAll("[data-edit-announcement]").forEach((button) => {
      const id = String(button.dataset.editAnnouncement || "");
      const item = announcementMap.get(id);
      const article = button.closest(".green12-list-item");
      const period = article?.querySelector("small");
      if (!item || !period) return;
      const from = item.publish_from ? toTokyoDisplay(item.publish_from) : "すぐ公開";
      const until = item.publish_until ? toTokyoDisplay(item.publish_until) : "終了日なし";
      period.textContent = `${from}〜${until}`;
    });
  }

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest?.("[data-edit-announcement]");
    if (editButton) {
      const id = editButton.dataset.editAnnouncement || "";
      setTimeout(() => syncAnnouncementEditor(id), 0);
      return;
    }

    const newButton = event.target.closest?.("#announcement-new");
    if (newButton) {
      const editor = document.querySelector("#announcement-editor");
      if (editor) delete editor.dataset.greenAnnouncementJstSynced;
    }
  }, true);

  const editor = document.querySelector("#announcement-editor");
  if (editor) {
    const observer = new MutationObserver(() => {
      if (editor.hidden) {
        delete editor.dataset.greenAnnouncementJstSynced;
        return;
      }
      setTimeout(() => syncAnnouncementEditor(), 0);
    });
    observer.observe(editor, { attributes: true, attributeFilter: ["hidden"] });
  }

  const list = document.querySelector("#announcement-list");
  if (list) {
    const observer = new MutationObserver(() => setTimeout(syncAnnouncementPeriods, 0));
    observer.observe(list, { childList: true, subtree: true });
  }

  console.info(`[DPRO GREEN] ${VERSION} active`);
})();
