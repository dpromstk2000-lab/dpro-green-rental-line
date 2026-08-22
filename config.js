/** DPRO GREEN LINE / CONTACT-V1-7-GREEN-1 / CUSTOMER-HERO-2 */
window.GREEN_CONFIG = Object.freeze({
  API_BASE: "https://dpro-green-rental-line-api.dpromstk2000.workers.dev",
  FACILITY_CODE: "dpro_green_rental_demo",
  LIFF_ID: "",
  DEMO_MEMBER_TOKEN: "GREEN-DEMO",
  DEMO_CUSTOMER_NUMBER: "DEMO-GREEN-001",
  MAX_PHOTOS: 4,
  MAX_IMAGE_EDGE: 1600,
  JPEG_QUALITY: 0.82,
  CONTACT_ENABLED: true,
  CONTACT_URL: "contact-green.html",
  CUSTOMER_HERO: Object.freeze({
    enabled: true,
    desktopImage: "https://dpromstk2000-lab.github.io/dpro-green-website/owner-hero.webp",
    mobileImage: "https://dpromstk2000-lab.github.io/dpro-green-website/hero-mobile-lobby.webp",
    eyebrow: "GREEN RENTAL CUSTOMER PORTAL",
    title: "空間に、やすらぎと品格を。",
    badge: "ご利用中のお客様専用マイページ",
    lead: "設置植物・次回訪問・作業報告・ご相談を、ひとつの画面で。",
    alt: "観葉植物のある心地よい空間",
  }),
});

window.DPRO_CUSTOMER_HERO_CONFIG = window.GREEN_CONFIG.CUSTOMER_HERO;

(() => {
  "use strict";
  const HERO_ADMIN_VERSION = "DPRO-CUSTOMER-HERO-2-20260808";

  function installContactMenu() {
    if (!window.GREEN_CONFIG?.CONTACT_ENABLED) return;
    if (!/\/owner\.html$/.test(location.pathname)) return;
    const nav = document.querySelector(".owner-nav");
    if (!nav || document.getElementById("green-contact-menu")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.id = "green-contact-menu";
    button.innerHTML = "<span>話</span>顧客対応 NEW";
    button.setAttribute("aria-label", "LINE顧客対応を開く");
    button.addEventListener("click", () => {
      location.href = window.GREEN_CONFIG.CONTACT_URL || "contact-green.html";
    });
    const inquiryButton = nav.querySelector('[data-view="inquiries"]');
    if (inquiryButton) inquiryButton.insertAdjacentElement("afterend", button);
    else nav.prepend(button);
  }

  function installCustomerHeroAdmin() {
    if (!/\/owner\.html$/.test(location.pathname)) return;
    if (!document.querySelector('link[data-customer-hero-admin]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `customer-hero-admin.css?v=${encodeURIComponent(HERO_ADMIN_VERSION)}`;
      link.dataset.customerHeroAdmin = HERO_ADMIN_VERSION;
      document.head.append(link);
    }
    if (!document.querySelector('script[data-customer-hero-admin]')) {
      const script = document.createElement("script");
      script.src = `customer-hero-admin.js?v=${encodeURIComponent(HERO_ADMIN_VERSION)}`;
      script.defer = true;
      script.dataset.customerHeroAdmin = HERO_ADMIN_VERSION;
      document.head.append(script);
    }
  }

  function installTutorialRuntime() {
    if (document.documentElement.dataset.dproTutorialRuntime === "green-r3") return;
    document.documentElement.dataset.dproTutorialRuntime = "green-r3";
    if (!document.querySelector('link[data-dpro-tutorial-green]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "dpro-tutorial-green.css?v=GREEN-TUTORIAL-R3.1-20260822";
      link.dataset.dproTutorialGreen = "R3";
      document.head.append(link);
    }
    if (!document.querySelector('script[data-dpro-tutorial-green]')) {
      const script = document.createElement("script");
      script.src = "dpro-tutorial-green.js?v=GREEN-TUTORIAL-R3.1-20260822";
      script.defer = true;
      script.dataset.dproTutorialGreen = "R3";
      document.head.append(script);
    }
  }

  function boot() {
    installContactMenu();
    installCustomerHeroAdmin();
    installTutorialRuntime();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
