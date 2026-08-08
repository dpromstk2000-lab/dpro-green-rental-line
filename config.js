/** DPRO GREEN LINE / CONTACT-V1-7-GREEN-1 */
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
});

(() => {
  "use strict";

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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installContactMenu, { once: true });
  } else {
    installContactMenu();
  }
})();
