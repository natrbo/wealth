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
function nwSetView(v){ STATE.nw.view=v; renderTab(); }

function nwToggleForm(section){
  nwInit();
  if(STATE.nw._form&&STATE.nw._form.section===section){ STATE.nw._form=null; }
  else if(section==="liabilities"){
    STATE.nw._form={section, name:"", type:"mortgage", owner:"household", principalRemaining:0, interestRate:0, monthlyPayment:0};
  }else{
    STATE.nw._form={section, name:"", type:"cash", owner:"household", currentValue:0, liquid:true};
  }
  renderTab();
}

function nwCommit(){
  const f=STATE.nw._form; if(!f) return;
  if(!f.name.trim()){ toast("ใส่ชื่อก่อน","var(--red)"); return; }
  const sp=ownerSplit(f.owner);
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
  const section=f.section, snap=nwSnap();
  STATE.nw.global[section].push(row);
  STATE.nw._form=null;
  renderTab();
  apiSave(section,"global",STATE.nw.global[section])
    .then(()=>toast("เพิ่มแล้ว ✓"))
    .catch(()=>{ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); });
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

  // profile toggle
  const toggle=`<div class="profiles" style="margin-bottom:14px">
    ${[["fern","เฟิร์น"],["nut","นัท"],["household","รวม"]].map(([k,l])=>
      `<button class="pf ${view===k?"on":""}" onclick="nwSetView('${k}')">${l}</button>`).join("")}
  </div>`;

  // headline
  const head=`<div class="card" style="text-align:center">
    <div class="muted" style="font-size:11px;letter-spacing:2px">NET WORTH · ${nm}</div>
    <div id="nw-networth" style="font-size:30px;font-weight:800;color:var(--gold);margin:6px 0;font-variant-numeric:tabular-nums">${baht(r.netWorth)}</div>
    <div class="muted" style="font-size:12px">สินทรัพย์ <span id="nw-assets" style="color:var(--green)">${baht(r.assets)}</span> · หนี้สิน <span id="nw-liab" style="color:var(--red)">${baht(r.liabilities)}</span></div>
  </div>`;

  // assets breakdown
  const assetRows=[
    ["พอร์ตลงทุน (กองทุน/หุ้น)", `<span id="nw-port">${baht(r.portfolio)}</span>`],
    ["เงินสด / ทอง / อื่นๆ", `<span id="nw-other">${baht(r.assetsOther)}</span>`],
  ];
  const assetsCard=`<div class="card"><div class="ctitle">สินทรัพย์</div>
    ${assetRows.map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--line);font-size:13px"><span>${l}</span><span class="tnum" style="font-weight:600">${v}</span></div>`).join("")}
  </div>`;

  // liabilities list (read view = สัดส่วนของ profile ที่เลือก)
  const liab=STATE.nw.global.liabilities;
  const liabList=liab.length
    ? liab.map(x=>{
        const share=view==="household"?1:splitFor(x,view);
        const amt=(+x.principalRemaining||0)*share;
        const pct=Math.round(((view==="household"?1:share))*100);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-top:1px solid var(--line);font-size:13px">
          <span>${x.name} <span class="muted" style="font-size:10px">(${pct}%${x.interestRate?` · ${x.interestRate}%`:""})</span></span>
          <span class="tnum red" style="font-weight:600">${baht(amt)}</span></div>`;
      }).join("")
    : `<div class="muted" style="font-size:12px;padding:8px 0">ยังไม่มีหนี้สิน</div>`;
  const liabCard=`<div class="card"><div class="ctitle">หนี้สิน</div>${liabList}</div>`;

  m.innerHTML=toggle+head+assetsCard+liabCard
    + nwCrudSection("assetsOther","เงินสด / ทอง / สินทรัพย์อื่น", STATE.nw.global.assetsOther)
    + nwCrudSection("liabilities","หนี้สิน (จัดการ)", liab);
}

// ── CRUD section (กรอกผ่าน UI) ──
function nwCrudSection(section, title, rows){
  const f=STATE.nw._form&&STATE.nw._form.section===section?STATE.nw._form:null;
  const isLiab=section==="liabilities";
  const amtField=isLiab?"principalRemaining":"currentValue";

  const list=rows.length? rows.map(x=>`
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.name}</div>
        <div class="muted" style="font-size:10px">${x.type} · ${x.owner}${!isLiab&&x.liquid?" · liquid":""}</div>
      </div>
      <input class="num" type="text" inputmode="numeric" value="${+x[amtField]||0}"
        oninput="nwSetAmount('${section}','${x.id}','${amtField}',this.value)" style="width:110px;text-align:right">
      <button onclick="nwDelete('${section}','${x.id}')" title="ลบ"
        style="background:none;border:none;color:var(--red);cursor:pointer;font-size:16px;flex-shrink:0">✕</button>
    </div>`).join("")
    : `<div class="muted" style="font-size:12px;padding:8px 0">ยังไม่มีรายการ</div>`;

  const typeOpts=isLiab
    ? [["mortgage","จำนอง/บ้าน"],["condo","คอนโด"],["personal","ส่วนบุคคล"],["auto","รถ"],["credit","บัตรเครดิต"]]
    : [["cash","เงินสด/เงินฝาก"],["gold","ทอง"],["other","อื่นๆ"]];

  const form=f?`
    <div style="margin-top:10px;padding:12px;background:var(--ink3);border-radius:10px;border:1px solid var(--line)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="grid-column:1/-1"><label class="muted" style="font-size:10px">ชื่อ</label>
          <input class="num" type="text" value="${f.name}" oninput="STATE.nw._form.name=this.value" style="width:100%"></div>
        <div><label class="muted" style="font-size:10px">ประเภท</label>
          <select onchange="STATE.nw._form.type=this.value" style="width:100%">${typeOpts.map(([v,l])=>`<option value="${v}" ${f.type===v?"selected":""}>${l}</option>`).join("")}</select></div>
        <div><label class="muted" style="font-size:10px">เจ้าของ</label>
          <select onchange="STATE.nw._form.owner=this.value" style="width:100%">${[["household","ถือร่วม 50/50"],["fern","เฟิร์น"],["nut","นัท"]].map(([v,l])=>`<option value="${v}" ${f.owner===v?"selected":""}>${l}</option>`).join("")}</select></div>
        ${isLiab?`
        <div><label class="muted" style="font-size:10px">เงินต้นคงเหลือ</label>
          <input class="num" type="text" inputmode="numeric" value="${f.principalRemaining||""}" oninput="STATE.nw._form.principalRemaining=num(this.value)" style="width:100%"></div>
        <div><label class="muted" style="font-size:10px">ดอกเบี้ย %/ปี</label>
          <input class="num" type="text" inputmode="numeric" value="${f.interestRate||""}" oninput="STATE.nw._form.interestRate=num(this.value)" style="width:100%"></div>
        <div style="grid-column:1/-1"><label class="muted" style="font-size:10px">ค่างวด/เดือน</label>
          <input class="num" type="text" inputmode="numeric" value="${f.monthlyPayment||""}" oninput="STATE.nw._form.monthlyPayment=num(this.value)" style="width:100%"></div>
        `:`
        <div><label class="muted" style="font-size:10px">มูลค่าปัจจุบัน</label>
          <input class="num" type="text" inputmode="numeric" value="${f.currentValue||""}" oninput="STATE.nw._form.currentValue=num(this.value)" style="width:100%"></div>
        <div style="display:flex;align-items:flex-end;padding-bottom:4px"><label style="font-size:12px;display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" ${f.liquid?"checked":""} onchange="STATE.nw._form.liquid=this.checked"> สภาพคล่อง (เงินสำรอง)</label></div>
        `}
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" onclick="nwCommit()" style="flex:1">เพิ่ม ✓</button>
        <button class="btn" onclick="nwToggleForm('${section}')" style="flex:1;background:var(--ink3);color:var(--mute);border:1px solid var(--line)">ยกเลิก</button>
      </div>
    </div>`:"";

  return `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="ctitle" style="margin-bottom:0">${title}</div>
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:4px 12px;font-size:12px" onclick="nwToggleForm('${section}')">${f?"× ปิด":"＋ เพิ่ม"}</button>
    </div>
    ${list}${form}
  </div>`;
}
