(() => {
  "use strict";
  const VERSION = "GREEN-DEMO-FC-COMMON-R63-20261005";
  if (window.__DPRO_GREEN_DEMO_FC_COMMON__ === VERSION) return;
  window.__DPRO_GREEN_DEMO_FC_COMMON__ = VERSION;

  const CAPABILITIES = Object.freeze({
    atlasCatalog: true,
    atlasImageWrite: true,
    staffAuthR1: true,
    shopV3Backend: false,
    contactStableR3: true,
    customerContactR16Demo: true,
    liffRoutingR2: true,
    ownerIdle60: true,
    nativeDateTime: true,
    siteCheckNativeTabs: true,
    visitRuleR3: true,
    finalBrushupR1: true,
    potModelDedupeR1: true,
    memberReportDateR1: true
  });
  window.DPRO_GREEN_DEMO_FC_COMMON = Object.freeze({ version: VERSION, capabilities: CAPABILITIES });

  function hasScript(src) {
    return [...document.scripts].some((s) => {
      const value = String(s.getAttribute("src") || "").split("?")[0];
      return value === src || value.endsWith(`/${src}`);
    });
  }
  function hasCss(href) {
    return [...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => {
      const value = String(l.getAttribute("href") || "").split("?")[0];
      return value === href || value.endsWith(`/${href}`);
    });
  }
  function addJs(key, src, version = VERSION) {
    if (document.querySelector(`script[data-green-fc-common="${key}"]`) || hasScript(src)) return;
    const s=document.createElement("script");
    s.src=`${src}?v=${encodeURIComponent(version)}`;
    s.defer=true;
    s.dataset.greenFcCommon=key;
    document.head.appendChild(s);
  }
  function addCss(key, href, version = VERSION) {
    if (document.querySelector(`link[data-green-fc-common="${key}"]`) || hasCss(href)) return;
    const l=document.createElement("link");
    l.rel="stylesheet";
    l.href=`${href}?v=${encodeURIComponent(version)}`;
    l.dataset.greenFcCommon=key;
    document.head.appendChild(l);
  }

  function owner() {
    addJs("owner-species","green-owner-species-list-r1.js","GREEN-OWNER-ATLAS-SPECIES-MODELS-R1.2-20261003");
    addJs("owner-atlas-status","green-owner-atlas-status-r1.js","GREEN-OWNER-ATLAS-STATUS-R1.0-20261003");
    addJs("owner-session-idle60","green-owner-session-idle60-r1.js","GREEN-OWNER-SESSION-IDLE60-R1.2-20260930");
    addJs("return-location","green-return-location-fix-r1.js","GREEN-RETURN-LOCATION-FIX-R1.0-20261003");
    addJs("final-brushup","green-final-brushup-r1.js","GREEN-FINAL-BRUSHUP-R1.1-20261003");
    addJs("site-check-tabs","green-site-check-native-tabs-r3.js","GREEN-SITE-CHECK-NATIVE-TABS-R3.0-20260929");
    addJs("date-picker","green-date-picker-fix-r1.js","GREEN-DATE-PICKER-R3.1-NATIVE-TABS-20260929");
    addJs("pot-model-dedupe","green-owner-pot-model-dedupe-r1.js","GREEN-OWNER-POT-MODEL-DEDUPE-R1.0-20261001");
    addJs("visit-rule","green-visit-rule-monthly-count-r3.js","GREEN-VISIT-RULE-MONTHLY-COUNT-R3.0-20261001");
    addJs("datetime","green-datetime-standard-r1.js","GREEN-DATETIME-STANDARD-R1.3-CUSTOM-PICKER-20261003");
    addJs("contact-primary-ui","green-contact-primary-ui-r1.js","GREEN-CONTACT-PRIMARY-UI-R1.6-20261002");
    if (CAPABILITIES.customerContactR16Demo) {
      addCss("customer-contact-r16-demo-css","green-customer-contact-r1.css","GREEN-CUSTOMER-CONTACT-DEMO-R63-20261005");
      addJs("customer-contact-r16-demo-js","green-customer-contact-demo-r63.js","GREEN-CUSTOMER-CONTACT-DEMO-R1.0-20261005");
    }
    if (CAPABILITIES.atlasImageWrite) addJs("atlas-image-manager","green-owner-atlas-image-manager-r1.js","GREEN-OWNER-ATLAS-IMAGE-MANAGER-R1.0-20261004");
    if (CAPABILITIES.staffAuthR1) addJs("staff-auth","green-staff-auth-r1.js","GREEN-STAFF-AUTH-OWNER-R1.0-20261001");
  }

  function member() {
    addJs("member-report-date","green-member-report-date-r1.js","GREEN-MEMBER-REPORT-DATE-R1.0-20261001");
    addJs("member-datetime","green-datetime-standard-r1.js","GREEN-DATETIME-STANDARD-R1.3-CUSTOM-PICKER-20261003");
    if (CAPABILITIES.liffRoutingR2) addJs("liff-router","green-liff-richmenu-router-r2.js","GREEN-LIFF-RICHMENU-ROUTER-R2-20260927");
  }

  function contact() {
    addCss("contact-standard-css","green-contact-standard-r3.css","DPRO-CONTACT-STANDARD-R3.4-20260927");
    addCss("contact-zero-jump-css","green-contact-zero-jump-r4.css","DPRO-CONTACT-ZERO-JUMP-R4.1-20260927");
    addJs("contact-standard-js","green-contact-standard-r3.js","DPRO-CONTACT-STANDARD-R3.4-20260927");
    addJs("contact-zero-jump-js","green-contact-zero-jump-r4.js","DPRO-CONTACT-ZERO-JUMP-R4.1-20260927");
    addJs("contact-send-confirm","green-contact-send-confirm-r1.js","DPRO-CONTACT-SEND-CONFIRM-R1-20260927");
    addJs("contact-manual-refresh","green-contact-manual-refresh-read-r1.js","DPRO-CONTACT-MANUAL-REFRESH-READ-R1-20261002");
  }

  function boot() {
    const p=location.pathname;
    if (/\/owner\.html$/.test(p)) owner();
    if (/\/member\.html$/.test(p)) member();
    if (/\/contact-green\.html$/.test(p)) contact();
    document.documentElement.dataset.greenDemoFcCommon = VERSION;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
