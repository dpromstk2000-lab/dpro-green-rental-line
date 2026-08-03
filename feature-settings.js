(() => {
  "use strict";
  const Green=window.Green, $=s=>document.querySelector(s);
  const state={data:null,original:{}};
  const labels={
    use_multi_site:"複数拠点",use_site_areas:"拠点内設置場所",use_customer_portal:"お客様マイページ",use_customer_line_link:"LINE顧客連携",use_customer_contract_view:"利用内容表示",
    plant_management_mode:"植物管理方式",use_plant_qr:"植物QR",use_headquarters_asset_code:"本部管理番号",container_management_mode:"鉢管理方式",use_simple_inventory:"簡易在庫",use_asset_movement_history:"資産移動履歴",use_plant_photo_history:"植物写真履歴",
    use_fixed_visit_rules:"定期訪問ルール",use_route_order:"訪問順",use_map_button:"地図ボタン",use_vehicle_assignment:"車両割当",use_arrival_status:"到着状態",use_work_start_status:"作業開始状態",use_bulk_maintenance_check:"一括作業チェック",use_per_plant_condition:"一鉢別状態",before_photo_mode:"作業前写真",after_photo_mode:"作業後写真",issue_photo_mode:"異常写真",use_offline_draft:"オフライン下書き",
    use_replacement_management:"交換管理",replacement_approval_mode:"交換承認方式",use_replacement_asset_allocation:"代替植物割当",use_recovery_management:"回収管理",use_care_management:"養生管理",use_reuse_decision:"再利用判定",use_disposal_record:"廃棄記録",
    use_public_inquiry:"公開問い合わせ",use_line_photo_inquiry:"LINE写真相談",line_visit_notice_mode:"訪問予定通知",line_completion_notice_mode:"作業完了通知",use_customer_report_page:"お客様作業報告",use_visit_change_request:"訪問変更相談",use_additional_service_request:"追加サービス相談",
    staff_customer_scope:"スタッフ顧客範囲",staff_can_view_phone:"電話番号表示",staff_can_view_address:"住所表示",staff_can_view_entry_info:"入館情報表示",staff_can_view_internal_notes:"社内メモ表示",staff_can_view_past_reports:"過去報告表示",staff_can_propose_replacement:"交換提案",staff_can_approve_replacement:"交換承認"
  };
  const optionLabels={asset:"一鉢管理",count:"本数管理",hybrid:"併用管理",none:"使用しない",with_plant:"植物と一体",separate_asset:"別資産",off:"OFF",optional:"任意",required:"必須",manager:"管理者",owner:"オーナー",copy:"文面コピー",automatic:"自動送信",assigned_only:"担当分のみ",today_route:"本日のルート",all_active:"利用中顧客すべて"};
  const esc=v=>String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  async function load(){
    const result=await Green.api("/api/admin/features"); state.data=result.data; state.original={};
    Object.entries(result.data.features||{}).forEach(([k,v])=>state.original[k]=v.value);
    render(); await loadHistory();
  }
  function render(){
    const groups={}; for(const [key,def] of Object.entries(state.data.definitions||{})){(groups[def.group]??=[]).push([key,def]);}
    $("#feature-groups").innerHTML=Object.entries(groups).map(([group,items])=>`<article class="owner-panel feature-group"><div class="owner-panel-head"><h3>${esc(group)}</h3></div><div class="feature-grid">${items.map(([key,def])=>control(key,def)).join("")}</div></article>`).join("");
    const dep=state.data.dependencyValidation; const box=$("#feature-dependency-box"); box.textContent=dep.ok?"機能の依存関係は正常です。":"依存関係エラー："+dep.errors.join(" / "); box.classList.toggle("is-error",!dep.ok);
  }
  function control(key,def){ const entry=state.data.features[key]||{}; const value=entry.value??def.recommended; const locked=entry.isLocked===true;
    let input; if(def.type==="boolean") input=`<label class="feature-switch"><input type="checkbox" data-feature-input="${key}" ${value===true?"checked":""} ${locked?"disabled":""}><span>${value===true?"ON":"OFF"}</span></label>`;
    else input=`<select data-feature-input="${key}" ${locked?"disabled":""}>${(def.allowed||[]).map(v=>`<option value="${esc(v)}" ${String(v)===String(value)?"selected":""}>${esc(optionLabels[v]||v)}</option>`).join("")}</select>`;
    return `<div class="feature-card"><div><strong>${esc(labels[key]||key)}</strong><code>${esc(key)}</code></div>${input}<small>推奨：${esc(optionLabels[def.recommended]??String(def.recommended))}${locked?"／ロック済み":""}</small></div>`; }
  async function save(){ const changes={}; document.querySelectorAll("[data-feature-input]").forEach(el=>{const k=el.dataset.featureInput; const v=el.type==="checkbox"?el.checked:el.value;if(String(v)!==String(state.original[k]))changes[k]=v;}); if(!Object.keys(changes).length){Green.toast("変更はありません。");return;} if(!confirm(`${Object.keys(changes).length}件の設定を変更します。よろしいですか？`))return;
    const result=await Green.api("/api/admin/features",{method:"PATCH",json:{changes,reason:"機能設定画面から変更"}}); Green.toast("機能設定を保存しました。","success"); state.data=result.data; state.original={}; Object.entries(result.data.features||{}).forEach(([k,v])=>state.original[k]=v.value); render(); await loadHistory(); }
  async function loadHistory(){const result=await Green.api("/api/admin/features/history"); const items=result.data.items||[]; $("#feature-history").innerHTML=items.length?items.map(x=>`<div class="feature-history-item"><strong>${esc(labels[x.feature_key]||x.feature_key)}</strong><span>${esc(x.old_value??"—")} → ${esc(x.new_value??"—")}</span><small>${esc(new Date(x.created_at).toLocaleString("ja-JP"))}${x.change_reason?"／"+esc(x.change_reason):""}</small></div>`).join(""):'<div class="owner-empty">変更履歴はありません。</div>';}
  document.addEventListener("DOMContentLoaded",()=>{$("#feature-save-all")?.addEventListener("click",save);$("#feature-history-reload")?.addEventListener("click",loadHistory);});
  window.GreenFeatureSettings={load};
})();