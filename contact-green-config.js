/**
 * DPRO GREEN RENTAL × DPRO CONTACT
 * CONTACT-V1-7-GREEN-1
 * PUBLIC config only. Never store Secrets here.
 */
window.DPRO_CONTACT_CONFIG = Object.freeze({
  version: "DPRO-CONTACT-1-FRONTEND-FLAGS-20260808",
  enabled: true,
  features: {
    line: false,
    lineReply: false,
    search: true,
    statusManagement: true,
    autoRefresh: true,
    attachments: false,
    templates: false,
    assignment: false,
    aiSuggestions: false,
    email: false
  },
  apiBaseUrl: "https://dpro-green-contact-api.dpromstk2000.workers.dev",
  layout: "standalone",
  density: "normal",
  branding: {
    brandName: "DPRO GREEN",
    systemName: "GREEN RENTAL / CONTACT",
    brandMark: "葉",
    pageTitle: "LINE問い合わせを\nGREEN管理画面で完結",
    pageLead: "グリーンレンタルのお客様から届いたLINE問い合わせを確認し、そのまま返信できます。",
    topbarDescription: "LINE問い合わせ・顧客対応",
    channelName: "GREEN RENTAL LINE公式",
    homeUrl: "owner.html",
    homeLabel: "GREEN管理画面",
    loginUrl: "owner.html",
    primaryColor: "#1e6a52",
    primaryColor2: "#2f8b68",
    deepColor: "#12382d",
    softColor: "#e7f3ec"
  },
  auth: {
    mode: "adapter",
    publicConfigUrl: "",
    supabaseUrl: "",
    supabasePublishableKey: "",
    sessionStorageKey: "",
    supabaseJsUrl: ""
  },
  operator: {
    defaultName: "GREEN管理者",
    defaultRole: "管理者",
    readOnlyRoles: ["read_only"],
    roleLabels: {
      owner_admin: "管理者",
      read_only: "閲覧専用"
    }
  },
  ui: {
    autoRefreshSeconds: 30,
    closeSidebarAfterNavigate: true,
    showSecurityNote: true
  }
});
