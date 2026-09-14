(() => {
  "use strict";

  const VERSION = "GREEN-OWNER-UX-FIX-R1.2-20260914";
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


  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function localDateValue(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function localDateTimeValue(date) {
    return `${localDateValue(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function nextQuarterValue() {
    const date = new Date();
    date.setSeconds(0, 0);
    const remainder = date.getMinutes() % 15;
    if (remainder === 0) date.setMinutes(date.getMinutes() + 15);
    else date.setMinutes(date.getMinutes() + (15 - remainder));
    return localDateTimeValue(date);
  }

  function isQuarterMinute(value) {
    if (!value) return true;
    const match = String(value).match(/T\d{2}:(\d{2})/);
    if (!match) return false;
    return Number(match[1]) % 15 === 0;
  }

  function isFutureDateTime(value) {
    if (!value) return true;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= Date.now();
  }

  function ensureScheduleNote(input, text) {
    const label = input?.closest("label");
    if (!label) return;
    let note = label.querySelector(".green-owner-schedule-note");
    if (!note) {
      note = document.createElement("span");
      note.className = "green-owner-schedule-note";
      label.append(note);
    }
    note.textContent = text;
  }

  function applyScheduleRules() {
    const leadForm = $("#lead-update-form", dialog);
    if (leadForm) {
      const nextActionAt = $('[name="nextActionAt"]', leadForm);
      const followUpOn = $('[name="followUpOn"]', leadForm);
      if (nextActionAt) {
        nextActionAt.step = "900";
        nextActionAt.min = nextQuarterValue();
        nextActionAt.title = "現在以降を15分単位で選択してください。";
        ensureScheduleNote(nextActionAt, "現在以降・15分刻み");
      }
      if (followUpOn) {
        followUpOn.min = localDateValue();
        followUpOn.title = "今日以降の日付を選択してください。";
        ensureScheduleNote(followUpOn, "今日以降");
      }
    }

    const activityForm = $("#lead-activity-form", dialog);
    if (activityForm) {
      const activityAt = $('[name="activityAt"]', activityForm);
      const nextActionAt = $('[name="nextActionAt"]', activityForm);
      if (activityAt) {
        activityAt.step = "900";
        activityAt.title = "実績日時は過去も入力できます。時間は15分単位です。";
        ensureScheduleNote(activityAt, "実績日時：過去入力可・15分刻み");
      }
      if (nextActionAt) {
        nextActionAt.step = "900";
        nextActionAt.min = nextQuarterValue();
        nextActionAt.title = "現在以降を15分単位で選択してください。";
        ensureScheduleNote(nextActionAt, "現在以降・15分刻み");
      }
    }
  }

  function clearScheduleError(form) {
    form?.querySelector(".green-owner-schedule-error")?.remove();
    form?.querySelectorAll('input[type="datetime-local"], input[type="date"]').forEach((input) => input.setCustomValidity(""));
  }

  function failSchedule(form, input, message) {
    clearScheduleError(form);
    const box = document.createElement("div");
    box.className = "green-owner-inline-error green-owner-schedule-error";
    box.setAttribute("role", "alert");
    box.innerHTML = `<strong>日時を確認してください</strong><span>${esc(message)}</span>`;
    form.prepend(box);
    if (input) {
      input.setCustomValidity(message);
      input.focus();
      input.reportValidity();
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    return false;
  }

  function validateLeadSchedule() {
    const form = $("#lead-update-form", dialog);
    if (!form) return true;
    clearScheduleError(form);
    const nextActionAt = $('[name="nextActionAt"]', form);
    const followUpOn = $('[name="followUpOn"]', form);

    if (nextActionAt?.value && !isQuarterMinute(nextActionAt.value)) {
      return failSchedule(form, nextActionAt, "次回対応日時は00分・15分・30分・45分のいずれかで選択してください。");
    }
    if (nextActionAt?.value && !isFutureDateTime(nextActionAt.value)) {
      return failSchedule(form, nextActionAt, "次回対応日時は現在以降を選択してください。過去日時は登録できません。");
    }
    if (followUpOn?.value && followUpOn.value < localDateValue()) {
      return failSchedule(form, followUpOn, "再連絡日は今日以降を選択してください。過去日は登録できません。");
    }
    return true;
  }

  function validateActivitySchedule() {
    const form = $("#lead-activity-form", dialog);
    if (!form) return true;
    clearScheduleError(form);
    const activityAt = $('[name="activityAt"]', form);
    const nextActionAt = $('[name="nextActionAt"]', form);

    if (activityAt?.value && !isQuarterMinute(activityAt.value)) {
      return failSchedule(form, activityAt, "対応日時は00分・15分・30分・45分のいずれかで入力してください。過去日時の入力は可能です。");
    }
    if (nextActionAt?.value && !isQuarterMinute(nextActionAt.value)) {
      return failSchedule(form, nextActionAt, "次回日時は00分・15分・30分・45分のいずれかで選択してください。");
    }
    if (nextActionAt?.value && !isFutureDateTime(nextActionAt.value)) {
      return failSchedule(form, nextActionAt, "次回日時は現在以降を選択してください。過去日時は登録できません。");
    }
    return true;
  }

  function installScheduleGuard() {
    dialog.addEventListener("click", (event) => {
      const saveLead = event.target.closest?.("#save-lead");
      if (saveLead && dialog.contains(saveLead) && !validateLeadSchedule()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const addActivity = event.target.closest?.("#add-lead-activity");
      if (addActivity && dialog.contains(addActivity) && !validateActivitySchedule()) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);

    dialog.addEventListener("focusin", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.type === "datetime-local" && input.name === "nextActionAt") input.min = nextQuarterValue();
      if (input.type === "date" && input.name === "followUpOn") input.min = localDateValue();
    });
  }


  const LEAD_STATUS_LABELS = Object.freeze({
    new: "新着",
    contacted: "連絡済み",
    site_check_scheduling: "現地確認調整中",
    site_check_scheduled: "現地確認予定",
    site_checked: "現地確認済み",
    planning: "導入内容整理中",
    preparing: "導入準備中",
    installation_scheduled: "設置予定",
    active: "利用開始",
    on_hold: "保留",
    lost: "失注",
    follow_up: "再連絡予定",
  });

  const ACTIVITY_TYPE_LABELS = Object.freeze({
    call: "電話",
    line: "LINE",
    email: "メール",
    meeting: "面談",
    site_check: "現地確認",
    memo: "メモ",
    status_change: "状態変更",
    other: "その他",
  });

  function dialogParts() {
    return {
      body: $("#dialog-body"),
      footer: $("#dialog-footer"),
      title: $("#dialog-title"),
      kicker: $("#dialog-kicker"),
    };
  }

  function ensureDialogOpen() {
    if (dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function bindDialogClose() {
    $$('[data-dialog-close]', dialog).forEach((button) => {
      if (button.dataset.greenCloseBound === "1") return;
      button.dataset.greenCloseBound = "1";
      button.addEventListener("click", closeDialog);
    });
  }

  function setLeadDialog(titleText, kickerText, bodyHtml, footerHtml) {
    const { body, footer, title, kicker } = dialogParts();
    if (title) title.textContent = titleText;
    if (kicker) kicker.textContent = kickerText;
    if (body) body.innerHTML = bodyHtml;
    if (footer) footer.innerHTML = footerHtml;
    bindDialogClose();
    ensureDialogOpen();
    syncToastLayer();
  }

  function timeoutError(milliseconds) {
    const error = new Error(`通信が${Math.round(milliseconds / 1000)}秒以内に完了しませんでした。`);
    error.code = "request_timeout";
    return error;
  }

  async function apiWithTimeout(path, options = undefined, milliseconds = 12000) {
    let timer = null;
    try {
      return await Promise.race([
        window.Green.api(path, options),
        new Promise((_, reject) => {
          timer = window.setTimeout(() => reject(timeoutError(milliseconds)), milliseconds);
        }),
      ]);
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return localDateTimeValue(date);
  }

  function localInputToIso(value) {
    if (!value) return "";
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  }

  function formatLocalDateTime(value) {
    if (!value) return "未設定";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return esc(value);
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(date);
  }

  function leadStatusOptions(selected) {
    return Object.entries(LEAD_STATUS_LABELS)
      .map(([value, label]) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`)
      .join("");
  }

  function activityTypeOptions() {
    return ["call", "line", "email", "meeting", "memo"]
      .map((value) => `<option value="${value}">${ACTIVITY_TYPE_LABELS[value]}</option>`)
      .join("");
  }

  function syncLeadReasonVisibility() {
    const form = $("#lead-update-form", dialog);
    if (!form) return;
    const status = $('[name="status"]', form)?.value || "";
    const hold = $("[data-lead-reason='hold']", form);
    const lost = $("[data-lead-reason='lost']", form);
    if (hold) hold.hidden = status !== "on_hold";
    if (lost) lost.hidden = status !== "lost";
  }

  function showLeadLoadError(id, error) {
    const meta = [
      error?.code ? `エラーコード: ${error.code}` : "",
      error?.requestId ? `確認番号: ${error.requestId}` : "",
    ].filter(Boolean).join(" / ");
    const message = error?.code === "request_timeout"
      ? "営業案件の読み込みに時間がかかっています。通信状態またはAPI応答を確認して、再試行してください。"
      : (error?.message || "営業案件を読み込めませんでした。");
    setLeadDialog(
      "営業案件を読み込めませんでした",
      "LOAD ERROR",
      `<div class="green-owner-inline-error green-owner-load-error" role="alert">
        <strong>読み込みを完了できませんでした</strong>
        <span>${esc(message)}</span>
        ${meta ? `<small>${esc(meta)}</small>` : ""}
      </div>
      <div class="green-owner-next-action">
        <strong>次にどうしますか？</strong>
        <p>入力操作は行われていません。「再試行」で同じ営業案件をもう一度読み込めます。</p>
      </div>`,
      '<button type="button" class="btn btn--secondary" data-dialog-close>閉じる</button><button type="button" class="btn btn--primary" id="green-retry-lead">再試行</button>',
    );
    $("#green-retry-lead")?.addEventListener("click", () => robustOpenLead(id));
  }

  function leadLegacyMinuteWarning(item) {
    const local = toLocalInput(item?.next_action_at);
    if (!local || isQuarterMinute(local)) return "";
    return `<div class="green-owner-inline-warning">
      <strong>旧入力データを確認してください</strong>
      <span>現在保存されている次回対応日時は15分刻みではありません。今回保存する際に、00分・15分・30分・45分のいずれかへ変更してください。</span>
    </div>`;
  }

  async function robustOpenLead(id) {
    setLeadDialog(
      "営業案件詳細",
      "LOADING",
      '<div class="owner-loading">データを読み込んでいます…</div><div class="green-owner-loading-note">12秒以上かかる場合は、自動的にエラー理由と再試行ボタンを表示します。</div>',
      '<button type="button" class="btn btn--secondary" data-dialog-close>閉じる</button>',
    );

    try {
      const result = await apiWithTimeout(`/api/admin/leads/${encodeURIComponent(id)}`);
      const item = result?.data?.lead;
      const activities = result?.data?.activities || [];
      if (!item?.id) {
        const error = new Error("営業案件データの形式を確認できませんでした。");
        error.code = "invalid_lead_response";
        throw error;
      }

      const nextActionValue = toLocalInput(item.next_action_at);
      const activitiesHtml = activities.length
        ? activities.map((activity) => `<div class="owner-mini-item">
            <strong>${esc(activity.summary || "対応内容未設定")}</strong>
            <span class="owner-row-sub">${esc(formatLocalDateTime(activity.activity_at))}／${esc(ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type || "その他")}</span>
            ${activity.next_action ? `<span class="owner-row-sub">次回：${esc(activity.next_action)}</span>` : ""}
          </div>`).join("")
        : '<div class="owner-empty">対応履歴はありません。</div>';

      setLeadDialog(
        `営業案件 ${item.lead_number || ""}`,
        "SALES LEAD",
        `${leadLegacyMinuteWarning(item)}
        <form id="lead-update-form" class="owner-form-grid">
          <label>状態<select name="status">${leadStatusOptions(item.status || "new")}</select></label>
          <label>次回対応日時<input name="nextActionAt" type="datetime-local" step="900" value="${esc(nextActionValue)}"></label>
          <label class="full">次回対応<textarea name="nextAction">${esc(item.next_action || "")}</textarea></label>
          <label>再連絡日<input name="followUpOn" type="date" value="${esc(item.follow_up_on || "")}"></label>
          <label data-lead-reason="hold">保留理由<input name="holdReason" value="${esc(item.hold_reason || "")}"></label>
          <label class="full" data-lead-reason="lost">失注理由<textarea name="lostReason">${esc(item.lost_reason || "")}</textarea></label>
        </form>
        <section class="owner-dialog-section"><h3>対応履歴</h3><div class="owner-mini-list">${activitiesHtml}</div></section>
        <form id="lead-activity-form" class="owner-form-grid owner-dialog-section">
          <h3 class="full">対応履歴を追加</h3>
          <label>種別<select name="activityType">${activityTypeOptions()}</select></label>
          <label>対応日時<input name="activityAt" type="datetime-local" step="900"></label>
          <label class="full">対応内容<textarea name="summary" required></textarea></label>
          <label>次回対応<input name="nextAction"></label>
          <label>次回日時<input name="nextActionAt" type="datetime-local" step="900"></label>
        </form>`,
        '<button type="button" class="btn btn--secondary" id="add-lead-activity">履歴を追加</button><button type="button" class="btn btn--primary" id="save-lead">案件を保存</button>',
      );

      const status = $('[name="status"]', $("#lead-update-form"));
      status?.addEventListener("change", syncLeadReasonVisibility);
      syncLeadReasonVisibility();
      applyScheduleRules();

      $("#save-lead")?.addEventListener("click", async (event) => {
        if (!validateLeadSchedule()) return;
        const form = $("#lead-update-form");
        const payload = {
          status: $('[name="status"]', form)?.value || item.status || "new",
          nextActionAt: localInputToIso($('[name="nextActionAt"]', form)?.value || ""),
          nextAction: $('[name="nextAction"]', form)?.value?.trim() || "",
          followUpOn: $('[name="followUpOn"]', form)?.value || "",
          holdReason: $('[name="holdReason"]', form)?.value?.trim() || "",
          lostReason: $('[name="lostReason"]', form)?.value?.trim() || "",
        };
        const button = event.currentTarget;
        window.Green.setBusy(button, true, "保存中…");
        try {
          await apiWithTimeout(`/api/admin/leads/${encodeURIComponent(id)}`, { method: "PATCH", json: payload });
          window.Green.toast("営業案件を更新しました。", "success");
          closeDialog();
          $('[data-load="leads"]')?.click();
        } catch (error) {
          window.Green.setBusy(button, false);
          showLeadLoadError(id, error);
        }
      });

      $("#add-lead-activity")?.addEventListener("click", async (event) => {
        if (!validateActivitySchedule()) return;
        const form = $("#lead-activity-form");
        const summary = $('[name="summary"]', form)?.value?.trim() || "";
        if (!summary) {
          failSchedule(form, $('[name="summary"]', form), "対応内容を入力してください。");
          return;
        }
        const payload = {
          activityType: $('[name="activityType"]', form)?.value || "memo",
          activityAt: localInputToIso($('[name="activityAt"]', form)?.value || ""),
          summary,
          nextAction: $('[name="nextAction"]', form)?.value?.trim() || "",
          nextActionAt: localInputToIso($('[name="nextActionAt"]', form)?.value || ""),
        };
        const button = event.currentTarget;
        window.Green.setBusy(button, true, "追加中…");
        try {
          await apiWithTimeout(`/api/admin/leads/${encodeURIComponent(id)}/activities`, { method: "POST", json: payload });
          window.Green.toast("対応履歴を追加しました。", "success");
          await robustOpenLead(id);
        } catch (error) {
          window.Green.setBusy(button, false);
          showLeadLoadError(id, error);
        }
      });
    } catch (error) {
      showLeadLoadError(id, error);
    }
  }

  function installRobustLeadDetail() {
    document.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-lead]");
      if (!button || !button.dataset.lead) return;
      const leadPanel = $('[data-view-panel="leads"]');
      if (!leadPanel?.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      robustOpenLead(button.dataset.lead);
    }, true);
  }

  function boot() {
    normalizeDialogShell();
    installPhoneSubmitGuard();
    installScheduleGuard();
    installRobustLeadDetail();

    const observer = new MutationObserver(() => {
      ensurePhoneFormHelp();
      applyScheduleRules();
      syncToastLayer();
    });
    observer.observe(dialog, { childList: true, subtree: true, attributes: true, attributeFilter: ["open"] });
    dialog.addEventListener("close", syncToastLayer);

    ensurePhoneFormHelp();
    applyScheduleRules();
    syncToastLayer();
    updateSessionCountdown();
    window.setInterval(updateSessionCountdown, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
