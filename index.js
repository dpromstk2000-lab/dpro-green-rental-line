(() => {
  "use strict";
  const VERSION = "GREEN-PUBLIC-ANNOUNCEMENT-R1.1-20260916";
  const { api, uploadPhoto, compressImage, uuid, toast, setBusy, renderError } = window.Green;
  const config = window.GREEN_CONFIG;
  const form = document.querySelector("#inquiry-form");
  const submitButton = document.querySelector("#submit-button");
  const errorBox = document.querySelector("#form-error");
  const completion = document.querySelector("#completion");
  const photoInput = document.querySelector("#photos");
  const preview = document.querySelector("#photo-preview");
  const categoryCards = [...document.querySelectorAll("[data-category]")];
  let selectedFiles = [];


  const CLEAN_DATE_DISPLAY_VERSION = "GREEN-CLEAN-DATETIME-R1.1-20260916";

  function ensureCleanDateStyles() {
    if (document.querySelector(`style[data-green-clean-datetime="${CLEAN_DATE_DISPLAY_VERSION}"]`)) return;
    const style = document.createElement("style");
    style.dataset.greenCleanDatetime = CLEAN_DATE_DISPLAY_VERSION;
    style.textContent = `
      .green-clean-date-wrap { display:grid; grid-template-columns:minmax(0,1fr) 46px; gap:8px; align-items:stretch; width:100%; position:relative; }
      .green-clean-date-display { width:100%; min-width:0; }
      .green-clean-date-button { min-width:46px; min-height:46px; padding:0; border:1px solid #cbd7ce; border-radius:12px; background:#fff; color:inherit; font:inherit; font-size:20px; cursor:pointer; }
      .green-clean-date-button:hover { background:#f7faf7; }
      .green-clean-date-native { position:absolute !important; left:-10000px !important; top:auto !important; width:1px !important; min-width:1px !important; height:1px !important; min-height:1px !important; padding:0 !important; margin:0 !important; opacity:0 !important; pointer-events:none !important; }
    `;
    document.head.append(style);
  }

  function cleanDateDisplayValue(value) {
    const text = String(value || "");
    if (!text) return "";
    const match = text.match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})/);
    return match ? `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}` : text;
  }

  function parseCleanDateDisplay(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const match = text.match(/^(\\d{4})[\\/-](\\d{1,2})[\\/-](\\d{1,2})[ T](\\d{1,2}):(\\d{2})$/);
    if (!match) return null;
    return `${match[1]}-${String(match[2]).padStart(2,"0")}-${String(match[3]).padStart(2,"0")}T${String(match[4]).padStart(2,"0")}:${match[5]}`;
  }

  function syncCleanDateField(input) {
    if (!input) return;
    const wrapper = input.closest(".green-clean-date-wrap");
    const display = wrapper?.querySelector(".green-clean-date-display");
    if (!display) return;
    const next = cleanDateDisplayValue(input.value);
    if (document.activeElement !== display && display.value !== next) display.value = next;
    display.setCustomValidity("");
  }

  function commitCleanDateDisplay(input, display) {
    const parsed = parseCleanDateDisplay(display.value);
    if (parsed === null) {
      input.value = "";
      display.setCustomValidity("YYYY/MM/DD HH:mm 形式で入力してください。");
      return false;
    }
    input.value = parsed;
    display.value = cleanDateDisplayValue(parsed);
    display.setCustomValidity("");
    input.dispatchEvent(new Event("input", { bubbles:true }));
    input.dispatchEvent(new Event("change", { bubbles:true }));
    return true;
  }

  function installCleanDateField(input) {
    if (!input) return;
    if (input.dataset.greenCleanDateFixed === CLEAN_DATE_DISPLAY_VERSION) { syncCleanDateField(input); return; }
    if (!input.matches('input[type="datetime-local"]')) return;
    ensureCleanDateStyles();
    const wrapper = document.createElement("span"); wrapper.className = "green-clean-date-wrap"; wrapper.dataset.greenCleanDateWrap = CLEAN_DATE_DISPLAY_VERSION;
    const display = document.createElement("input"); display.type = "text"; display.className = "green-clean-date-display"; display.inputMode = "numeric"; display.autocomplete = "off"; display.placeholder = "YYYY/MM/DD HH:mm"; display.value = cleanDateDisplayValue(input.value); display.setAttribute("aria-label", "日時");
    const button = document.createElement("button"); button.type = "button"; button.className = "green-clean-date-button"; button.setAttribute("aria-label", "日時をカレンダーから選択"); button.title = "日時をカレンダーから選択"; button.textContent = "📅";
    input.dataset.greenCleanDateFixed = CLEAN_DATE_DISPLAY_VERSION; input.classList.add("green-clean-date-native"); input.tabIndex = -1;
    input.parentNode.insertBefore(wrapper, input); wrapper.append(display, button, input);
    display.addEventListener("input", () => { const parsed = parseCleanDateDisplay(display.value); if (parsed === "") { input.value = ""; display.setCustomValidity(""); } else if (parsed) { input.value = parsed; display.setCustomValidity(""); } else { input.value = ""; } });
    display.addEventListener("change", () => commitCleanDateDisplay(input, display));
    display.addEventListener("blur", () => { if (display.value.trim()) commitCleanDateDisplay(input, display); else display.setCustomValidity(""); });
    input.addEventListener("input", () => syncCleanDateField(input)); input.addEventListener("change", () => syncCleanDateField(input));
    button.addEventListener("click", () => { try { if (typeof input.showPicker === "function") input.showPicker(); else input.click(); } catch { input.click(); } });
  }

  function installPublicCandidateCleanDates() {
    ["candidate1","candidate2","candidate3"].forEach((name) => installCleanDateField(form?.elements?.[name] || null));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    })[char]);
  }

  async function initialize() {
    bindEvents();
    prefillTracking();
    installPublicCandidateCleanDates();
    try {
      const [facilityResponse, servicesResponse] = await Promise.all([
        api("/api/public/facility"), api("/api/public/services"),
      ]);
      document.querySelectorAll("[data-facility-name]").forEach((node) => { node.textContent = facilityResponse.data.facilityName; });
      const serviceCount = servicesResponse.data.services?.length || 0;
      document.querySelector("#service-note").textContent = `${serviceCount}種類のご相談に対応しています。金額の確定ではなく、まず状況をお聞きする受付フォームです。`;
    } catch (error) {
      document.querySelector("#service-note").textContent = "フォームはご利用いただけます。送信時に事業所接続を確認します。";
    }
  }

  function bindEvents() {
    categoryCards.forEach((card) => card.addEventListener("click", () => selectCategory(card.dataset.category)));
    document.querySelector("#inquiry-category").addEventListener("change", (event) => selectCategory(event.target.value, false));
    photoInput.addEventListener("change", handlePhotoSelection);
    form.addEventListener("submit", handleSubmit);
    document.querySelector("#new-inquiry").addEventListener("click", resetForm);
  }

  function selectCategory(value, syncSelect = true) {
    categoryCards.forEach((card) => card.classList.toggle("is-selected", card.dataset.category === value));
    if (syncSelect) document.querySelector("#inquiry-category").value = value;
  }

  function prefillTracking() {
    const params = new URLSearchParams(location.search);
    form.elements.pageUrl.value = location.href;
    form.elements.utmSource.value = params.get("utm_source") || "";
    form.elements.utmMedium.value = params.get("utm_medium") || "";
    form.elements.utmCampaign.value = params.get("utm_campaign") || "";
  }

  async function handlePhotoSelection() {
    errorBox.hidden = true;
    const candidates = [...photoInput.files].slice(0, config.MAX_PHOTOS || 4);
    try {
      selectedFiles = [];
      for (const file of candidates) selectedFiles.push(await compressImage(file));
      renderPreviews();
      if (photoInput.files.length > candidates.length) toast(`写真は最大${candidates.length}枚までです。`, "warning");
    } catch (error) {
      renderError(errorBox, error);
    }
  }

  function renderPreviews() {
    preview.replaceChildren();
    selectedFiles.forEach((file, index) => {
      const item = document.createElement("div");
      item.className = "photo-preview-item";
      const image = document.createElement("img");
      image.src = URL.createObjectURL(file);
      image.alt = `選択写真 ${index + 1}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "photo-remove";
      button.textContent = "削除";
      button.addEventListener("click", () => {
        selectedFiles.splice(index, 1);
        renderPreviews();
      });
      item.append(image, button);
      preview.append(item);
    });
  }

  function buildPayload() {
    const data = new FormData(form);
    const category = String(data.get("inquiryCategory") || "");
    if (category === "photo_consultation" && !selectedFiles.length) throw new Error("写真で相談する場合は、写真を1枚以上選択してください。");
    return {
      facilityCode: config.FACILITY_CODE,
      source: document.body.dataset.source || "website",
      companyName: data.get("companyName"),
      contactName: data.get("contactName"),
      phone: data.get("phone"),
      email: data.get("email"),
      postalCode: data.get("postalCode"),
      address: data.get("address"),
      inquiryCategory: category,
      siteType: data.get("siteType"),
      desiredCount: data.get("desiredCount") || null,
      desiredSize: data.get("desiredSize"),
      desiredStartPeriod: data.get("desiredStartPeriod"),
      siteCheckCandidates: [data.get("candidate1"), data.get("candidate2"), data.get("candidate3")].filter(Boolean),
      preferredContactMethod: data.get("preferredContactMethod"),
      inquiryText: data.get("inquiryText"),
      consent: data.get("consent") === "on",
      website: data.get("website"),
      pageUrl: data.get("pageUrl"),
      utm: { source: data.get("utmSource"), medium: data.get("utmMedium"), campaign: data.get("utmCampaign") },
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    errorBox.hidden = true;
    if (!form.reportValidity()) return;
    setBusy(submitButton, true, "受付中…");
    try {
      const payload = buildPayload();
      const response = await api("/api/public/inquiries", { method: "POST", json: payload, idempotencyKey: uuid() });
      const { inquiryId, receptionNumber, uploadToken } = response.data;
      for (let index = 0; index < selectedFiles.length; index += 1) {
        submitButton.textContent = `写真を保存中 ${index + 1}/${selectedFiles.length}`;
        await uploadPhoto(`/api/public/inquiries/${inquiryId}/photos`, selectedFiles[index], uploadToken, `相談写真 ${index + 1}`);
      }
      form.hidden = true;
      document.querySelector("#reception-number").textContent = receptionNumber;
      document.querySelector("#duplicate-note").hidden = !response.data.duplicateCandidate;
      completion.hidden = false;
      completion.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      renderError(errorBox, error);
      errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      setBusy(submitButton, false);
    }
  }

  function resetForm() {
    form.reset();
    selectedFiles = [];
    renderPreviews();
    completion.hidden = true;
    form.hidden = false;
    prefillTracking();
    installPublicCandidateCleanDates();
    ["candidate1","candidate2","candidate3"].forEach((name) => syncCleanDateField(form.elements[name]));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  initialize();

  async function loadPublicSiteProfile() {
    const region = document.querySelector("#public-announcements");
    if (!region) return;
    try {
      const response = await Green.api("/api/public/site-profile?target=public_form");
      const profile = response.data || {};
      document.querySelectorAll("[data-facility-name]").forEach((node) => {
        if (profile.facilityName) node.textContent = profile.facilityName;
      });
      const items = profile.announcements || [];
      region.hidden = items.length === 0;
      region.innerHTML = items.map((item) =>
        `<article class="green12-public-notice${item.isImportant ? " is-important" : ""}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.body).replace(/\n/g,"<br>")}</p>${item.period ? `<small>${escapeHtml(item.period)}</small>` : ""}</article>`
      ).join("");
    } catch (error) {
      console.warn(`[DPRO GREEN] ${VERSION} public announcement load failed`, error);
      region.hidden = true;
    }
  }

  loadPublicSiteProfile();
  console.info(`[DPRO GREEN] ${VERSION} active`);
})();
