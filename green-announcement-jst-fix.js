(() => {
  "use strict";

  const VERSION = "GREEN-ANNOUNCEMENT-JST-FIX-R1.2-20260916";
  if (!/\/owner\.html$/.test(location.pathname)) return;

  const TZ_RE = /(?:Z|[+-]\d{2}:\d{2})$/;
  let originalApi = null;
  let apiWrapped = false;
  let installAttempts = 0;

  function withTokyoOffset(value) {
    if (value === null || value === undefined || value === "") return value || null;
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (!text) return null;
    if (TZ_RE.test(text)) return text;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(text)) return value;
    return `${text.length === 16 ? `${text}:00` : text}+09:00`;
  }

  function toTokyoInputSmart(value) {
    if (!value) return "";
    const text = String(value).trim();
    if (!TZ_RE.test(text)) return text.slice(0, 16);

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text.slice(0, 16);
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
    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
  }

  function toTokyoDisplaySmart(value) {
    if (!value) return "";
    const text = String(value).trim();
    if (!TZ_RE.test(text)) {
      const local = text.slice(0, 19).replace("T", " ");
      return local.replace(/^(\d{4})-(\d{2})-(\d{2}) /, "$1/$2/$3 ");
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(date);
  }

  function isAnnouncementPath(path) {
    return /^\/api\/admin\/announcements(?:\/[^/?]+)?(?:\?.*)?$/.test(String(path || ""));
  }

  function tryInstallApiWrapper() {
    if (apiWrapped) return true;
    const Green = window.Green;
    if (!Green || typeof Green.api !== "function") {
      installAttempts += 1;
      if (installAttempts < 200) setTimeout(tryInstallApiWrapper, 25);
      return false;
    }

    originalApi = Green.api.bind(Green);

    async function patchedApi(path, options = {}) {
      const method = String(options?.method || "GET").toUpperCase();
      let nextOptions = options;

      if (isAnnouncementPath(path)
          && ["POST", "PATCH", "PUT"].includes(method)
          && options?.json
          && typeof options.json === "object") {
        const json = { ...options.json };
        if (Object.prototype.hasOwnProperty.call(json, "publishFrom")) {
          json.publishFrom = withTokyoOffset(json.publishFrom);
        }
        if (Object.prototype.hasOwnProperty.call(json, "publishUntil")) {
          json.publishUntil = withTokyoOffset(json.publishUntil);
        }
        nextOptions = { ...options, json };
      }

      return originalApi(path, nextOptions);
    }

    patchedApi.__greenAnnouncementJstFix = VERSION;
    Green.api = patchedApi;
    apiWrapped = true;
    return true;
  }

  async function fetchAnnouncement(id) {
    tryInstallApiWrapper();
    const Green = window.Green;
    if (!Green || typeof Green.api !== "function") return null;
    const response = await Green.api("/api/admin/announcements");
    const items = response?.data?.items;
    if (!Array.isArray(items)) return null;
    return items.find((item) => String(item.id) === String(id)) || null;
  }

  function applyEditorItem(item) {
    if (!item) return;
    const id = document.querySelector("#announcement-id");
    if (!id || String(id.value) !== String(item.id)) return;

    const editor = document.querySelector("#announcement-editor");
    if (!editor || editor.hidden) return;

    const from = document.querySelector("#announcement-from");
    const until = document.querySelector("#announcement-until");
    if (from) from.value = toTokyoInputSmart(item.publish_from);
    if (until) until.value = toTokyoInputSmart(item.publish_until);
  }

  function applyPeriod(button, item) {
    const article = button?.closest(".green12-list-item");
    const period = article?.querySelector("small");
    if (!period || !item) return;
    const from = item.publish_from ? toTokyoDisplaySmart(item.publish_from) : "すぐ公開";
    const until = item.publish_until ? toTokyoDisplaySmart(item.publish_until) : "終了日なし";
    period.textContent = `${from}〜${until}`;
  }

  document.addEventListener("click", (event) => {
    const editButton = event.target.closest?.("[data-edit-announcement]");
    if (!editButton) return;

    const itemId = String(editButton.dataset.editAnnouncement || "");
    if (!itemId) return;

    // Existing green12 click handler runs on the button before this bubble handler.
    // Fetch the canonical API row afterwards, then overwrite only the datetime inputs.
    setTimeout(async () => {
      const item = await fetchAnnouncement(itemId).catch(() => null);
      if (!item) return;
      applyEditorItem(item);
      applyPeriod(editButton, item);
    }, 0);
  }, false);

  // Ensure the API wrapper installs even when this script loads before green-common.js.
  tryInstallApiWrapper();

  console.info(`[DPRO GREEN] ${VERSION} active`);
})();
