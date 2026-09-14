(() => {
  "use strict";

  const VERSION = "GREEN-OWNER-UX-FIX-R1.0-20260914";
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const dialog = $("#owner-dialog");

  if (!dialog || !window.Green) return;

  document.documentElement.dataset.greenOwnerUxFix = VERSION;

  function esc(value) {
    return String(value ?? "").replace(/[&<>'\"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;",
    }[char]));
  }

  function normalizeDialogShell() {
    const shell = $("#dialog-shell");
    if (!shell || shell.tagName !== "FORM") return;
    const replacement = document.createElement("div");
    for (const attribute of Array.from(shell.attributes)) {
      if (attribute.name === "method") continue;
      replacement.setAttribute(attribute.name, attribute.value);
    }
    while (shell.firstChild) replacement.append(shell.firstChild);
    shell.replaceWith(replacement);
  }

  function ensurePhoneFormHelp() {
    const body = $("#dialog-body");
    const save = $("#save-phone-inquiry");
    if (!body || !save) return;

    const contact = $('[name="contactName"]', body);
    const phone = $('[name="phone"]', body);
    const email = $('[name="email"]', body);
    const inquiry = $('[name="inquiryText"]', body);

    if (inquiry) {
      const label = inquiry.closest("label");
      if (label && !$(".green-owner-required", label)) {
        const badge = document.createElement("span");
        badge.className = "required green-owner-required";
        badge.textContent = "必須";
        label.insertBefore(badge, inquiry);
      }
    }

    [phone, email].forEach((input) => {
      const label = input?.closest("label");
      if (!label || $(".green-owner-either", label)) return;
      const note = document.createElement("span");
      note.className = "green-owner-either";
      note.textContent = "電話・メールのどちらか必須";
      label.insertBefore(note, input);
    });

    if (!$("#green-phone-inquiry-guidance", body)) {
      const guidance = document.createElement("div");
      guidance.id = "green-phone-inquiry-guidance";
      guidance.className = "green-owner-guidance";
      guidance.innerHTML = "<strong>電話相談を受付中</strong><span>担当者名、電話またはメール、相談内容を入力して登録します。登録後は次の操作を画面から選べます。</span>";
      body.prepend(guidance);
    }

    if (!$("#green-phone-inquiry-error", body)) {
      const error = document.createElement("div");
      error.id = "green-phone-inquiry-error";
      error.className = "green-owner-inline-error";
      error.hidden = true;
      error.setAttribute("role", "alert");
      error.setAttribute("aria-live", "assertive");
      const guidance = $("#green-phone-inquiry-guidance", body);
      guidance?.insertAdjacentElement("afterend", error);
    }

    contact?.setAttribute("aria-required", "true");
    inquiry?.setAttribute("aria-required", "true");
  }

  function formValue(name) {
    const input = $(`[name="${name}"]`, $("#dialog-body"));
    return input ? String(input.value ?? "").trim() : "";
  }

  function normalizePhone(value) {
    let phone = String(value || "").trim();
    if (phone.startsWith("+81")) phone = `0${phone.slice(3)}`;
    return phone.replace(/\D/g, "");
  }

  function showInlineError(message, meta = "") {
    const box = $("#green-phone-inquiry-error");
    if (!box) return;
    box.hidden = false;
    box.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = "登録できませんでした";
    const text = document.createElement("span");
    text.textContent = message;
    box.append(strong, text);
    if (meta) {
      const small = document.createElement("small");
      small.textContent = meta;
      box.append(small);
    }
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function clearInlineError() {
    const box = $("#green-phone-inquiry-error");
    if (box) {
      box.hidden = true;
      box.replaceChildren();
    }
  }

  function validatePhoneInquiry() {
    clearInlineError();
    const body = $("#dialog-body");
    const contactName = formValue("contactName");
    const phone = formValue("phone");
    const email = formValue("email");
    const inquiryCategory = formValue("inquiryCategory");
    const preferredContactMethod = formValue("preferredContactMethod");
    const inquiryText = formValue("inquiryText");

    const fail = (message, name) => {
      showInlineError(message);
      const input = $(`[name="${name}"]`, body);
      input?.focus();
      input?.scrollIntoView({ block: "center", behavior: "smooth" });
      return null;
    };

    if (!contactName) return fail("担当者名を入力してください。", "contactName");
    if (!phone && !email) return fail("電話番号またはメールアドレスのどちらかを入力してください。", "phone");
    if (phone) {
      const normalized = normalizePhone(phone);
      if (normalized.length < 10 || normalized.length > 11) return fail("電話番号は10桁または11桁で入力してください。", "phone");
    }
    if (email) {
      const emailInput = $('[name="email"]', body);
      if (emailInput && !emailInput.checkValidity()) return fail("メールアドレスの形式を確認してください。", "email");
    }
    if (!inquiryCategory) return fail("相談区分を選択してください。", "inquiryCategory");
    if (!inquiryText) return fail("相談内容を入力してください。", "inquiryText");

    return {
      companyName: formValue("companyName"),
      contactName,
      phone,
      email,
      inquiryCategory,
      preferredContactMethod: preferredContactMethod || "phone",
      address: formValue("address"),
      inquiryText,
    };
  }

  function isSessionError(error) {
    return ["session_required", "session_expired", "session_facility_invalid", "csrf_failed"].includes(error?.code);
  }

  function isExplicitDemo() {
    return new URLSearchParams(location.search).get("demo") === "1"
      && window.GREEN_CONFIG?.FACILITY_CODE === "dpro_green_rental_demo";
  }

  async function createInquiry(payload) {
    const request = () => window.Green.api("/api/admin/inquiries", {
      method: "POST",
      json: payload,
      idempotencyKey: window.Green.uuid?.() || `green-phone-${Date.now()}`,
    });

    try {
      return { result: await request(), sessionRecovered: false };
    } catch (error) {
      if (!isExplicitDemo() || !isSessionError(error)) throw error;
      const login = await window.Green.api("/api/admin/login", {
        method: "POST",
        json: { facilityCode: window.GREEN_CONFIG.FACILITY_CODE, code: "1234" },
      });
      window.Green.setCsrfToken(login.data?.csrfToken || null);
      const result = await request();
      return { result, sessionRecovered: true };
    }
  }

  function closeDialog() {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }

  function goToView(view, rowSelector = "") {
    closeDialog();
    const button = $(`.owner-nav [data-view="${view}"]`) || $(`.owner-nav > [data-view="${view}"]`);
    button?.click();
    if (!rowSelector) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const target = $(rowSelector);
      attempts += 1;
      if (target) {
        window.clearInterval(timer);
        target.click();
      } else if (attempts >= 30) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  function showInquirySuccess(inquiry, sessionRecovered = false) {
    const body = $("#dialog-body");
    const footer = $("#dialog-footer");
    const title = $("#dialog-title");
    const kicker = $("#dialog-kicker");
    const number = inquiry?.reception_number || "受付番号取得済み";
    const id = inquiry?.id || "";

    if (title) title.textContent = "電話相談を登録しました";
    if (kicker) kicker.textContent = "REGISTERED";
    body.innerHTML = `
      <section class="green-owner-success" role="status">
        <div class="green-owner-success__icon" aria-hidden="true">✓</div>
        <div>
          <strong>登録できました</strong>
          <p>受付番号 <b>${esc(number)}</b></p>
          ${sessionRecovered ? "<small>ログイン期限を自動更新してから安全に登録しました。</small>" : ""}
        </div>
      </section>
      <section class="green-owner-next-action">
        <strong>次にどうしますか？</strong>
        <p>継続して提案・現地確認へ進める相談は「営業案件へ引き継ぐ」を選びます。まだ受付だけなら一覧へ戻れます。</p>
      </section>`;
    footer.innerHTML = `
      <button type="button" class="btn btn--secondary" id="green-phone-success-list">相談一覧へ戻る</button>
      <button type="button" class="btn btn--primary" id="green-phone-success-lead">営業案件へ引き継ぐ</button>`;

    $("#green-phone-success-list")?.addEventListener("click", () => goToView("inquiries"));
    $("#green-phone-success-lead")?.addEventListener("click", async (event) => {
      const button = event.currentTarget;
      window.Green.setBusy(button, true, "引き継ぎ中…");
      try {
        const created = await window.Green.api("/api/admin/leads", {
          method: "POST",
          json: { inquiryId: id, status: inquiry?.status || "new" },
        });
        const lead = created.data?.lead;
        window.Green.toast(`営業案件 ${lead?.lead_number || ""} へ引き継ぎました。`, "success");
        goToView("leads", lead?.id ? `[data-lead="${lead.id}"]` : "");
      } catch (error) {
        window.Green.setBusy(button, false);
        const meta = [error?.code ? `エラーコード: ${error.code}` : "", error?.requestId ? `確認番号: ${error.requestId}` : ""].filter(Boolean).join(" / ");
        body.insertAdjacentHTML("beforeend", `<div class="green-owner-inline-error"><strong>営業案件へ引き継げませんでした</strong><span>${esc(error?.message || "処理に失敗しました。")}</span>${meta ? `<small>${esc(meta)}</small>` : ""}</div>`);
      }
    });
  }

  async function submitPhoneInquiry(button) {
    ensurePhoneFormHelp();
    const payload = validatePhoneInquiry();
    if (!payload) return;

    window.Green.setBusy(button, true, "登録中…");
    try {
      const { result, sessionRecovered } = await createInquiry(payload);
      showInquirySuccess(result.data?.inquiry, sessionRecovered);
      window.Green.toast(`受付番号 ${result.data?.inquiry?.reception_number || ""} を登録しました。`, "success");
    } catch (error) {
      let message = error?.message || "登録処理に失敗しました。";
      if (isSessionError(error)) {
        message = "ログインの有効期限が切れています。画面を再読み込みしてから、もう一度登録してください。";
      } else if (error instanceof TypeError) {
        message = "通信に失敗しました。インターネット接続を確認して、もう一度登録してください。";
      }
      const detailParts = [];
      if (error?.code) detailParts.push(`エラーコード: ${error.code}`);
      if (error?.requestId) detailParts.push(`確認番号: ${error.requestId}`);
      if (error?.details && !Array.isArray(error.details) && typeof error.details === "object") {
        const detail = Object.values(error.details).filter((value) => typeof value === "string").join(" / ");
        if (detail) detailParts.push(detail);
      }
      showInlineError(message, detailParts.join(" / "));
    } finally {
      if ($("#save-phone-inquiry")) window.Green.setBusy(button, false);
    }
  }

  function installPhoneSubmitGuard() {
    dialog.addEventListener("click", (event) => {
      const button = event.target.closest?.("#save-phone-inquiry");
      if (!button || !dialog.contains(button)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      submitPhoneInquiry(button);
    }, true);
  }

  function syncToastLayer() {
    const region = $("#toast-region");
    if (!region) return;
    if (dialog.open) {
      if (region.parentElement !== dialog) dialog.append(region);
    } else if (region.parentElement !== document.body) {
      document.body.append(region);
    }
  }

  function decodeSessionPayload() {
    let token = null;
    try { token = sessionStorage.getItem("green_admin_session_token"); } catch {}
    if (!token) return null;
    try {
      const encoded = token.split(".")[0];
      const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((encoded.length + 3) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  let warnedToken = "";
  function updateSessionCountdown() {
    const status = $("#session-expiry");
    if (!status || $("#owner-app")?.hidden) return;
    const payload = decodeSessionPayload();
    if (!payload?.exp) return;
    const remaining = payload.exp * 1000 - Date.now();
    const tokenKey = `${payload.exp}`;
    status.classList.toggle("is-warning", remaining > 0 && remaining <= 10 * 60 * 1000);
    status.classList.toggle("is-expired", remaining <= 0);

    if (remaining <= 0) {
      status.textContent = "ログイン期限切れ｜再読込で更新";
      return;
    }

    const minutes = Math.max(1, Math.ceil(remaining / 60000));
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    status.textContent = hours ? `ログイン残り ${hours}時間${mins ? `${mins}分` : ""}` : `ログイン残り ${minutes}分`;

    if (remaining <= 10 * 60 * 1000 && warnedToken !== tokenKey) {
      warnedToken = tokenKey;
      window.Green.toast("ログイン期限まで10分以内です。入力中の内容を確認して保存してください。", "warning");
    }
  }

  function boot() {
    normalizeDialogShell();
    installPhoneSubmitGuard();

    const observer = new MutationObserver(() => {
      ensurePhoneFormHelp();
      syncToastLayer();
    });
    observer.observe(dialog, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    dialog.addEventListener("close", syncToastLayer);

    ensurePhoneFormHelp();
    syncToastLayer();
    updateSessionCountdown();
    window.setInterval(updateSessionCountdown, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
