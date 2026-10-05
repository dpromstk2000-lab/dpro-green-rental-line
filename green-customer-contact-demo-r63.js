(() => {
  "use strict";

  const VERSION = "GREEN-CUSTOMER-CONTACT-DEMO-R1.0-FC-COMMON-20261005";
  if (window.__GREEN_CUSTOMER_CONTACT_DEMO_R63__ === VERSION) return;
  window.__GREEN_CUSTOMER_CONTACT_DEMO_R63__ = VERSION;

  const state = { initialized:false, loading:false, items:[], filtered:[], selected:null, channel:"all", query:"" };
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (m) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const text = (value, fallback="") => String(value ?? "").trim() || fallback;

  function fmt(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return new Intl.DateTimeFormat("ja-JP", { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }).format(d);
  }

  function coreApi(path, options) {
    if (!window.Green?.api) throw new Error("GREEN Core APIを利用できません。");
    return window.Green.api(path, options);
  }

  function panel() { return $('[data-view-panel="inquiries"]'); }
  function channelOf(row) {
    return row.source === "website" ? "website" : row.source === "line" ? "line" : row.source === "phone" ? "phone" : row.source || "website";
  }
  function channelLabel(ch) { return ch === "website" ? "WEB" : ch === "line" ? "LINE" : ch === "phone" ? "電話" : String(ch || "受付"); }
  function statusLabel(status) {
    const map = { new:"新着", contacted:"連絡済み", site_check_scheduling:"現地確認調整中", site_check_scheduled:"現地確認予定", planning:"計画中", won:"成約", lost:"失注", on_hold:"保留" };
    return map[status] || status || "受付";
  }

  function renameNavigation() {
    const inquiry = $('[data-view="inquiries"]');
    if (inquiry) inquiry.innerHTML = "<span>✉</span>顧客対応";
    const leads = $('[data-view="leads"]');
    if (leads) leads.innerHTML = "<span>↗</span>営業案件";
    const messages = $('[data-view="messages"]');
    if (messages) messages.innerHTML = "<span>送</span>通知・送信履歴";
    const legacy = document.getElementById("green-contact-menu");
    if (legacy) legacy.hidden = true;
  }

  function ensureLegacyContactHidden() {
    renameNavigation();
    const nav = document.querySelector(".owner-nav");
    if (!nav || nav.dataset.gccDemoObserver === VERSION) return;
    nav.dataset.gccDemoObserver = VERSION;
    new MutationObserver(renameNavigation).observe(nav, { childList:true, subtree:true });
  }

  function ensureUi() {
    if (state.initialized) return;
    const root = panel();
    if (!root) return;
    state.initialized = true;
    root.innerHTML = `
      <div class="owner-heading gcc-head">
        <div><p class="eyebrow">CUSTOMER CONTACT / FC COMMON DEMO</p><h2>顧客対応</h2><p>WEB・LINE・電話の相談を一つの窓口で確認し、必要なものだけ営業案件へ進めます。</p></div>
        <button class="btn btn--primary" id="gcc-phone">＋ 電話受付</button>
      </div>
      <div class="gcc-mail-wait">
        <strong>DEMO表示</strong>
        <span>返信UI・添付・営業案件化の操作体験用です。LINE・メールは外部へ実送信しません。</span>
      </div>
      <div class="gcc-toolbar">
        <div class="gcc-tabs" role="tablist" aria-label="受付チャネル">
          <button type="button" data-gcc-channel="all" class="is-active">すべて <b id="gcc-count-all">0</b></button>
          <button type="button" data-gcc-channel="website">WEB <b id="gcc-count-web">0</b></button>
          <button type="button" data-gcc-channel="line">LINE <b id="gcc-count-line">0</b></button>
          <button type="button" data-gcc-channel="phone">電話 <b id="gcc-count-phone">0</b></button>
        </div>
        <label class="gcc-search">検索<input id="gcc-search" placeholder="氏名・会社名・受付番号・相談内容"></label>
        <button class="btn btn--secondary" id="gcc-reload">再表示</button>
      </div>
      <div class="gcc-layout">
        <section class="gcc-list-panel"><div class="gcc-list" id="gcc-list"><div class="gcc-empty">読み込み中です…</div></div></section>
        <section class="gcc-detail-panel" id="gcc-detail" aria-live="polite"><div class="gcc-detail-empty"><strong>顧客対応を選択してください</strong><span>WEB・LINE・電話の内容と対応操作がここに表示されます。</span></div></section>
      </div>`;

    $("#gcc-phone")?.addEventListener("click", () => $('[data-view-panel="dashboard"] [data-action="phone-inquiry"]')?.click());
    $("#gcc-reload")?.addEventListener("click", () => load(true).catch(showError));
    $("#gcc-search")?.addEventListener("input", (e) => { state.query = e.target.value.trim().toLowerCase(); applyFilter(); });
    $$('[data-gcc-channel]', root).forEach((b) => b.addEventListener("click", () => {
      state.channel = b.dataset.gccChannel || "all";
      $$('[data-gcc-channel]', root).forEach((x) => x.classList.toggle("is-active", x === b));
      applyFilter();
    }));
  }

  async function activate() {
    $$('[data-view]').forEach((b) => b.classList.toggle("is-active", b.dataset.view === "inquiries"));
    $$('[data-view-panel]').forEach((p) => p.classList.toggle("is-active", p.dataset.viewPanel === "inquiries"));
    const title = $("#view-title"); if (title) title.textContent = "顧客対応";
    ensureUi();
    await load();
  }

  async function load(force=false) {
    if (state.loading && !force) return;
    state.loading = true;
    const list = $("#gcc-list"); if (list) list.innerHTML = '<div class="gcc-empty">顧客対応を確認しています…</div>';
    try {
      const r = await coreApi("/api/admin/inquiries?limit=200");
      const rows = Array.isArray(r?.data?.items) ? r.data.items : [];
      state.items = rows.map((row) => ({
        key:`inquiry:${row.id}`, id:row.id, channel:channelOf(row), title:row.company_name || row.contact_name || "お問い合わせ",
        sub:row.contact_name || row.phone || row.email || "", preview:row.inquiry_text || row.inquiry_category || "相談受付",
        status:row.status || "new", at:row.updated_at || row.created_at, raw:row
      })).sort((a,b) => new Date(b.at || 0) - new Date(a.at || 0));
      updateCounts(); applyFilter();
      if (state.selected) {
        const same = state.items.find((x) => x.key === state.selected.key);
        if (same) await selectItem(same);
      }
    } finally { state.loading = false; }
  }

  function updateCounts() {
    const count = (ch) => state.items.filter((x) => ch === "all" || x.channel === ch).length;
    const ids = [["#gcc-count-all","all"],["#gcc-count-web","website"],["#gcc-count-line","line"],["#gcc-count-phone","phone"]];
    ids.forEach(([id,ch]) => { const el=$(id); if(el) el.textContent=String(count(ch)); });
  }

  function applyFilter() {
    const q = state.query;
    state.filtered = state.items.filter((item) => {
      if (state.channel !== "all" && item.channel !== state.channel) return false;
      if (!q) return true;
      return `${item.title} ${item.sub} ${item.preview} ${item.raw?.reception_number || ""}`.toLowerCase().includes(q);
    });
    renderList();
  }

  function renderList() {
    const list=$("#gcc-list"); if(!list) return;
    if(!state.filtered.length){ list.innerHTML='<div class="gcc-empty">該当する顧客対応はありません。</div>'; return; }
    list.innerHTML=state.filtered.map((item)=>`
      <button type="button" class="gcc-item${state.selected?.key===item.key?" is-active":""}" data-gcc-key="${esc(item.key)}">
        <span class="gcc-item-top"><span class="gcc-channel is-${esc(item.channel)}">${esc(channelLabel(item.channel))}</span><time>${esc(fmt(item.at))}</time></span>
        <strong>${esc(item.title)}</strong>${item.sub?`<span class="gcc-sub">${esc(item.sub)}</span>`:""}
        <span class="gcc-preview">${esc(item.preview)}</span><span class="gcc-status">${esc(statusLabel(item.status))}</span>
      </button>`).join("");
    $$('[data-gcc-key]',list).forEach((b)=>b.addEventListener("click",()=>{ const item=state.items.find((x)=>x.key===b.dataset.gccKey); if(item) selectItem(item).catch(showError); }));
  }

  const MAX_FILES=4, MAX_BYTES=10*1024*1024;
  function formatBytes(n){ n=Number(n||0); return n>=1024*1024?`${(n/(1024*1024)).toFixed(1)} MB`:`${Math.max(1,Math.round(n/1024))} KB`; }
  function installComposer({form,textarea,input,filesBox,expandButton,countBox}) {
    let files=[], urls=[];
    const revoke=()=>{urls.forEach((u)=>{try{URL.revokeObjectURL(u)}catch{}});urls=[];};
    const grow=()=>{ if(countBox) countBox.textContent=`${textarea?.value?.length||0} / 5,000文字`; if(!textarea||form?.classList.contains("is-expanded")) return; textarea.style.height="auto"; textarea.style.height=`${Math.min(320,Math.max(150,textarea.scrollHeight))}px`; };
    const render=()=>{ if(!filesBox)return; revoke(); filesBox.innerHTML=""; files.forEach((file,index)=>{ const row=document.createElement("div"); row.className="gcc-selected-attachment"; let visual=`<span class="gcc-selected-attachment__thumb">資料</span>`; if(file.type.startsWith("image/")){const u=URL.createObjectURL(file);urls.push(u);visual=`<img class="gcc-selected-attachment__thumb" src="${esc(u)}" alt="">`;} row.innerHTML=`${visual}<div class="gcc-selected-attachment__meta"><strong>${esc(file.name)}</strong><small>${esc(file.type||"file")} ・ ${esc(formatBytes(file.size))}</small></div><button type="button" class="gcc-selected-attachment__remove">削除</button>`; row.querySelector("button")?.addEventListener("click",()=>{files.splice(index,1);render();}); filesBox.appendChild(row); }); };
    input?.addEventListener("change",(e)=>{ const picked=[...(e.target.files||[])]; e.target.value=""; for(const file of picked){ if(files.length>=MAX_FILES){window.Green?.toast?.("添付は最大4件です。","error");break;} if(file.size>MAX_BYTES){window.Green?.toast?.(`${file.name} は10MBを超えています。`,"error");continue;} files.push(file);} render(); });
    expandButton?.addEventListener("click",()=>{form?.classList.toggle("is-expanded"); const expanded=form?.classList.contains("is-expanded"); expandButton.textContent=expanded?"↙ 元の大きさ":"↗ 返信欄を拡大"; if(!expanded)grow(); textarea?.focus();});
    textarea?.addEventListener("input",grow); grow(); render();
    return { files:()=>[...files], clear:()=>{files=[];render();if(textarea){textarea.value="";grow();}} };
  }

  async function selectItem(item) {
    state.selected=item; renderList();
    const detail=$("#gcc-detail"); if(!detail)return;
    detail.innerHTML='<div class="gcc-detail-empty">内容を読み込んでいます…</div>';
    const result=await coreApi(`/api/admin/inquiries/${encodeURIComponent(item.id)}`);
    const inquiry=result?.data?.inquiry||item.raw||{}; const photos=Array.isArray(result?.data?.photos)?result.data.photos:[];
    const email=text(inquiry.email), phone=text(inquiry.phone), isLine=item.channel==="line";
    detail.innerHTML=`
      <div class="gcc-detail-head"><div><span class="gcc-channel is-${esc(item.channel)}">${esc(channelLabel(item.channel))}</span><h3>${esc(inquiry.company_name||inquiry.contact_name||"お問い合わせ")}</h3><p>${esc(inquiry.reception_number||"")} / DEMO</p></div><span class="gcc-status">${esc(statusLabel(inquiry.status))}</span></div>
      <div class="gcc-facts"><div><small>担当者</small><strong>${esc(inquiry.contact_name||"未設定")}</strong></div><div><small>電話</small><strong>${esc(phone||"未設定")}</strong></div><div><small>メール</small><strong>${esc(email||"未設定")}</strong></div><div><small>受付元</small><strong>${esc(channelLabel(item.channel))}</strong></div></div>
      <section class="gcc-message-card"><small>相談内容</small><p>${esc(inquiry.inquiry_text||"内容なし").replace(/\n/g,"<br>")}</p></section>
      ${photos.length?`<section class="gcc-photo-grid">${photos.map((p)=>p.signed_url?`<a href="${esc(p.signed_url)}" target="_blank" rel="noopener"><img src="${esc(p.signed_url)}" alt="問い合わせ写真"></a>`:"").join("")}</section>`:""}
      ${(email||isLine)?`<form class="gcc-reply" id="gcc-demo-reply"><div class="gcc-reply-toolbar"><label class="gcc-reply-tool">＋ 添付<input id="gcc-demo-file" type="file" multiple hidden accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.pptx,.txt,.csv"></label><button class="gcc-reply-tool" id="gcc-demo-expand" type="button">↗ 返信欄を拡大</button><span class="gcc-reply-count" id="gcc-demo-count">0 / 5,000文字</span></div><label>${isLine?"LINEへ返信（DEMO）":"WEBメールへ返信（DEMO）"}<textarea id="gcc-demo-text" maxlength="5000" placeholder="返信内容を入力してください"></textarea></label><div class="gcc-selected-attachments" id="gcc-demo-files"></div><div class="gcc-reply-foot"><span>DEMOのため外部送信しません。添付は最大4件／各10MB。</span><button class="btn btn--primary" type="submit">送信確認（DEMO）</button></div></form>`:""}
      <div class="gcc-actions">${phone?`<a class="btn btn--secondary" href="tel:${esc(phone.replace(/[^\d+]/g,""))}">電話する</a>`:""}<button class="btn btn--primary" type="button" id="gcc-lead">営業案件へ進める</button></div>`;

    if(email||isLine){
      const composer=installComposer({form:$("#gcc-demo-reply"),textarea:$("#gcc-demo-text"),input:$("#gcc-demo-file"),filesBox:$("#gcc-demo-files"),expandButton:$("#gcc-demo-expand"),countBox:$("#gcc-demo-count")});
      $("#gcc-demo-reply")?.addEventListener("submit",(e)=>{e.preventDefault();const body=$("#gcc-demo-text")?.value.trim()||"";const count=composer.files().length;if(!body&&!count)return;if(!confirm(`DEMO確認です。外部には送信しません。\n\n${body||"（本文なし）"}${count?`\n添付：${count}件`:""}`))return;composer.clear();window.Green?.toast?.("DEMO送信確認が完了しました。外部送信はしていません。","success");});
    }
    $("#gcc-lead")?.addEventListener("click",()=>createLead(item));
  }

  async function createLead(item) {
    const button=$("#gcc-lead"); if(button){button.disabled=true;button.textContent="作成中…";}
    try{
      const result=await coreApi("/api/admin/leads",{method:"POST",json:{inquiryId:item.id,status:item.raw?.status||"new"}});
      window.Green?.toast?.(result?.data?.reused?"既存の営業案件を開きます。":"営業案件を作成しました。","success");
      const leadNav=$('[data-view="leads"]'); if(leadNav)setTimeout(()=>leadNav.click(),250);
    }catch(error){window.Green?.toast?.(`営業案件を作成できませんでした。${error.message}`,"error");if(button){button.disabled=false;button.textContent="営業案件へ進める";}}
  }

  function showError(error){ console.error("[GREEN CUSTOMER CONTACT DEMO]",error); const list=$("#gcc-list"); if(list)list.innerHTML=`<div class="gcc-error">顧客対応を読み込めませんでした。${esc(error?.message||"")}</div>`; window.Green?.toast?.("顧客対応の読み込みに失敗しました。","error"); }

  document.addEventListener("click",(event)=>{
    const button=event.target.closest?.('[data-view="inquiries"]'); if(!button)return;
    event.preventDefault(); event.stopImmediatePropagation(); activate().catch(showError);
  },true);

  function init(){ ensureLegacyContactHidden(); const params=new URLSearchParams(location.search); if(params.get("view")==="customer-contact"||location.hash==="#customer-contact")setTimeout(()=>activate().catch(showError),0); }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();
