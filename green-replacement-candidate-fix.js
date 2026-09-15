(() => {
  "use strict";

  const VERSION = "GREEN-REPLACEMENT-CANDIDATE-FIX-R1.0-20260915";
  if (!/\/owner\.html$/.test(location.pathname)) return;

  document.documentElement.dataset.greenReplacementCandidateFix = VERSION;

  let plantPromise = null;

  async function loadPlants() {
    if (!window.Green?.api) throw new Error("GREEN APIの準備が完了していません。");
    if (!plantPromise) {
      plantPromise = window.Green.api("/api/admin/assets?type=plant&limit=500")
        .then((result) => result?.data?.plants || [])
        .catch((error) => {
          plantPromise = null;
          throw error;
        });
    }
    return plantPromise;
  }

  function isAllowedCandidate(item, currentSelectedId) {
    if (!item || item.is_active === false) return false;
    if (String(item.current_location_type || "") !== "warehouse") return false;
    if (["inventory", "reusable"].includes(String(item.asset_status || ""))) return true;
    return Boolean(currentSelectedId)
      && String(item.id || "") === currentSelectedId
      && String(item.asset_status || "") === "replacement_planned";
  }

  function setNote(form, text, isError = false) {
    const select = form.elements.newPlantAssetId;
    const label = select?.closest("label");
    if (!label) return;
    let note = label.querySelector(".green-replacement-candidate-note");
    if (!note) {
      note = document.createElement("small");
      note.className = "green-replacement-candidate-note";
      label.append(note);
    }
    note.textContent = text;
    note.style.display = "block";
    note.style.marginTop = "6px";
    note.style.lineHeight = "1.5";
    note.style.color = isError ? "#a12622" : "#52635d";
  }

  async function filterApprovalCandidates(form) {
    if (!form || form.dataset.greenReplacementCandidateFix === VERSION) return;

    const select = form.elements.newPlantAssetId;
    const saveButton = document.querySelector("#save-replacement-approval");
    if (!select) return;

    form.dataset.greenReplacementCandidateFix = "loading";
    if (saveButton) saveButton.disabled = true;
    select.disabled = true;
    setNote(form, "安全な代替植物候補を確認しています…");

    const currentSelectedId = String(select.value || "");

    try {
      const plants = await loadPlants();
      const allowedIds = new Set(
        plants
          .filter((item) => isAllowedCandidate(item, currentSelectedId))
          .map((item) => String(item.id || ""))
          .filter(Boolean)
      );

      Array.from(select.options).forEach((option) => {
        if (option.value && !allowedIds.has(String(option.value))) option.remove();
      });

      if (currentSelectedId && !allowedIds.has(currentSelectedId)) select.value = "";

      form.dataset.greenReplacementCandidateFix = VERSION;
      select.disabled = false;
      if (saveButton) saveButton.disabled = false;
      setNote(form, "倉庫にあり、未予約の「在庫」「再利用可」の植物だけを表示しています。");
    } catch (error) {
      Array.from(select.options).forEach((option) => {
        if (option.value) option.remove();
      });
      select.value = "";
      select.disabled = true;
      if (saveButton) saveButton.disabled = true;
      form.dataset.greenReplacementCandidateFix = "failed";
      setNote(form, "代替植物候補を安全に確認できませんでした。再読み込みしてから操作してください。", true);
      window.Green?.toast?.(error?.message || "代替植物候補を確認できませんでした。", "error");
    }
  }

  function apply() {
    const form = document.querySelector("#replacement-approve-form");
    if (!form) return;
    if (form.dataset.greenReplacementCandidateFix === VERSION || form.dataset.greenReplacementCandidateFix === "loading") return;
    filterApprovalCandidates(form);
  }

  const dialog = document.querySelector("#owner-dialog");
  if (dialog) {
    const observer = new MutationObserver(apply);
    observer.observe(dialog, { childList: true, subtree: true });
  }

  apply();
  console.info(`[DPRO GREEN] ${VERSION} active`);
})();
