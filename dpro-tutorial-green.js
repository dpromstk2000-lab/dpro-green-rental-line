(() => {
  "use strict";
  const VERSION = "GREEN-TUTORIAL-R3-20260822";
  const CONTENT_URL = "dpro-tutorial-content-green.json?v=GREEN-R2-LOCK-20260822";
  const STATE_KEY = "dpro:tutorial:green:first10:v1";
  const TARGETS = Object.freeze({
    "green.owner.login": ["owner.html", "#login-form"],
    "green.owner.dashboard": ["owner.html", '[data-view-panel="dashboard"] .owner-heading'],
    "green.owner.inquiries": ["owner.html", '[data-view-panel="inquiries"] .owner-heading'],
    "green.owner.leads": ["owner.html", '[data-view-panel="leads"] .owner-heading'],
    "green.owner.site-checks": ["owner.html", '[data-view-panel="site-checks"] .owner-heading'],
    "green.owner.customers": ["owner.html", '[data-view-panel="customers"] .owner-heading'],
    "green.owner.sites": ["owner.html", '[data-view-panel="sites"] .owner-heading'],
    "green.owner.contracts": ["owner.html", '[data-view-panel="contracts"] .owner-heading'],
    "green.owner.assets": ["owner.html", '[data-view-panel="assets"] .owner-heading'],
    "green.owner.installations": ["owner.html", '[data-view-panel="installations"] .owner-heading'],
    "green.owner.visits": ["owner.html", '[data-view-panel="visits"] .owner-heading'],
    "green.owner.reports": ["owner.html", '[data-view-panel="reports"] .owner-heading'],
    "green.owner.replacements": ["owner.html", '[data-view-panel="replacements"] .owner-heading'],
    "green.owner.messages": ["owner.html", '[data-view-panel="messages"] .owner-heading'],
    "green.owner.stock": ["owner.html", '[data-view-panel="stock"] .owner-heading'],
    "green.owner.facility": ["owner.html", '[data-view-panel="facility-settings"] .owner-heading'],
    "green.owner.calendar": ["owner.html", '[data-view-panel="business-calendar"] .owner-heading'],
    "green.owner.announcements": ["owner.html", '[data-view-panel="announcements"] .owner-heading'],
    "green.owner.features": ["owner.html", '[data-view-panel="features"] .owner-heading'],
    "green.ipad.board": ["owner-ipad.html", "#ipad-board"],
    "green.staff.route": ["staff.html", "#staff-route-list"],
    "green.staff.visit-detail": ["staff.html", "#staff-dialog-body"],
    "green.staff.sync": ["staff.html", "#staff-sync-panel"],
    "green.member.portal": ["member.html", "#portal"],
    "green.member.nav": ["member.html", ".portal-nav"],
    "green.public.form": ["index.html", "#inquiry-form"],
    "green.contact.inbox": ["contact-green.html", "#inbox"]
  });
  const OWNER_VIEW = Object.freeze({
    "green.owner.dashboard":"dashboard","green.owner.inquiries":"inquiries","green.owner.leads":"leads","green.owner.site-checks":"site-checks",
    "green.owner.customers":"customers","green.owner.sites":"sites","green.owner.contracts":"contracts","green.owner.assets":"assets",
    "green.owner.installations":"installations","green.owner.visits":"visits","green.owner.reports":"reports","green.owner.replacements":"replacements",
    "green.owner.messages":"messages","green.owner.stock":"stock","green.owner.facility":"facility-settings","green.owner.calendar":"business-calendar",
    "green.owner.announcements":"announcements","green.owner.features":"features"
  });
  let content = null;
  let cardEl = null;
  let targetEl = null;
  let menuEl = null;

  function routeName() { return location.pathname.split("/").pop() || "index.html"; }
  function queryWith(extra = {}) {
    const q = new URLSearchParams();
    if (new URLSearchParams(location.search).get("demo") === "1") q.set("demo", "1");
    Object.entries(extra).forEach(([k,v]) => v == null ? q.delete(k) : q.set(k, String(v)));
    const s = q.toString(); return s ? `?${s}` : "";
  }
  function safeJson(raw, fallback) { try { return JSON.parse(raw); } catch { return fallback; } }
  function readState() { return safeJson(localStorage.getItem(STATE_KEY), { index:0, active:false, completed:false, skipped:[] }); }
  function writeState(next) { localStorage.setItem(STATE_KEY, JSON.stringify(next)); return next; }
  function currentCards() { return content?.first10?.cards || []; }
  function currentChapters() { return content?.first10?.chapters || []; }
  function chapterFor(card) { return currentChapters().find(ch => ch.id === card.chapter); }
  function routeTo(route, extra = {}) { location.href = `${route}${queryWith(extra)}`; }
  function visible(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== "hidden"); }

  function bindTargets() {
    const route = routeName();
    Object.entries(TARGETS).forEach(([id,[targetRoute,selector]]) => {
      if (route !== targetRoute) return;
      const el = document.querySelector(selector);
      if (el) el.setAttribute("data-dpro-guide-id", id);
    });
  }

  function clearTarget() {
    if (!targetEl) return;
    targetEl.classList.remove("dpro-guide-target","dpro-guide-spotlight");
    targetEl = null;
  }

  function ownerViewForTarget(id) {
    if (routeName() !== "owner.html") return;
    const view = OWNER_VIEW[id];
    if (!view) return;
    const panel = document.querySelector(`[data-view-panel="${CSS.escape(view)}"]`);
    if (panel && visible(panel)) return;
    const nav = document.querySelector(`.owner-nav [data-view="${CSS.escape(view)}"]`);
    if (nav && typeof nav.click === "function") nav.click();
  }

  function highlightTarget(id) {
    clearTarget();
    ownerViewForTarget(id);
    const record = TARGETS[id];
    if (!record || record[0] !== routeName()) return { found:false, reason:"この画面では対象箇所を表示できません。" };
    const el = document.querySelector(record[1]);
    if (!el) return { found:false, reason:"対象箇所がまだ読み込まれていません。画面の操作を続けると表示されます。" };
    el.setAttribute("data-dpro-guide-id", id);
    if (!visible(el)) return { found:false, reason:"対象箇所はログインまたは詳細画面を開いた後に表示されます。チュートリアルは業務操作を自動実行しません。" };
    targetEl = el;
    el.classList.add("dpro-guide-target","dpro-guide-spotlight");
    try { el.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"}); } catch { el.scrollIntoView(); }
    return { found:true, el };
  }

  function closeCard(preserve = true) {
    clearTarget();
    cardEl?.remove(); cardEl = null;
    if (preserve) { const st = readState(); st.active = false; writeState(st); }
  }

  function cardPosition(el) {
    if (!el) return "";
    const r = el.getBoundingClientRect();
    return r.top > innerHeight * .52 ? "is-top" : "";
  }

  function renderCard(index) {
    const cards = currentCards();
    if (!cards.length) return;
    const safeIndex = Math.min(Math.max(0,index), cards.length - 1);
    const card = cards[safeIndex];
    const st = readState(); st.index = safeIndex; st.active = true; writeState(st);
    if (routeName() !== card.route) { routeTo(card.route, {dpro_tutorial:"1"}); return; }
    const target = highlightTarget(card.target);
    clearTarget();
    const resolved = highlightTarget(card.target);
    cardEl?.remove();
    const chapter = chapterFor(card);
    const el = document.createElement("section");
    el.className = `dpro-guide-card ${resolved.found ? cardPosition(resolved.el) : ""}`;
    el.setAttribute("role","dialog"); el.setAttribute("aria-modal","false"); el.setAttribute("aria-labelledby","dpro-guide-title");
    const skipped = st.skipped?.includes(card.id);
    el.innerHTML = `<div class="dpro-guide-card__inner">
      <div class="dpro-guide-card__meta"><span>FIRST 10 MINUTES</span><span>${safeIndex+1} / ${cards.length}</span></div>
      <div class="dpro-guide-card__chapter">${escapeHtml(chapter?.title || "操作ガイド")}</div>
      <h2 id="dpro-guide-title">${escapeHtml(card.title)}</h2>
      <p>${escapeHtml(card.body)}</p>
      <div class="dpro-guide-card__action">やること：${escapeHtml(card.action)}</div>
      ${resolved.found ? "" : `<div class="dpro-guide-card__fallback">${escapeHtml(resolved.reason)}<br>画面はそのまま利用できます。</div>`}
      <div class="dpro-guide-card__progress"><span style="width:${((safeIndex+1)/cards.length)*100}%"></span></div>
      <div class="dpro-guide-card__controls">
        <button type="button" data-back ${safeIndex===0?"disabled":""}>戻る</button>
        <button type="button" data-skip>${skipped?"スキップ済み":"このカードをスキップ"}</button>
        <button type="button" data-next>${safeIndex===cards.length-1?"完了":"次へ"}</button>
      </div>
      <div class="dpro-guide-card__tools"><button type="button" data-close>閉じる（続きから再開）</button><button type="button" data-replay>最初から</button><button type="button" data-guide>Guide Center</button></div>
    </div>`;
    document.body.append(el); cardEl = el;
    el.querySelector("[data-back]")?.addEventListener("click",()=>goTo(safeIndex-1));
    el.querySelector("[data-next]")?.addEventListener("click",()=>{ if(safeIndex===cards.length-1){const s=readState();s.active=false;s.completed=true;s.index=cards.length-1;writeState(s);closeCard(false);openMenu();}else goTo(safeIndex+1); });
    el.querySelector("[data-skip]")?.addEventListener("click",()=>{const s=readState();s.skipped=Array.from(new Set([...(s.skipped||[]),card.id]));writeState(s); if(safeIndex===cards.length-1){s.active=false;s.completed=true;writeState(s);closeCard(false);}else goTo(safeIndex+1);});
    el.querySelector("[data-close]")?.addEventListener("click",()=>closeCard(true));
    el.querySelector("[data-replay]")?.addEventListener("click",replay);
    el.querySelector("[data-guide]")?.addEventListener("click",()=>routeTo("guide-center.html"));
    setTimeout(()=>el.querySelector("[data-next]")?.focus(),50);
  }

  function goTo(index) {
    const cards = currentCards(); if (!cards.length) return;
    const clamped = Math.min(Math.max(index,0),cards.length-1);
    const st=readState();st.index=clamped;st.active=true;writeState(st);
    const card=cards[clamped]; if(routeName()!==card.route) routeTo(card.route,{dpro_tutorial:"1"}); else renderCard(clamped);
  }
  function start() { writeState({index:0,active:true,completed:false,skipped:[]}); goTo(0); }
  function resume() { const s=readState(); s.active=true; writeState(s); goTo(s.index||0); }
  function replay() { start(); }

  function buildMenu() {
    if (document.getElementById("dpro-guide-launcher")) return;
    const launch=document.createElement("button"); launch.type="button"; launch.id="dpro-guide-launcher"; launch.className="dpro-guide-launcher"; launch.innerHTML='<span class="dpro-guide-dot"></span><span>操作ガイド</span>'; launch.setAttribute("aria-expanded","false"); launch.setAttribute("aria-controls","dpro-guide-menu");
    const menu=document.createElement("div"); menu.id="dpro-guide-menu"; menu.className="dpro-guide-menu"; menu.hidden=true; menu.innerHTML='<strong>DPRO GREEN 操作ガイド</strong><button type="button" class="primary" data-first10></button><a data-center>Guide Centerを開く</a><button type="button" data-replay-menu>First10を最初から見る</button>';
    document.body.append(launch,menu); menuEl=menu;
    const refreshLabel=()=>{const s=readState(); const b=menu.querySelector("[data-first10]"); b.textContent=s.completed?"First10をもう一度見る":s.index>0?`First10を続きから（${Math.min(s.index+1,15)}/15）`:"First10をはじめる";};
    refreshLabel();
    menu.querySelector("[data-center]").href=`guide-center.html${queryWith()}`;
    launch.addEventListener("click",()=>{menu.hidden=!menu.hidden;launch.setAttribute("aria-expanded",String(!menu.hidden));refreshLabel();});
    menu.querySelector("[data-first10]").addEventListener("click",()=>{menu.hidden=true; const s=readState(); s.completed?replay():s.index>0?resume():start();});
    menu.querySelector("[data-replay-menu]").addEventListener("click",()=>{menu.hidden=true;replay();});
  }
  function openMenu(){ if(menuEl){menuEl.hidden=false;document.getElementById("dpro-guide-launcher")?.setAttribute("aria-expanded","true");} }

  function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
  async function loadContent(){const r=await fetch(CONTENT_URL,{cache:"no-store"});if(!r.ok)throw new Error("guide content load failed");return r.json();}
  function externalSpotlight(){const id=new URLSearchParams(location.search).get("dpro_guide");if(!id)return; const result=highlightTarget(id); if(result.found) setTimeout(clearTarget,6500);}
  async function init(){
    bindTargets(); buildMenu();
    try{content=await loadContent();}catch(error){console.warn("[DPRO Tutorial]",error);return;}
    bindTargets(); externalSpotlight();
    const q=new URLSearchParams(location.search); const s=readState();
    if(q.get("dpro_tutorial")==="1" || s.active) renderCard(s.index||0);
    document.addEventListener("keydown",e=>{if(e.key==="Escape"&&cardEl){e.preventDefault();closeCard(true);}});
    window.DPRO_TUTORIAL_GREEN=Object.freeze({version:VERSION,start,resume,replay,openGuide:()=>routeTo("guide-center.html")});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true}); else init();
})();
