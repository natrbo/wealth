// ╔══════════════════════════════════════════════════════════════╗
// ║  lib/networth.js — Net Worth module (Phase 1)                  ║
// ║  global sheets (liabilities, assetsOther) + dashboard 3 profile ║
// ║  read-only ต่อ engine เดิม — ไม่แตะ STATE.assets/loadProfile    ║
// ╚══════════════════════════════════════════════════════════════╝

// ── API: global scope = profile "global" — key แยกต่อ sheet ตาม design Phase 0 ──
// doGet/doPost ฝั่ง backend เป็น generic (prefix profile+"_") → global_liabilities,
// global_assetsOther, global_config อ่าน/เขียนแยก key ได้
async function apiLoadGlobal(){
  const r=await fetch(`${API_URL}?profile=global`);
  const j=await r.json();
  if(!j.ok) throw new Error(j.error||"load global failed");
  return j.data||{};
}

function nwInit(){
  if(!STATE.nw) STATE.nw={view:"household", global:null, fern:null, nut:null, loading:false, error:null, _form:null};
}
function nwNormalizeGlobal(g){
  return {
    liabilities: g.liabilities||[],
    assetsOther: g.assetsOther||[],
    config: Object.assign({expectedReturn:7, protectionYears:10}, g.config||{}),
    // businessAssets/realEstate/insurance/incomeStreams/cashFlow → Phase 2-3
  };
}

// ── loader: profile ที่เปิดอยู่ใช้ STATE.assets สดเสมอ, อีกคน+global โหลดครั้งเดียว cache ──
async function nwLoad(){
  nwInit();
  const other=STATE.profile==="fern"?"nut":"fern";
  const tasks=[];
  if(STATE.nw[other]==null)
    tasks.push(apiLoad(other).then(d=>{STATE.nw[other]=(d.assets||[]).map(a=>({...a,value:+a.value||0}));}));
  if(STATE.nw.global==null)
    tasks.push(apiLoadGlobal().then(g=>{STATE.nw.global=nwNormalizeGlobal(g);}));
  if(!tasks.length) return;
  STATE.nw.loading=true;
  try{ await Promise.all(tasks); STATE.nw.error=null; }
  catch(e){ STATE.nw.error=String(e); }
  finally{ STATE.nw.loading=false; }
}

// ── context สำหรับ aggregation (active profile = STATE.assets สด) ──
function nwCtx(){
  STATE.nw[STATE.profile]=STATE.assets; // live
  return {
    portfolios:{ fern:STATE.nw.fern||[], nut:STATE.nw.nut||[] },
    liabilities:(STATE.nw.global&&STATE.nw.global.liabilities)||[],
    assetsOther:(STATE.nw.global&&STATE.nw.global.assetsOther)||[],
  };
}

// ── snapshot/rollback เฉพาะ global (optimistic) ──
function nwSnap(){
  const g=STATE.nw.global;
  return { liabilities:g.liabilities.map(r=>({...r})), assetsOther:g.assetsOther.map(r=>({...r})) };
}
function nwRollback(s){ STATE.nw.global.liabilities=s.liabilities; STATE.nw.global.assetsOther=s.assetsOther; renderTab(); }

// ── handlers ──
function nwSetView(v){ STATE.nw.view=v; renderTab(); refreshProfiles(); }

function nwToggleForm(section){
  nwInit();
  if(STATE.nw._form&&STATE.nw._form.section===section){ STATE.nw._form=null; }
  else if(section==="liabilities"){
    STATE.nw._form={section, mode:"add", name:"", type:"mortgage", owner:"household", principalRemaining:0, interestRate:0, monthlyPayment:0};
  }else{
    STATE.nw._form={section, mode:"add", name:"", type:"cash", owner:"household", currentValue:0, liquid:true};
  }
  renderTab();
}

function nwEditRow(section, id){
  nwInit();
  const row=STATE.nw.global[section].find(r=>r.id===id); if(!row) return;
  STATE.nw._form={
    section,
    mode:"edit",
    id: row.id,
    name: row.name,
    type: row.type,
    owner: row.owner,
    principalRemaining: row.principalRemaining||0,
    interestRate: row.interestRate||0,
    monthlyPayment: row.monthlyPayment||0,
    currentValue: row.currentValue||0,
    liquid: !!row.liquid
  };
  renderTab();
}

function nwCommit(){
  const f=STATE.nw._form; if(!f) return;
  if(!f.name.trim()){ toast("ใส่ชื่อก่อน","var(--red)"); return; }
  const sp=ownerSplit(f.owner);
  const snap=nwSnap();
  
  if(f.mode==="edit"){
    const row=STATE.nw.global[f.section].find(r=>r.id===f.id);
    if(!row) return;
    row.name=f.name.trim();
    row.type=f.type;
    row.owner=f.owner;
    row.splitFern=sp.splitFern;
    row.splitNut=sp.splitNut;
    if(f.section==="liabilities"){
      row.principalRemaining=+f.principalRemaining||0;
      row.interestRate=+f.interestRate||0;
      row.monthlyPayment=+f.monthlyPayment||0;
    }else{
      row.currentValue=+f.currentValue||0;
      row.liquid=!!f.liquid;
    }
    STATE.nw._form=null;
    renderTab();
    apiSave(f.section,"global",STATE.nw.global[f.section])
      .then(()=>toast("บันทึกการแก้ไขแล้ว ✓"))
      .catch(()=>{ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); });
  } else {
    let row;
    if(f.section==="liabilities"){
      if(!(+f.principalRemaining>0)){ toast("ใส่เงินต้นคงเหลือก่อน","var(--red)"); return; }
      row={ id:"l"+Date.now().toString(36), name:f.name.trim(), type:f.type, owner:f.owner,
        splitFern:sp.splitFern, splitNut:sp.splitNut,
        principalRemaining:+f.principalRemaining||0, interestRate:+f.interestRate||0,
        monthlyPayment:+f.monthlyPayment||0, active:true };
    }else{
      if(!(+f.currentValue>0)){ toast("ใส่มูลค่าก่อน","var(--red)"); return; }
      row={ id:"a"+Date.now().toString(36), name:f.name.trim(), type:f.type, owner:f.owner,
        splitFern:sp.splitFern, splitNut:sp.splitNut,
        currentValue:+f.currentValue||0, liquid:!!f.liquid, unit:"THB" };
    }
    STATE.nw.global[f.section].push(row);
    STATE.nw._form=null;
    renderTab();
    apiSave(f.section,"global",STATE.nw.global[f.section])
      .then(()=>toast("เพิ่มแล้ว ✓"))
      .catch(()=>{ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); });
  }
}

function nwDelete(section,id){
  const row=STATE.nw.global[section].find(r=>r.id===id); if(!row) return;
  if(!confirm(`ลบ "${row.name}" ?`)) return;
  const snap=nwSnap();
  STATE.nw.global[section]=STATE.nw.global[section].filter(r=>r.id!==id);
  renderTab();
  apiSave(section,"global",STATE.nw.global[section])
    .then(()=>toast("ลบแล้ว ✓"))
    .catch(()=>{ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); });
}

// inline-edit จำนวนหลัก (principalRemaining / currentValue) — debounce save แบบ setPlan
function nwSetAmount(section,id,field,v){
  const row=STATE.nw.global[section].find(r=>r.id===id); if(!row) return;
  if(!nwSetAmount._t) nwSetAmount._snap=nwSnap();
  row[field]=num(v);
  nwRefreshTotals();
  clearTimeout(nwSetAmount._t);
  nwSetAmount._t=setTimeout(async()=>{
    nwSetAmount._t=null; const snap=nwSetAmount._snap; nwSetAmount._snap=null;
    try{ await apiSave(section,"global",STATE.nw.global[section]); toast("บันทึกแล้ว ✓"); }
    catch(e){ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); }
  },1100);
}

function nwToggleAmountBool(section,id,field,checked){
  const row=STATE.nw.global[section].find(r=>r.id===id); if(!row) return;
  if(!nwToggleAmountBool._snap) nwToggleAmountBool._snap=nwSnap();
  row[field]=!!checked;
  nwRefreshTotals();
  clearTimeout(nwToggleAmountBool._t);
  nwToggleAmountBool._t=setTimeout(async()=>{
    nwToggleAmountBool._t=null; const snap=nwToggleAmountBool._snap; nwToggleAmountBool._snap=null;
    try{ await apiSave(section,"global",STATE.nw.global[section]); toast("บันทึกแล้ว ✓"); }
    catch(e){ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); }
  },1100);
}

// อัปเดตตัวเลขสรุปสดๆ ใน DOM โดยไม่ re-render (กัน focus หลุดตอนพิมพ์)
function nwRefreshTotals(){
  const r=netWorthAll(nwCtx())[STATE.nw.view];
  const set=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=baht(val);};
  set("nw-networth", r.netWorth);
  set("nw-assets", r.assets);
  set("nw-liab", r.liabilities);
  set("nw-port", r.portfolio);
  set("nw-other", r.assetsOther);
}

// ── render ──
function tabNetWorth(m){
  nwInit();
  if(STATE.nw.error){
    m.innerHTML=`<div class="card"><div class="red">โหลด net worth ไม่ได้</div><div class="muted" style="font-size:12px;margin-top:6px">${STATE.nw.error}</div></div>`;
    return;
  }
  const other=STATE.profile==="fern"?"nut":"fern";
  if((STATE.nw[other]==null||STATE.nw.global==null)){
    m.innerHTML=`<div class="center" style="padding:40px"><span class="spin"></span><span class="muted" style="font-size:12px;letter-spacing:2px">กำลังรวมพอร์ตทั้งสองคน…</span></div>`;
    if(!STATE.nw.loading) nwLoad().then(()=>renderTab());
    return;
  }

  const view=STATE.nw.view, agg=netWorthAll(nwCtx()), r=agg[view];
  const nm={fern:"เฟิร์น", nut:"นัท", household:"รวม (Household)"}[view];

  // 1. Headline Banner
  const head=`<div class="card" style="text-align:center;margin-bottom:16px">
    <div class="muted" style="font-size:11px;letter-spacing:2px">NET WORTH · ${nm}</div>
    <div id="nw-networth" style="font-size:30px;font-weight:800;color:var(--gold);margin:6px 0;font-variant-numeric:tabular-nums">${baht(r.netWorth)}</div>
    <div class="muted" style="font-size:12px">สินทรัพย์ <span id="nw-assets" style="color:var(--green)">${baht(r.assets)}</span> · หนี้สิน <span id="nw-liab" style="color:var(--red)">${baht(r.liabilities)}</span></div>
  </div>`;

  // 2. Read-only Assets breakdown card
  const assetsCard=`<div class="card" style="margin-bottom:16px">
    <div class="ctitle">สินทรัพย์รวม (แสดงผลสรุป)</div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:13px">
      <span>พอร์ตลงทุน (กองทุน/หุ้น)</span>
      <span class="tnum" style="font-weight:600">${baht(r.portfolio)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:13px">
      <span>เงินสด / ทอง / สินทรัพย์อื่น</span>
      <span class="tnum" style="font-weight:600">${baht(r.assetsOther)}</span>
    </div>
  </div>`;

  // 3. Read-only Liabilities list card
  const liab=STATE.nw.global.liabilities;
  const liabSummaryList=liab.length
    ? liab.map(x=>{
        const share=view==="household"?1:splitFor(x,view);
        const amt=(+x.principalRemaining||0)*share;
        const pct=Math.round(((view==="household"?1:share))*100);
        return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:13px">
          <span>${x.name} <span class="muted" style="font-size:10px">(${pct}%${x.interestRate?` · ดอกเบี้ย ${x.interestRate}%`:""})</span></span>
          <span class="tnum red" style="font-weight:600">${baht(amt)}</span>
        </div>`;
      }).join("")
    : `<div class="muted" style="font-size:12px;padding:8px 0">ยังไม่มีหนี้สิน</div>`;
  const liabSummaryCard=`<div class="card" style="margin-bottom:16px">
    <div class="ctitle">หนี้สินรวม (แสดงผลสรุป)</div>
    ${liabSummaryList}
  </div>`;

  // ── 4. CRUD Section: Manage Other Assets ──
  const otherAssets=STATE.nw.global.assetsOther;
  const fAsset=STATE.nw._form&&STATE.nw._form.section==="assetsOther"?STATE.nw._form:null;
  const typeOptsAsset=[["cash","เงินสด/เงินฝาก"],["gold","ทอง"],["other","อื่นๆ"]];
  
  const assetForm = fAsset ? `
    <div style="margin-top:12px;padding:12px;background:var(--ink3);border-radius:10px;border:1px solid var(--line)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="grid-column:1/-1">
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">ชื่อสินทรัพย์</label>
          <input class="num" type="text" value="${fAsset.name}" oninput="STATE.nw._form.name=this.value" style="width:100%;padding:6px;font-size:13px">
        </div>
        <div>
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">ประเภท</label>
          <select onchange="STATE.nw._form.type=this.value" style="width:100%;padding:5px;font-size:12px;background:var(--bg-input);color:var(--text);border:1px solid var(--border)">
            ${typeOptsAsset.map(([v,l])=>`<option value="${v}" ${fAsset.type===v?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">เจ้าของ</label>
          <select onchange="STATE.nw._form.owner=this.value" style="width:100%;padding:5px;font-size:12px;background:var(--bg-input);color:var(--text);border:1px solid var(--border)">
            ${[["household","ถือร่วม 50/50"],["fern","เฟิร์น"],["nut","นัท"]].map(([v,l])=>`<option value="${v}" ${fAsset.owner===v?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">มูลค่าปัจจุบัน (฿)</label>
          <input class="num" type="text" inputmode="numeric" value="${fAsset.currentValue||""}" oninput="STATE.nw._form.currentValue=num(this.value)" style="width:100%;padding:6px;font-size:13px;text-align:right">
        </div>
        <div style="display:flex;align-items:flex-end;padding-bottom:6px">
          <label style="font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" ${fAsset.liquid?"checked":""} onchange="STATE.nw._form.liquid=this.checked"> สภาพคล่อง
          </label>
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="nwCommit()" style="flex:1">${fAsset.mode==="edit"?"บันทึกการแก้ไข ✓":"เพิ่มสินทรัพย์ ✓"}</button>
        <button class="btn" onclick="nwToggleForm('assetsOther')" style="flex:1;background:var(--ink3);color:var(--mute);border:1px solid var(--line)">ยกเลิก</button>
      </div>
    </div>` : "";

  const assetManageList = otherAssets.length
    ? otherAssets.map(x=>{
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-size:13px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:var(--text-primary)">${x.name} <span class="muted" style="font-size:10px">(${x.owner==="household"?"ถือร่วม 50/50":x.owner==="fern"?"เฟิร์น":"นัท"})</span></div>
            <div class="muted" style="font-size:10px;margin-top:2px">
              มูลค่า: <span style="font-weight:600">${baht(x.currentValue)}</span> · ประเภท: ${x.type === "cash" ? "เงินสด" : x.type === "gold" ? "ทองคำ" : "อื่นๆ"} ${x.liquid ? " · สภาพคล่อง" : ""}
            </div>
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <button class="btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:11px;font-weight:700;padding:2px" onclick="nwEditRow('assetsOther','${x.id}')">แก้ไข</button>
            <button class="btn" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:11px;font-weight:700;padding:2px" onclick="nwDelete('assetsOther','${x.id}')">ลบ</button>
          </div>
        </div>`;
      }).join("")
    : `<div class="muted" style="font-size:12px;padding:8px 0">ยังไม่มีรายการสินทรัพย์อื่น</div>`;

  const crudAssetsCard=`<div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="ctitle" style="margin-bottom:0">จัดการสินทรัพย์อื่น</div>
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:4px 12px;font-size:12px" onclick="nwToggleForm('assetsOther')">${fAsset?"✕ ปิด":"＋ เพิ่มสินทรัพย์"}</button>
    </div>
    ${assetManageList}
    ${assetForm}
  </div>`;

  // ── 5. CRUD Section: Manage Liabilities ──
  const fLiab=STATE.nw._form&&STATE.nw._form.section==="liabilities"?STATE.nw._form:null;
  const typeOptsLiab=[["mortgage","จำนอง/บ้าน"],["condo","คอนโด"],["personal","ส่วนบุคคล"],["auto","รถ"],["credit","บัตรเครดิต"]];

  const liabForm = fLiab ? `
    <div style="margin-top:12px;padding:12px;background:var(--ink3);border-radius:10px;border:1px solid var(--line)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="grid-column:1/-1">
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">ชื่อหนี้สิน</label>
          <input class="num" type="text" value="${fLiab.name}" oninput="STATE.nw._form.name=this.value" style="width:100%;padding:6px;font-size:13px">
        </div>
        <div>
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">ประเภท</label>
          <select onchange="STATE.nw._form.type=this.value" style="width:100%;padding:5px;font-size:12px;background:var(--bg-input);color:var(--text);border:1px solid var(--border)">
            ${typeOptsLiab.map(([v,l])=>`<option value="${v}" ${fLiab.type===v?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">เจ้าของ</label>
          <select onchange="STATE.nw._form.owner=this.value" style="width:100%;padding:5px;font-size:12px;background:var(--bg-input);color:var(--text);border:1px solid var(--border)">
            ${[["household","ถือร่วม 50/50"],["fern","เฟิร์น"],["nut","นัท"]].map(([v,l])=>`<option value="${v}" ${fLiab.owner===v?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">เงินต้นคงเหลือ (฿)</label>
          <input class="num" type="text" inputmode="numeric" value="${fLiab.principalRemaining||""}" oninput="STATE.nw._form.principalRemaining=num(this.value)" style="width:100%;padding:6px;font-size:13px;text-align:right">
        </div>
        <div>
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">ดอกเบี้ย (%/ปี)</label>
          <input class="num" type="text" inputmode="numeric" value="${fLiab.interestRate||""}" oninput="STATE.nw._form.interestRate=num(this.value)" style="width:100%;padding:6px;font-size:13px;text-align:right">
        </div>
        <div style="grid-column:1/-1">
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">ค่างวด/เดือน (฿)</label>
          <input class="num" type="text" inputmode="numeric" value="${fLiab.monthlyPayment||""}" oninput="STATE.nw._form.monthlyPayment=num(this.value)" style="width:100%;padding:6px;font-size:13px;text-align:right">
        </div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn" onclick="nwCommit()" style="flex:1">${fLiab.mode==="edit"?"บันทึกการแก้ไข ✓":"เพิ่มหนี้สิน ✓"}</button>
        <button class="btn" onclick="nwToggleForm('liabilities')" style="flex:1;background:var(--ink3);color:var(--mute);border:1px solid var(--line)">ยกเลิก</button>
      </div>
    </div>` : "";

  const liabManageList = liab.length
    ? liab.map(x=>{
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--line);font-size:13px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:var(--text-primary)">${x.name} <span class="muted" style="font-size:10px">(${x.owner === "household" ? "ถือร่วม 50/50" : x.owner === "fern" ? "เฟิร์น" : "นัท"})</span></div>
            <div class="muted" style="font-size:10px;margin-top:2px">
              เงินต้น: <span class="red" style="font-weight:600">${baht(x.principalRemaining)}</span> · ดอกเบี้ย: ${x.interestRate}% · ค่างวด: ${baht(x.monthlyPayment)}/ด.
            </div>
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <button class="btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:11px;font-weight:700;padding:2px" onclick="nwEditRow('liabilities','${x.id}')">แก้ไข</button>
            <button class="btn" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:11px;font-weight:700;padding:2px" onclick="nwDelete('liabilities','${x.id}')">ลบ</button>
          </div>
        </div>`;
      }).join("")
    : `<div class="muted" style="font-size:12px;padding:8px 0">ยังไม่มีรายการหนี้สิน</div>`;

  const crudLiabCard=`<div class="card" style="margin-bottom:0">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="ctitle" style="margin-bottom:0">จัดการหนี้สิน</div>
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:4px 12px;font-size:12px" onclick="nwToggleForm('liabilities')">${fLiab?"✕ ปิด":"＋ เพิ่มหนี้สิน"}</button>
    </div>
    ${liabManageList}
    ${liabForm}
  </div>`;

  m.innerHTML=head+assetsCard+liabSummaryCard+crudAssetsCard+crudLiabCard;
}
