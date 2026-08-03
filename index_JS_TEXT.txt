(() => {
  "use strict";
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

  async function initialize() {
    bindEvents();
    prefillTracking();
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  initialize();
})();
