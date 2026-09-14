(() => {
  "use strict";

  const VERSION = "GREEN-OWNER-UX-FIX-R1.6-20260914";
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const dialog = $("#owner-dialog");
  if (!dialog || !window.Green) return;

  document.documentElement.dataset.greenOwnerUxFix = VERSION;

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
  const LABEL_TO_STATUS = Object.freeze(Object.fromEntries(Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => [v, k])));
  const ACTIVITY_TYPE_LABELS = Object.freeze({ call: "電話", line: "LINE", email: "メール", meeting: "面談", memo: "メモ" });

  function esc(value) {
    return String(value ?? "").replace(/[&<>'\"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    }[char]));
  }

  function pad2(value) { return String(value).padStart(2, "0"); }
  function localDateValue(date = new Date()) { return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`; }
  function localDateTimeValue(date) { return `${localDateValue(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`; }
  function nextQuarterValue() {
    const date = new Date();
    date.setSeconds(0, 0);
    const rem = date.getMinutes() % 15;
    date.setMinutes(date.getMinutes() + (rem === 0 ? 15 : 15 - rem));
    return localDateTimeValue(date);
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
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
  function parseDisplayDateTime(text) {
    const match = String(text || "").match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (!match) return "";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), 0, 0);
    return localDateTimeValue(date);
  }
  function formatLocalDateTime(value) {
    if (!value) return "未設定";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  }
  function isQuarterMinute(value) {
    if (!value) return true;
    const match = String(value).match(/T\d{2}:(\d{2})/);
    return Boolean(match) && Number(match[1]) % 15 === 0;
  }
  function isFutureDateTime(value) {
    if (!value) return true;
    const time = new Date(value).getTime();
    return Number.isFinite(time) && time >= Date.now();
  }

  function closeDialog() {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
  }
  function normalizeDialogShell() {
    const shell = $("#dialog-shell");
    if (!shell || shell.tagName !== "FORM") return;
    const replacement = document.createElement("div");
    for (const attribute of Array.from(shell.attributes)) {
      if (attribute.name !== "method") replacement.setAttribute(attribute.name, attribute.value);
    }
    while (shell.firstChild) replacement.append(shell.firstChild);
    shell.replaceWith(replacement);
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
  function setDialog(titleText, kickerText, bodyHtml, footerHtml) {
    const body = $("#dialog-body");
    const footer = $("#dialog-footer");
    const title = $("#dialog-title");
    const kicker = $("#dialog-kicker");
    if (title) title.textContent = titleText;
    if (kicker) kicker.textContent = kickerText;
    if (body) body.innerHTML = bodyHtml;
    if (footer) footer.innerHTML = footerHtml;
    bindDialogClose();
    ensureDialogOpen();
  }

  function timeoutError(ms) {
    const error = new Error(`通信が${Math.round(ms / 1000)}秒以内に完了しませんでした。`);
    error.code = "request_timeout";
    return error;
  }
  async function apiWithTimeout(path, options = undefined, ms = 7000) {
    let timer;
    try {
      return await Promise.race([
        window.Green.api(path, options),
        new Promise((_, reject) => { timer = setTimeout(() => reject(timeoutError(ms)), ms); }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function showFormError(form, title, message, meta = "") {
    form?.querySelector(".green-owner-save-error")?.remove();
    const box = document.createElement("div");
    box.className = "green-owner-inline-error green-owner-save-error";
    box.setAttribute("role", "alert");
    box.innerHTML = `<strong>${esc(title)}</strong><span>${esc(message)}</span>${meta ? `<small>${esc(meta)}</small>` : ""}`;
    form?.prepend(box);
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function leadStatusOptions(selected) {
    return Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join("");
  }
  function activityTypeOptions() {
    return Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  }
  function syncLeadReasonVisibility() {
    const form = $("#lead-update-form", dialog);
    if (!form) return;
    const status = $('[name="status"]', form)?.value || "new";
    const hold = $("[data-lead-reason='hold']", form);
    const lost = $("[data-lead-reason='lost']", form);
    if (hold) hold.hidden = status !== "on_hold";
    if (lost) lost.hidden = status !== "lost";
  }
  function applyScheduleRules() {
    const leadForm = $("#lead-update-form", dialog);
    if (leadForm) {
      const next = $('[name="nextActionAt"]', leadForm);
      const follow = $('[name="followUpOn"]', leadForm);
      if (next) { next.step = "900"; next.min = nextQuarterValue(); next.title = "現在以降を15分単位で選択してください。"; }
      if (follow) { follow.min = localDateValue(); follow.title = "今日以降の日付を選択してください。"; }
    }
    const activityForm = $("#lead-activity-form", dialog);
    if (activityForm) {
      const actual = $('[name="activityAt"]', activityForm);
      const next = $('[name="nextActionAt"]', activityForm);
      if (actual) { actual.step = "900"; actual.title = "実績日時は過去も入力できます。時間は15分単位です。"; }
      if (next) { next.step = "900"; next.min = nextQuarterValue(); next.title = "現在以降を15分単位で選択してください。"; }
    }
  }
  function validateLeadForm(form) {
    const next = $('[name="nextActionAt"]', form);
    const follow = $('[name="followUpOn"]', form);
    if (next?.value && !isQuarterMinute(next.value)) {
      showFormError(form, "日時を確認してください", "次回対応日時は00分・15分・30分・45分のいずれかで選択してください。"); next.focus(); return false;
    }
    if (next?.value && !isFutureDateTime(next.value)) {
      showFormError(form, "日時を確認してください", "次回対応日時は現在以降を選択してください。過去日時は登録できません。"); next.focus(); return false;
    }
    if (follow?.value && follow.value < localDateValue()) {
      showFormError(form, "日付を確認してください", "再連絡日は今日以降を選択してください。過去日は登録できません。"); follow.focus(); return false;
    }
    return true;
  }
  function validateActivityForm(form) {
    const actual = $('[name="activityAt"]', form);
    const next = $('[name="nextActionAt"]', form);
    if (actual?.value && !isQuarterMinute(actual.value)) {
      showFormError(form, "日時を確認してください", "対応日時は00分・15分・30分・45分のいずれかで入力してください。過去日時は入力できます。"); actual.focus(); return false;
    }
    if (next?.value && !isQuarterMinute(next.value)) {
      showFormError(form, "日時を確認してください", "次回日時は00分・15分・30分・45分のいずれかで選択してください。"); next.focus(); return false;
    }
    if (next?.value && !isFutureDateTime(next.value)) {
      showFormError(form, "日時を確認してください", "次回日時は現在以降を選択してください。過去日時は登録できません。"); next.focus(); return false;
    }
    return true;
  }

  function rowLeadSnapshot(button) {
    const row = button.closest("tr");
    const cells = row ? Array.from(row.cells) : [];
    const leadNumber = cells[0]?.textContent?.trim() || "";
    const statusLabel = cells[1]?.textContent?.trim() || "新着";
    const nextAction = cells[2]?.textContent?.trim() || "";
    const nextActionAt = parseDisplayDateTime(cells[3]?.textContent || "");
    return {
      id: button.dataset.lead,
      lead_number: leadNumber,
      status: LABEL_TO_STATUS[statusLabel] || "new",
      next_action: nextAction === "未設定" ? "" : nextAction,
      next_action_at: nextActionAt ? localInputToIso(nextActionAt) : null,
      follow_up_on: "",
      hold_reason: "",
      lost_reason: "",
    };
  }

  function leadActivitiesHtml(activities) {
    return activities.length ? activities.map((a) => `<div class="owner-mini-item"><strong>${esc(a.summary || "対応内容未設定")}</strong><span class="owner-row-sub">${esc(formatLocalDateTime(a.activity_at))}／${esc(ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type || "その他")}</span>${a.next_action ? `<span class="owner-row-sub">次回：${esc(a.next_action)}</span>` : ""}</div>`).join("") : '<div class="owner-empty">対応履歴はありません。</div>';
  }

  function renderLeadDialog(id, item) {
    const nextValue = toLocalInput(item.next_action_at);
    const legacyWarning = nextValue && !isQuarterMinute(nextValue)
      ? '<div class="green-owner-inline-warning"><strong>旧入力データを確認してください</strong><span>現在の次回対応日時は15分刻みではありません。保存時に00分・15分・30分・45分へ変更してください。</span></div>'
      : "";

    setDialog(
      `営業案件 ${item.lead_number || ""}`,
      "SALES LEAD",
      `${legacyWarning}
      <form id="lead-update-form" class="owner-form-grid">
        <label>状態<select name="status">${leadStatusOptions(item.status || "new")}</select></label>
        <label>次回対応日時<input name="nextActionAt" type="datetime-local" step="900" value="${esc(nextValue)}"><span class="green-owner-schedule-note">現在以降・15分刻み</span></label>
        <label class="full">次回対応<textarea name="nextAction">${esc(item.next_action || "")}</textarea></label>
        <label>再連絡日<input name="followUpOn" type="date" value="${esc(item.follow_up_on || "")}"><span class="green-owner-schedule-note">今日以降</span></label>
        <label data-lead-reason="hold">保留理由<input name="holdReason" value="${esc(item.hold_reason || "")}"></label>
        <label class="full" data-lead-reason="lost">失注理由<textarea name="lostReason">${esc(item.lost_reason || "")}</textarea></label>
      </form>
      <section class="owner-dialog-section"><h3>対応履歴</h3><div id="green-lead-history-status" class="green-owner-history-status"><strong>対応履歴を確認しています…</strong><span>案件の編集は先に進められます。</span></div><div id="green-lead-activities" class="owner-mini-list"><div class="owner-empty">対応履歴を確認中…</div></div></section>
      <form id="lead-activity-form" class="owner-form-grid owner-dialog-section">
        <h3 class="full">対応履歴を追加</h3>
        <label>種別<select name="activityType">${activityTypeOptions()}</select></label>
        <label>対応日時<input name="activityAt" type="datetime-local" step="900"><span class="green-owner-schedule-note">過去入力可・15分刻み</span></label>
        <label class="full">対応内容<textarea name="summary" required></textarea></label>
        <label>次回対応<input name="nextAction"></label>
        <label>次回日時<input name="nextActionAt" type="datetime-local" step="900"><span class="green-owner-schedule-note">現在以降・15分刻み</span></label>
      </form>`,
      '<button type="button" class="btn btn--secondary" id="add-lead-activity">履歴を追加</button><button type="button" class="btn btn--primary" id="save-lead">案件を保存</button>'
    );

    const leadForm = $("#lead-update-form", dialog);
    const activityForm = $("#lead-activity-form", dialog);
    $('[name="status"]', leadForm)?.addEventListener("change", syncLeadReasonVisibility);
    syncLeadReasonVisibility();
    applyScheduleRules();

    $("#save-lead", dialog)?.addEventListener("click", async (event) => {
      if (!validateLeadForm(leadForm)) return;
      const payload = {
        status: $('[name="status"]', leadForm)?.value || "new",
        nextActionAt: localInputToIso($('[name="nextActionAt"]', leadForm)?.value || ""),
        nextAction: $('[name="nextAction"]', leadForm)?.value?.trim() || "",
        followUpOn: $('[name="followUpOn"]', leadForm)?.value || "",
        holdReason: $('[name="holdReason"]', leadForm)?.value?.trim() || "",
        lostReason: $('[name="lostReason"]', leadForm)?.value?.trim() || "",
      };
      const button = event.currentTarget;
      window.Green.setBusy(button, true, "保存中…");
      try {
        await apiWithTimeout(`/api/admin/leads/${encodeURIComponent(id)}`, { method: "PATCH", json: payload }, 8000);
        window.Green.toast("営業案件を更新しました。", "success");
        closeDialog();
        $('[data-load="leads"]')?.click();
      } catch (error) {
        window.Green.setBusy(button, false);
        const meta = [error?.code ? `エラーコード: ${error.code}` : "", error?.requestId ? `確認番号: ${error.requestId}` : ""].filter(Boolean).join(" / ");
        showFormError(leadForm, "案件を保存できませんでした", error?.message || "保存処理に失敗しました。", meta);
      }
    });

    $("#add-lead-activity", dialog)?.addEventListener("click", async (event) => {
      if (!validateActivityForm(activityForm)) return;
      const summary = $('[name="summary"]', activityForm)?.value?.trim() || "";
      if (!summary) { showFormError(activityForm, "対応内容を確認してください", "対応内容を入力してください。"); return; }
      const payload = {
        activityType: $('[name="activityType"]', activityForm)?.value || "memo",
        activityAt: localInputToIso($('[name="activityAt"]', activityForm)?.value || ""),
        summary,
        nextAction: $('[name="nextAction"]', activityForm)?.value?.trim() || "",
        nextActionAt: localInputToIso($('[name="nextActionAt"]', activityForm)?.value || ""),
      };
      const button = event.currentTarget;
      window.Green.setBusy(button, true, "追加中…");
      try {
        await apiWithTimeout(`/api/admin/leads/${encodeURIComponent(id)}/activities`, { method: "POST", json: payload }, 8000);
        window.Green.toast("対応履歴を追加しました。", "success");
        activityForm.reset();
        applyScheduleRules();
        void loadActivities(id);
      } catch (error) {
        const meta = [error?.code ? `エラーコード: ${error.code}` : "", error?.requestId ? `確認番号: ${error.requestId}` : ""].filter(Boolean).join(" / ");
        showFormError(activityForm, "履歴を追加できませんでした", error?.message || "追加処理に失敗しました。", meta);
      } finally {
        if (button?.isConnected) window.Green.setBusy(button, false);
      }
    });

    // UIは即表示。補足情報と履歴は後から取り込む。
    void hydrateLead(id, leadForm);
    void loadActivities(id);
  }

  async function hydrateLead(id, form) {
    form.dataset.greenDirty = "0";
    form.addEventListener("input", () => { form.dataset.greenDirty = "1"; }, { once: true });
    form.addEventListener("change", () => { form.dataset.greenDirty = "1"; }, { once: true });
    try {
      const result = await apiWithTimeout("/api/admin/leads?limit=200", undefined, 4500);
      const full = (result?.data?.items || []).find((item) => item?.id === id);
      if (!full || form.dataset.greenDirty === "1" || !form.isConnected) return;
      $('[name="status"]', form).value = full.status || "new";
      $('[name="nextAction"]', form).value = full.next_action || "";
      $('[name="nextActionAt"]', form).value = toLocalInput(full.next_action_at);
      $('[name="followUpOn"]', form).value = full.follow_up_on || "";
      $('[name="holdReason"]', form).value = full.hold_reason || "";
      $('[name="lostReason"]', form).value = full.lost_reason || "";
      syncLeadReasonVisibility();
      applyScheduleRules();
    } catch {
      // 補足情報の取得失敗は編集を止めない。
    }
  }

  async function loadActivities(id) {
    const status = $("#green-lead-history-status", dialog);
    const list = $("#green-lead-activities", dialog);
    if (!status || !list) return;
    status.className = "green-owner-history-status";
    status.innerHTML = "<strong>対応履歴を確認しています…</strong><span>案件の編集は先に進められます。</span>";
    try {
      const result = await apiWithTimeout(`/api/admin/leads/${encodeURIComponent(id)}`, undefined, 5000);
      if (!list.isConnected) return;
      const activities = result?.data?.activities || [];
      list.innerHTML = leadActivitiesHtml(activities);
      status.className = "green-owner-history-status is-ok";
      status.innerHTML = `<strong>対応履歴を読み込みました</strong><span>${activities.length}件</span>`;
      setTimeout(() => status?.isConnected && status.remove(), 1400);
    } catch (error) {
      if (!list.isConnected) return;
      status.className = "green-owner-history-status is-warning";
      status.innerHTML = '<strong>対応履歴のみ読み込めませんでした</strong><span>案件情報の確認・編集・保存はそのまま行えます。</span><button type="button" class="btn btn--secondary btn--small" id="green-retry-lead-history">履歴を再試行</button>';
      list.innerHTML = '<div class="owner-empty">履歴の取得待ちです。案件編集には影響しません。</div>';
      $("#green-retry-lead-history", dialog)?.addEventListener("click", () => loadActivities(id));
    }
  }

  // window capture は document capture より先に実行される。
  // 旧V1.4のクリック遮断より前に処理し、API待ちなしで詳細画面を表示する。
  function installLeadClickFix() {
    window.addEventListener("click", (event) => {
      const button = event.target?.closest?.('[data-view-panel="leads"] [data-lead]');
      if (!button || !button.dataset.lead) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      renderLeadDialog(button.dataset.lead, rowLeadSnapshot(button));
    }, true);
  }

  function normalizePhone(value) {
    let phone = String(value || "").trim();
    if (phone.startsWith("+81")) phone = `0${phone.slice(3)}`;
    return phone.replace(/\D/g, "");
  }
  function phoneValue(name) { return $(`[name="${name}"]`, $("#dialog-body"))?.value?.trim() || ""; }
  function ensurePhoneHelp() {
    const body = $("#dialog-body");
    if (!body || !$("#save-phone-inquiry", dialog)) return;
    const inquiry = $('[name="inquiryText"]', body);
    if (inquiry && !inquiry.closest("label")?.querySelector(".green-owner-required")) {
      const badge = document.createElement("span"); badge.className = "required green-owner-required"; badge.textContent = "必須"; inquiry.closest("label")?.insertBefore(badge, inquiry);
    }
  }
  async function submitPhoneInquiry(button) {
    const contactName = phoneValue("contactName");
    const phone = phoneValue("phone");
    const email = phoneValue("email");
    const inquiryText = phoneValue("inquiryText");
    const form = $("#phone-inquiry-form", dialog);
    if (!contactName) { showFormError(form, "登録できませんでした", "担当者名を入力してください。"); return; }
    if (!phone && !email) { showFormError(form, "登録できませんでした", "電話番号またはメールアドレスのどちらかを入力してください。"); return; }
    if (phone && ![10,11].includes(normalizePhone(phone).length)) { showFormError(form, "登録できませんでした", "電話番号は10桁または11桁で入力してください。"); return; }
    if (!inquiryText) { showFormError(form, "登録できませんでした", "相談内容を入力してください。"); return; }
    const payload = {
      companyName: phoneValue("companyName"), contactName, phone, email,
      inquiryCategory: phoneValue("inquiryCategory") || "regular_rental",
      preferredContactMethod: phoneValue("preferredContactMethod") || "phone",
      address: phoneValue("address"), inquiryText,
    };
    window.Green.setBusy(button, true, "登録中…");
    try {
      const result = await apiWithTimeout("/api/admin/inquiries", { method: "POST", json: payload, idempotencyKey: window.Green.uuid?.() || `green-phone-${Date.now()}` }, 8000);
      const inquiry = result.data?.inquiry || {};
      setDialog("電話相談を登録しました", "REGISTERED",
        `<section class="green-owner-success" role="status"><div class="green-owner-success__icon">✓</div><div><strong>登録できました</strong><p>受付番号 <b>${esc(inquiry.reception_number || "")}</b></p></div></section><section class="green-owner-next-action"><strong>次にどうしますか？</strong><p>継続して提案・現地確認へ進める相談は「営業案件へ引き継ぐ」を選びます。</p></section>`,
        '<button type="button" class="btn btn--secondary" id="green-phone-list">相談一覧へ戻る</button><button type="button" class="btn btn--primary" id="green-phone-lead">営業案件へ引き継ぐ</button>');
      $("#green-phone-list", dialog)?.addEventListener("click", () => { closeDialog(); $('.owner-nav [data-view="inquiries"]')?.click(); });
      $("#green-phone-lead", dialog)?.addEventListener("click", async (e) => {
        const b = e.currentTarget; window.Green.setBusy(b, true, "引き継ぎ中…");
        try {
          const created = await apiWithTimeout("/api/admin/leads", { method: "POST", json: { inquiryId: inquiry.id, status: inquiry.status || "new" } }, 8000);
          window.Green.toast(`営業案件 ${created.data?.lead?.lead_number || ""} へ引き継ぎました。`, "success");
          closeDialog(); $('.owner-nav [data-view="leads"]')?.click();
        } catch (error) { window.Green.setBusy(b, false); showFormError($("#dialog-body", dialog), "営業案件へ引き継げませんでした", error?.message || "処理に失敗しました。"); }
      });
    } catch (error) {
      const meta = [error?.code ? `エラーコード: ${error.code}` : "", error?.requestId ? `確認番号: ${error.requestId}` : ""].filter(Boolean).join(" / ");
      showFormError(form, "登録できませんでした", error?.message || "登録処理に失敗しました。", meta);
    } finally { if (button?.isConnected) window.Green.setBusy(button, false); }
  }
  function installPhoneFix() {
    window.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#save-phone-inquiry");
      if (!button || !dialog.contains(button)) return;
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      submitPhoneInquiry(button);
    }, true);
  }

  function ensureSiteCheckHelp() {
    const form = $("#site-check-form", dialog);
    const save = $("#save-site-check", dialog);
    if (!form || !save || save.textContent.trim() !== "登録") return;

    if (!$("#green-site-check-guidance", form)) {
      const guidance = document.createElement("div");
      guidance.id = "green-site-check-guidance";
      guidance.className = "green-owner-guidance full";
      guidance.innerHTML = "<strong>現地確認を登録します</strong><span>営業案件が選択されていれば、成約前は顧客・拠点が未登録でも進められます。顧客台帳・拠点は成約後に正式登録できます。</span>";
      form.prepend(guidance);
    }

    const customer = $('[name="customerId"]', form);
    const site = $('[name="siteId"]', form);
    [customer, site].forEach((input) => {
      const label = input?.closest("label");
      if (!label || label.querySelector(".green-owner-optional-note")) return;
      const note = document.createElement("span");
      note.className = "green-owner-schedule-note green-owner-optional-note";
      note.textContent = "営業案件を選択済みなら任意";
      label.append(note);
    });
  }

  function applySiteCheckRules() {
    const form = $("#site-check-form", dialog);
    const save = $("#save-site-check", dialog);
    if (!form || !save || save.textContent.trim() !== "登録") return;

    const start = $('[name="scheduledStart"]', form);
    const end = $('[name="scheduledEnd"]', form);
    const min = nextQuarterValue();

    if (start) {
      start.step = "900";
      start.min = min;
      start.title = "現在以降を15分単位で選択してください。";
      const label = start.closest("label");
      if (label && !label.querySelector(".green-site-start-note")) {
        const note = document.createElement("span");
        note.className = "green-owner-schedule-note green-site-start-note";
        note.textContent = "現在以降・15分刻み";
        label.append(note);
      }
    }

    if (end) {
      end.step = "900";
      end.min = start?.value || min;
      end.title = "開始日時より後を15分単位で選択してください。";
      const label = end.closest("label");
      if (label && !label.querySelector(".green-site-end-note")) {
        const note = document.createElement("span");
        note.className = "green-owner-schedule-note green-site-end-note";
        note.textContent = "開始より後・15分刻み";
        label.append(note);
      }
    }

    if (start && start.dataset.greenSiteBound !== "1") {
      start.dataset.greenSiteBound = "1";
      start.addEventListener("change", () => {
        if (end) end.min = start.value || nextQuarterValue();
      });
    }
  }

  function validateSiteCheckForm(form) {
    form?.querySelector(".green-owner-save-error")?.remove();
    const lead = $('[name="leadId"]', form);
    const customer = $('[name="customerId"]', form);
    const status = $('[name="status"]', form);
    const start = $('[name="scheduledStart"]', form);
    const end = $('[name="scheduledEnd"]', form);

    if (!lead?.value && !customer?.value) {
      showFormError(form, "登録内容を確認してください", "営業案件または顧客のどちらかを選択してください。");
      lead?.focus();
      return false;
    }

    const scheduledStatus = ["scheduled", "in_progress"].includes(status?.value || "");
    if (scheduledStatus && !start?.value) {
      showFormError(form, "開始日時を確認してください", "予定確定・確認中の場合は開始日時を入力してください。");
      start?.focus();
      return false;
    }
    if (scheduledStatus && !end?.value) {
      showFormError(form, "終了日時を確認してください", "予定確定・確認中の場合は終了日時を入力してください。");
      end?.focus();
      return false;
    }
    if ((start?.value && !end?.value) || (!start?.value && end?.value)) {
      showFormError(form, "日時を確認してください", "開始日時と終了日時は両方入力してください。");
      (start?.value ? end : start)?.focus();
      return false;
    }
    if (start?.value && !isQuarterMinute(start.value)) {
      showFormError(form, "開始日時を確認してください", "開始日時は00分・15分・30分・45分で選択してください。");
      start.focus();
      return false;
    }
    if (end?.value && !isQuarterMinute(end.value)) {
      showFormError(form, "終了日時を確認してください", "終了日時は00分・15分・30分・45分で選択してください。");
      end.focus();
      return false;
    }
    if (start?.value && !isFutureDateTime(start.value)) {
      showFormError(form, "開始日時を確認してください", "開始日時は現在以降を選択してください。過去日時は登録できません。");
      start.focus();
      return false;
    }
    if (end?.value && !isFutureDateTime(end.value)) {
      showFormError(form, "終了日時を確認してください", "終了日時は現在以降を選択してください。過去日時は登録できません。");
      end.focus();
      return false;
    }
    if (start?.value && end?.value && new Date(end.value).getTime() <= new Date(start.value).getTime()) {
      showFormError(form, "終了日時を確認してください", "終了日時は開始日時より後にしてください。");
      end.focus();
      return false;
    }
    return true;
  }

  function siteCheckPayload(form) {
    const value = (name) => $(`[name="${name}"]`, form)?.value?.trim() || "";
    return {
      leadId: value("leadId") || null,
      customerId: value("customerId") || null,
      siteId: value("siteId") || null,
      status: value("status") || "scheduling",
      scheduledStart: localInputToIso(value("scheduledStart")) || null,
      scheduledEnd: localInputToIso(value("scheduledEnd")) || null,
      customerRequest: value("customerRequest"),
      internalNote: value("internalNote"),
    };
  }

  function showSiteCheckSuccess(item, payload) {
    const leadLinked = Boolean(payload.leadId);
    const statusText = payload.scheduledStart ? "現地確認予定" : "現地確認調整中";
    setDialog(
      "現地確認を登録しました",
      "REGISTERED",
      `<section class="green-owner-success" role="status">
        <div class="green-owner-success__icon">✓</div>
        <div><strong>登録できました</strong><p>確認番号 <b>${esc(item?.check_number || "登録済み")}</b></p></div>
      </section>
      <section class="green-owner-next-action">
        <strong>次にどうしますか？</strong>
        <p>${leadLinked ? `営業案件も「${esc(statusText)}」へ連動更新されます。` : "現地確認一覧で予定と状態を確認できます。"} 訪問後は詳細画面から確認結果を記録します。</p>
      </section>`,
      `<button type="button" class="btn btn--secondary" id="green-site-check-list">現地確認一覧へ戻る</button>${leadLinked ? '<button type="button" class="btn btn--primary" id="green-site-check-lead">営業案件を確認</button>' : ""}`,
    );

    $("#green-site-check-list", dialog)?.addEventListener("click", () => {
      closeDialog();
      $('.owner-nav [data-view="site-checks"]')?.click();
    });
    $("#green-site-check-lead", dialog)?.addEventListener("click", () => {
      closeDialog();
      $('.owner-nav [data-view="leads"]')?.click();
    });
  }

  async function submitSiteCheck(button) {
    const form = $("#site-check-form", dialog);
    if (!form || !validateSiteCheckForm(form)) return;
    const payload = siteCheckPayload(form);

    window.Green.setBusy(button, true, "登録中…");
    try {
      const result = await apiWithTimeout("/api/admin/site-checks", {
        method: "POST",
        json: payload,
        idempotencyKey: window.Green.uuid?.() || `green-site-check-${Date.now()}`,
      }, 9000);
      const item = result?.data?.siteCheck || {};
      window.Green.toast(`現地確認 ${item.check_number || ""} を登録しました。`, "success");
      showSiteCheckSuccess(item, payload);
    } catch (error) {
      const meta = [
        error?.code ? `エラーコード: ${error.code}` : "",
        error?.requestId ? `確認番号: ${error.requestId}` : "",
      ].filter(Boolean).join(" / ");
      showFormError(form, "現地確認を登録できませんでした", error?.message || "登録処理に失敗しました。", meta);
    } finally {
      if (button?.isConnected) window.Green.setBusy(button, false);
    }
  }

  function installSiteCheckFix() {
    window.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#save-site-check");
      if (!button || !dialog.contains(button) || button.textContent.trim() !== "登録") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      submitSiteCheck(button);
    }, true);

    dialog.addEventListener("focusin", (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (!$("#site-check-form", dialog)) return;
      if (input.name === "scheduledStart") input.min = nextQuarterValue();
      if (input.name === "scheduledEnd") input.min = $('[name="scheduledStart"]', dialog)?.value || nextQuarterValue();
    });
  }

  function decodeSessionPayload() {
    try {
      const token = sessionStorage.getItem("green_admin_session_token");
      if (!token) return null;
      const encoded = token.split(".")[0];
      const padded = encoded.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((encoded.length + 3) % 4);
      return JSON.parse(atob(padded));
    } catch { return null; }
  }
  function updateSessionCountdown() {
    const status = $("#session-expiry");
    const payload = decodeSessionPayload();
    if (!status || !payload?.exp) return;
    const remaining = payload.exp * 1000 - Date.now();
    if (remaining <= 0) { status.textContent = "ログイン期限切れ｜再読込で更新"; return; }
    const minutes = Math.max(1, Math.ceil(remaining / 60000));
    const hours = Math.floor(minutes / 60), mins = minutes % 60;
    status.textContent = hours ? `ログイン残り ${hours}時間${mins ? `${mins}分` : ""}` : `ログイン残り ${minutes}分`;
  }

  function boot() {
    normalizeDialogShell();
    installLeadClickFix();
    installPhoneFix();
    installSiteCheckFix();
    ensurePhoneHelp();
    ensureSiteCheckHelp();
    applySiteCheckRules();
    const observer = new MutationObserver(() => { ensurePhoneHelp(); ensureSiteCheckHelp(); applyScheduleRules(); applySiteCheckRules(); });
    observer.observe(dialog, { childList: true, subtree: true });
    updateSessionCountdown();
    setInterval(updateSessionCountdown, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
