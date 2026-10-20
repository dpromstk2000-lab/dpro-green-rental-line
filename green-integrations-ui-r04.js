/* DPRO GREEN Integrations R0.2 | Safe UI / no direct token or provider calls */
(()=>{'use strict';
const VERSION='GREEN-INTEGRATIONS-UI-R0.4-20261020';
const panel=document.querySelector('[data-view-panel="facility-settings"]');
if(!panel||!window.Green)return;
const card=document.createElement('article');card.className='owner-panel green-integration-panel';
card.setAttribute('aria-label','外部連携');
card.innerHTML=`<div class="green-integrations-header"><div><p class="eyebrow">EXTERNAL INTEGRATIONS</p><h3>外部連携</h3><p>Googleカレンダー・Squareを事業所ごとに接続します。写真館とは別アカウントで管理できます。</p></div><button type="button" class="btn btn--secondary" id="green-integrations-refresh">再読込</button></div>
<div class="green-integrations-grid"><section class="green-integrations-provider"><h4>Googleカレンダー</h4><p>定期巡回・訪問・設置などの予定を同期</p><p id="green-google-status" role="status">確認待ち</p><button type="button" class="btn btn--secondary" id="green-google-connect" disabled>接続（準備中）</button></section>
<section class="green-integrations-provider"><h4>Square</h4><p>レンタル料金・設置費用・追加作業の決済</p><p id="green-square-status" role="status">確認待ち</p><button type="button" class="btn btn--secondary" id="green-square-connect" disabled>接続（準備中）</button></section></div>
<p class="green-integrations-message" id="green-integrations-message">外部連携の安全確認中です。Google同期・決済の実行はまだできません。</p>`;
const form=panel.querySelector('form#facility-settings-form');
if(form)form.insertAdjacentElement('afterend',card);else panel.appendChild(card);
const $=s=>card.querySelector(s);
const msg=$('#green-integrations-message');
const buttons={google:$('#green-google-connect'),square:$('#green-square-connect')};
let loading=false;
function markUnavailable(message){msg.textContent=message;buttons.google.disabled=true;buttons.square.disabled=true;}
async function refresh(){if(loading)return;loading=true;
  try{const res=await window.Green.api('/api/admin/integrations/status');
    const d=res.data&&res.data.available!==undefined?res.data:res;
    const available=d.available===true;
    $('#green-google-status').textContent=d.google?.connected?'接続済み':'未接続';
    $('#green-square-status').textContent=d.square?.connected?'接続済み':'未接続';
    const caps=d.capabilities||{};
    if(available){buttons.google.disabled=caps.google_calendar!==true;buttons.square.disabled=caps.square!==true;
      buttons.google.textContent=caps.google_calendar===true?'Googleと接続':'接続（審査・確認待ち）';buttons.square.textContent=caps.square===true?'Squareと接続':'接続（確認待ち）';
      msg.textContent='予定の自動同期と決済請求はまだ有効化していません。接続できるサービスだけボタンを開放します。';
    }else markUnavailable('外部連携は準備中です。既存の契約・巡回機能には影響しません。');
  }catch(e){$('#green-google-status').textContent='確認できません';$('#green-square-status').textContent='確認できません';
    markUnavailable('連携APIは未公開です。既存の管理業務は通常どおり利用できます。');
  }finally{loading=false;}}
async function connect(provider){
  if(!confirm((provider==='google_calendar'?'Googleカレンダー':'Square')+'を接続しますか？'))return;
  const btn=provider==='google_calendar'?buttons.google:buttons.square;btn.disabled=true;
  try{const res=await window.Green.api('/api/admin/integrations/oauth/start',{method:'POST',json:{provider}});
    const d=res.data?.authorize_url?res.data:res;
    if(d.ok===false||!d.authorize_url||!/^https:\/\/(accounts\.google\.com|connect\.squareup\.com)\//.test(d.authorize_url))
      throw new Error('認証URLが正しくありません。');
    // Opening from a click after an await can be blocked; browser navigation is explicit and first-party.
    window.location.assign(d.authorize_url);
  }catch(e){msg.textContent='接続開始できませんでした。管理者認証・API設定を確認してください。';btn.disabled=false;}}
$('#green-integrations-refresh').addEventListener('click',refresh);
buttons.google.addEventListener('click',()=>connect('google_calendar'));
buttons.square.addEventListener('click',()=>connect('square'));
panel.addEventListener('click',()=>{});
// Existing owner view loading is asynchronous; refresh only after the owner opens this panel.
document.querySelector('[data-view="facility-settings"]')?.addEventListener('click',()=>setTimeout(refresh,100));
if(new URLSearchParams(location.search).get('oauth_return')==='1')setTimeout(refresh,500);
document.documentElement.dataset.greenIntegrations=VERSION;
})();
