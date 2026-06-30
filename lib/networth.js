// ╔══════════════════════════════════════════════════════════════╗
// ║  lib/networth.js — Net Worth module (Phase 2a)                 ║
// ║  global sheets (liabilities, assetsOther, businessAssets,      ║
// ║  realEstate, incomeStreams) + CRUD backend & UI forms          ║
// ╚══════════════════════════════════════════════════════════════╝

// ── API: global scope = profile "global" ──
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
  const cf = g.cashFlow||[];
  if(!cf.find(x=>x.profile==="fern")) cf.push({profile:"fern", monthlyExpense:0});
  if(!cf.find(x=>x.profile==="nut")) cf.push({profile:"nut", monthlyExpense:0});
  return {
    liabilities: g.liabilities||[],
    assetsOther: g.assetsOther||[],
    businessAssets: g.businessAssets||[],
    realEstate: g.realEstate||[],
    incomeStreams: g.incomeStreams||[],
    insurance: g.insurance||[],
    cashFlow: cf,
    loanBook: g.loanBook||[],
    config: Object.assign({expectedReturn:7, protectionYears:10}, g.config||{}),
  };
}

// ── loader: cached load for global sheets ──
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

// ── context aggregation ──
function nwCtx(){
  STATE.nw[STATE.profile]=STATE.assets; // live
  return {
    portfolios:{ fern:STATE.nw.fern||[], nut:STATE.nw.nut||[] },
    liabilities:(STATE.nw.global&&STATE.nw.global.liabilities)||[],
    assetsOther:(STATE.nw.global&&STATE.nw.global.assetsOther)||[],
    businessAssets:(STATE.nw.global&&STATE.nw.global.businessAssets)||[],
    realEstate:(STATE.nw.global&&STATE.nw.global.realEstate)||[],
    incomeStreams:(STATE.nw.global&&STATE.nw.global.incomeStreams)||[],
    insurance:(STATE.nw.global&&STATE.nw.global.insurance)||[],
    cashFlow:(STATE.nw.global&&STATE.nw.global.cashFlow)||[],
    loanBook:(STATE.nw.global&&STATE.nw.global.loanBook)||[],
  };
}

// ── snapshot/rollback for optimistic UI updates ──
function nwSnap(){
  const g=STATE.nw.global;
  return {
    liabilities: g.liabilities.map(r=>({...r})),
    assetsOther: g.assetsOther.map(r=>({...r})),
    businessAssets: (g.businessAssets||[]).map(r=>({...r})),
    realEstate: (g.realEstate||[]).map(r=>({...r})),
    incomeStreams: (g.incomeStreams||[]).map(r=>({...r})),
    insurance: (g.insurance||[]).map(r=>({...r})),
    cashFlow: (g.cashFlow||[]).map(r=>({...r})),
    loanBook: (g.loanBook||[]).map(r=>({...r})),
  };
}
function nwRollback(s){
  STATE.nw.global.liabilities=s.liabilities;
  STATE.nw.global.assetsOther=s.assetsOther;
  STATE.nw.global.businessAssets=s.businessAssets;
  STATE.nw.global.realEstate=s.realEstate;
  STATE.nw.global.incomeStreams=s.incomeStreams;
  STATE.nw.global.insurance=s.insurance;
  STATE.nw.global.cashFlow=s.cashFlow;
  STATE.nw.global.loanBook=s.loanBook;
  renderTab();
}

// ── handlers ──
function nwSetView(v){ STATE.nw.view=v; renderTab(); refreshProfiles(); }

function nwToggleForm(section){
  nwInit();
  if(STATE.nw._form&&STATE.nw._form.section===section){ STATE.nw._form=null; }
  else if(section==="liabilities"){
    STATE.nw._form={section, mode:"add", name:"", type:"mortgage", owner:"household", principalRemaining:"", interestRate:"", monthlyPayment:""};
  }else if(section==="assetsOther"){
    STATE.nw._form={section, mode:"add", name:"", type:"cash", owner:"household", currentValue:"", liquid:true};
  }else if(section==="businessAssets"){
    STATE.nw._form={section, mode:"add", name:"", type:"mortgage_lending", owner:"household", ownershipPct:"", additionalCapital:"", monthlyDividend:""};
  }else if(section==="realEstate"){
    STATE.nw._form={section, mode:"add", name:"", type:"rental_condo", owner:"household", marketValue:"", monthlyRentIncome:"", monthlyRentExpense:"", linkedLiabilityId:""};
  }else if(section==="incomeStreams"){
    STATE.nw._form={section, mode:"add", source:"", type:"salary", owner:"household", monthlyAmount:"", passive:false, linkedAssetId:""};
  }else if(section==="insurance"){
    STATE.nw._form={section, mode:"add", name:"", type:"life", insured:"fern", sumAssured:"", cashValue:"", annualPremium:"", premiumFrequency:"annual", taxDeductible:true};
  }else if(section==="loanBook"){
    const defaultBiz = (STATE.nw.global.businessAssets && STATE.nw.global.businessAssets[0] && STATE.nw.global.businessAssets[0].id) || "";
    STATE.nw._form={section, mode:"add", borrowerName:"", principalOutstanding:"", interestRate:"", monthlyPayment:"", dueDate:"", businessId:defaultBiz};
  }
  renderTab();
}

function nwEditRow(section, id){
  nwInit();
  const row=STATE.nw.global[section].find(r=>r.id===id); if(!row) return;
  
  // Dynamic resolve for editing income stream if linked
  let resolvedAmt = row.monthlyAmount;
  let resolvedOwner = row.owner;
  if (section === "incomeStreams" && row.linkedAssetId) {
    if (row.linkedAssetId.startsWith("r")) {
      const reAsset = (STATE.nw.global.realEstate || []).find(x => x.id === row.linkedAssetId);
      if (reAsset) {
        resolvedAmt = (+reAsset.monthlyRentIncome || 0) - (+reAsset.monthlyRentExpense || 0);
        resolvedOwner = reAsset.owner;
      }
    } else if (row.linkedAssetId.startsWith("b")) {
      const bizAsset = (STATE.nw.global.businessAssets || []).find(x => x.id === row.linkedAssetId);
      if (bizAsset) {
        resolvedAmt = (+bizAsset.monthlyDividend || 0) * ((+bizAsset.ownershipPct || 0) / 100);
        resolvedOwner = bizAsset.owner;
      }
    }
  }

  STATE.nw._form={
    section,
    mode:"edit",
    id: row.id,
    name: row.name || row.source || row.borrowerName || "",
    source: row.source || "",
    type: row.type || "",
    owner: resolvedOwner || "household",
    principalRemaining: String(row.principalRemaining !== undefined ? row.principalRemaining : ""),
    interestRate: String(row.interestRate !== undefined ? row.interestRate : ""),
    monthlyPayment: String(row.monthlyPayment !== undefined ? row.monthlyPayment : ""),
    currentValue: String(row.currentValue !== undefined ? row.currentValue : ""),
    liquid: !!row.liquid,
    marketValue: String(row.marketValue !== undefined ? row.marketValue : ""),
    monthlyRentIncome: String(row.monthlyRentIncome !== undefined ? row.monthlyRentIncome : ""),
    monthlyRentExpense: String(row.monthlyRentExpense !== undefined ? row.monthlyRentExpense : ""),
    linkedLiabilityId: row.linkedLiabilityId||"",
    monthlyAmount: String(resolvedAmt !== undefined ? resolvedAmt : ""),
    passive: !!row.passive,
    linkedAssetId: row.linkedAssetId||"",
    insured: row.insured || "fern",
    sumAssured: String(row.sumAssured !== undefined ? row.sumAssured : ""),
    cashValue: String(row.cashValue !== undefined ? row.cashValue : ""),
    annualPremium: String(row.annualPremium !== undefined ? row.annualPremium : ""),
    premiumFrequency: row.premiumFrequency || "annual",
    taxDeductible: row.taxDeductible !== undefined ? !!row.taxDeductible : true,
    // business (equity) fields
    ownershipPct: String(row.ownershipPct !== undefined ? row.ownershipPct : ""),
    additionalCapital: String(row.additionalCapital !== undefined ? row.additionalCapital : ""),
    monthlyDividend: String(row.monthlyDividend !== undefined ? row.monthlyDividend : ""),
    // loanBook fields
    borrowerName: row.borrowerName || "",
    principalOutstanding: String(row.principalOutstanding !== undefined ? row.principalOutstanding : ""),
    dueDate: row.dueDate || "",
    businessId: row.businessId || ""
  };
  renderTab();
}

function nwOnIncomeLinkChange(assetId) {
  const f = STATE.nw._form; if (!f) return;
  if (assetId) {
    if (assetId.startsWith("r")) {
      const reAsset = (STATE.nw.global.realEstate || []).find(x => x.id === assetId);
      if (reAsset) {
        f.monthlyAmount = String((+reAsset.monthlyRentIncome || 0) - (+reAsset.monthlyRentExpense || 0));
        f.owner = reAsset.owner;
      }
    } else if (assetId.startsWith("b")) {
      const bizAsset = (STATE.nw.global.businessAssets || []).find(x => x.id === assetId);
      if (bizAsset) {
        f.monthlyAmount = String((+bizAsset.monthlyDividend || 0) * ((+bizAsset.ownershipPct || 0) / 100));
        f.owner = bizAsset.owner;
      }
    }
  } else {
    f.monthlyAmount = "";
  }
  renderTab();
}

function nwCommit(){
  const f=STATE.nw._form; if(!f) return;
  const nameVal = f.section === "incomeStreams" ? f.source.trim() : f.section === "loanBook" ? f.borrowerName.trim() : f.name.trim();
  if(!nameVal){ toast(f.section === "incomeStreams" ? "ใส่แหล่งที่มาก่อน" : f.section === "loanBook" ? "ใส่ชื่อผู้กู้ก่อน" : "ใส่ชื่อก่อน","var(--red)"); return; }
  
  // If income stream is linked to an asset, force owner and amount to match asset values on save
  if (f.section === "incomeStreams" && f.linkedAssetId) {
    if (f.linkedAssetId.startsWith("r")) {
      const reAsset = (STATE.nw.global.realEstate || []).find(x => x.id === f.linkedAssetId);
      if (reAsset) {
        f.monthlyAmount = String((+reAsset.monthlyRentIncome || 0) - (+reAsset.monthlyRentExpense || 0));
        f.owner = reAsset.owner;
      }
    } else if (f.linkedAssetId.startsWith("b")) {
      const bizAsset = (STATE.nw.global.businessAssets || []).find(x => x.id === f.linkedAssetId);
      if (bizAsset) {
        f.monthlyAmount = String((+bizAsset.monthlyDividend || 0) * ((+bizAsset.ownershipPct || 0) / 100));
        f.owner = bizAsset.owner;
      }
    }
  }

  const sp=f.owner ? ownerSplit(f.owner) : { splitFern: 0, splitNut: 0 };
  const snap=nwSnap();
  
  let rowData = {};
  if (f.section !== "loanBook") {
    rowData = {
      name: f.section === "incomeStreams" ? undefined : nameVal,
      source: f.section === "incomeStreams" ? nameVal : undefined,
      type: f.type,
      owner: f.owner || undefined,
      splitFern: f.owner ? sp.splitFern : undefined,
      splitNut: f.owner ? sp.splitNut : undefined
    };
  } else {
    rowData = {
      borrowerName: nameVal
    };
  }

  if(f.section === "liabilities"){
    Object.assign(rowData, {
      principalRemaining: parseFloat(f.principalRemaining)||0,
      interestRate: parseFloat(f.interestRate)||0,
      monthlyPayment: parseFloat(f.monthlyPayment)||0
    });
  } else if(f.section === "assetsOther"){
    Object.assign(rowData, {
      currentValue: parseFloat(f.currentValue)||0,
      liquid: !!f.liquid,
      unit: "THB"
    });
  } else if(f.section === "businessAssets"){
    Object.assign(rowData, {
      ownershipPct: parseFloat(f.ownershipPct)||0,
      additionalCapital: parseFloat(f.additionalCapital)||0,
      monthlyDividend: parseFloat(f.monthlyDividend)||0
    });
  } else if(f.section === "loanBook"){
    Object.assign(rowData, {
      principalOutstanding: parseFloat(f.principalOutstanding)||0,
      interestRate: parseFloat(f.interestRate)||0,
      monthlyPayment: parseFloat(f.monthlyPayment)||0,
      dueDate: f.dueDate || "",
      businessId: f.businessId || ""
    });
  } else if(f.section === "realEstate"){
    Object.assign(rowData, {
      marketValue: parseFloat(f.marketValue)||0,
      monthlyRentIncome: parseFloat(f.monthlyRentIncome)||0,
      monthlyRentExpense: parseFloat(f.monthlyRentExpense)||0,
      linkedLiabilityId: f.linkedLiabilityId || ""
    });
  } else if(f.section === "incomeStreams"){
    Object.assign(rowData, {
      monthlyAmount: parseFloat(f.monthlyAmount)||0,
      passive: !!f.passive,
      linkedAssetId: f.linkedAssetId || ""
    });
  } else if(f.section === "insurance"){
    Object.assign(rowData, {
      insured: f.insured,
      sumAssured: parseFloat(f.sumAssured)||0,
      cashValue: parseFloat(f.cashValue)||0,
      annualPremium: parseFloat(f.annualPremium)||0,
      premiumFrequency: f.premiumFrequency,
      taxDeductible: !!f.taxDeductible
    });
  }

  if(f.mode==="edit"){
    const row=STATE.nw.global[f.section].find(r=>r.id===f.id);
    if(!row) return;
    Object.assign(row, rowData);
    STATE.nw._form=null;
    renderTab();
    apiSave(f.section,"global",STATE.nw.global[f.section])
      .then(()=>toast("บันทึกการแก้ไขแล้ว ✓"))
      .catch(()=>{ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); });
  } else {
    const prefix = f.section === "liabilities" ? "l" 
                 : f.section === "assetsOther" ? "a"
                 : f.section === "businessAssets" ? "b"
                 : f.section === "realEstate" ? "r"
                 : f.section === "insurance" ? "ins"
                 : f.section === "loanBook" ? "lb"
                 : "i";
    rowData.id = prefix + Date.now().toString(36);
    STATE.nw.global[f.section].push(rowData);
    STATE.nw._form=null;
    renderTab();
    apiSave(f.section,"global",STATE.nw.global[f.section])
      .then(()=>toast("เพิ่มแล้ว ✓"))
      .catch(()=>{ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); });
  }
}

function nwDelete(section,id){
  const row=STATE.nw.global[section].find(r=>r.id===id); if(!row) return;
  const dispName = row.name || row.source || row.borrowerName || "";
  if(!confirm(`ลบ "${dispName}" ?`)) return;
  const snap=nwSnap();
  STATE.nw.global[section]=STATE.nw.global[section].filter(r=>r.id!==id);
  renderTab();
  apiSave(section,"global",STATE.nw.global[section])
    .then(()=>toast("ลบแล้ว ✓"))
    .catch(()=>{ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); });
}

function nwSaveCashFlow(fernExp, nutExp){
  const snap=nwSnap();
  let fEntry = STATE.nw.global.cashFlow.find(c => c.profile === "fern");
  if(!fEntry) { fEntry = { profile: "fern" }; STATE.nw.global.cashFlow.push(fEntry); }
  fEntry.monthlyExpense = parseFloat(fernExp)||0;

  let nEntry = STATE.nw.global.cashFlow.find(c => c.profile === "nut");
  if(!nEntry) { nEntry = { profile: "nut" }; STATE.nw.global.cashFlow.push(nEntry); }
  nEntry.monthlyExpense = parseFloat(nutExp)||0;

  renderTab();
  apiSave("cashFlow", "global", STATE.nw.global.cashFlow)
    .then(()=>toast("บันทึกรายจ่ายแล้ว ✓"))
    .catch(()=>{ nwRollback(snap); toast("บันทึกไม่ได้ — ย้อนกลับแล้ว","var(--red)"); });
}

// ── inline-edit helper for legacy triggers ──
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

// อัปเดตตัวเลขสรุปสดๆ ใน DOM
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
  const liab=STATE.nw.global.liabilities || [];
  
  const bizItems = (STATE.nw.global.businessAssets || []).map(x => {
    const share = view === "household" ? 1 : splitFor(x, view);
    const netVal = Math.max(0, (+x.loanBookOutstanding || 0) - (+x.provisionForDoubtful || 0)) * share;
    return `<div style="display:flex;justify-content:space-between;padding:4px 0 4px 12px;font-size:12px;color:var(--text-secondary)">
      <span>• ${x.name} (สำรอง: ${baht(x.provisionForDoubtful * share)})</span>
      <span class="tnum">${baht(netVal)}</span>
    </div>`;
  }).join("");

  const reItems = (STATE.nw.global.realEstate || []).map(x => {
    const share = view === "household" ? 1 : splitFor(x, view);
    const val = (+x.marketValue || 0) * share;
    const linkedLiab = x.linkedLiabilityId ? liab.find(l => l.id === x.linkedLiabilityId) : null;
    const equityText = linkedLiab ? ` (Equity: ${baht(val - (linkedLiab.principalRemaining * share))})` : "";
    return `<div style="display:flex;justify-content:space-between;padding:4px 0 4px 12px;font-size:12px;color:var(--text-secondary)">
      <span>• ${x.name}${equityText}</span>
      <span class="tnum">${baht(val)}</span>
    </div>`;
  }).join("");

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
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:13px">
      <span>ธุรกิจปล่อยกู้ (สุทธิหลังสำรอง)</span>
      <span class="tnum" style="font-weight:600">${baht(r.businessAssets)}</span>
    </div>
    ${bizItems}
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:13px">
      <span>อสังหาฯ ลงทุน (คอนโดเช่า/ที่ดิน)</span>
      <span class="tnum" style="font-weight:600">${baht(r.realEstate)}</span>
    </div>
    ${reItems}
  </div>`;

  // 3. Read-only Liabilities list card
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

  // 3.5 Read-only Income summary card
  const incomeCard=`<div class="card" style="margin-bottom:16px">
    <div class="ctitle">รายได้ต่อเดือน (แสดงผลสรุป)</div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:13px">
      <span>Active Income (เงินเดือน / อื่นๆ)</span>
      <span class="tnum" style="font-weight:600;color:var(--text-primary)">${baht(r.activeIncome)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:13px">
      <span>Passive Income (ดอกเบี้ยรับ / ค่าเช่า)</span>
      <span class="tnum green" style="font-weight:600">${baht(r.passiveIncome)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line);font-size:13px;font-weight:700">
      <span>รายได้รวมต่อเดือน</span>
      <span class="tnum gold" style="font-weight:700">${baht(r.activeIncome + r.passiveIncome)}</span>
    </div>
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
          <input class="num" type="text" inputmode="decimal" value="${fAsset.currentValue||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.currentValue=this.value;}else{this.value=STATE.nw._form.currentValue||'';}" style="width:100%;padding:6px;font-size:13px;text-align:right">
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

  const crudAssetsCard=`<div class="card" style="margin-bottom:20px;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="ctitle" style="margin-bottom:0">จัดการสินทรัพย์อื่น</div>
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:4px 12px;font-size:12px;border-radius:8px" onclick="nwToggleForm('assetsOther')">${fAsset?"✕ ปิด":"＋ เพิ่มสินทรัพย์"}</button>
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
          <input class="num" type="text" inputmode="decimal" value="${fLiab.principalRemaining||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.principalRemaining=this.value;}else{this.value=STATE.nw._form.principalRemaining||'';}" style="width:100%;padding:6px;font-size:13px;text-align:right">
        </div>
        <div>
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">ดอกเบี้ย (%/ปี)</label>
          <input class="num" type="text" inputmode="decimal" value="${fLiab.interestRate||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.interestRate=this.value;}else{this.value=STATE.nw._form.interestRate||'';}" style="width:100%;padding:6px;font-size:13px;text-align:right">
        </div>
        <div style="grid-column:1/-1">
          <label class="muted" style="font-size:10px;display:block;margin-bottom:2px">ค่างวด/เดือน (฿)</label>
          <input class="num" type="text" inputmode="decimal" value="${fLiab.monthlyPayment||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.monthlyPayment=this.value;}else{this.value=STATE.nw._form.monthlyPayment||'';}" style="width:100%;padding:6px;font-size:13px;text-align:right">
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

  const crudLiabCard=`<div class="card" style="margin-bottom:20px;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div class="ctitle" style="margin-bottom:0">จัดการหนี้สิน</div>
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:4px 12px;font-size:12px;border-radius:8px" onclick="nwToggleForm('liabilities')">${fLiab?"✕ ปิด":"＋ เพิ่มหนี้สิน"}</button>
    </div>
    ${liabManageList}
    ${liabForm}
  </div>`;

  // ── 7. CRUD Section: Manage Real Estate ──
  const realEstate=STATE.nw.global.realEstate||[];
  const fRe=STATE.nw._form&&STATE.nw._form.section==="realEstate"?STATE.nw._form:null;
  const typeOptsRe=[["rental_condo","คอนโดปล่อยเช่า"],["land","ที่ดิน"],["other_re","อสังหาฯ อื่นๆ"]];

  const reForm = fRe ? `
    <div style="margin-top:16px;padding:16px;background:var(--bg-input);border-radius:12px;border:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div style="grid-column:1/-1">
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ชื่ออสังหาริมทรัพย์</label>
          <input class="num" type="text" value="${fRe.name}" oninput="STATE.nw._form.name=this.value" style="width:100%;padding:8px 12px;font-size:14px;border-radius:8px">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ประเภท</label>
          <select onchange="STATE.nw._form.type=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
            ${typeOptsRe.map(([v,l])=>`<option value="${v}" ${fRe.type===v?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">เจ้าของ</label>
          <select onchange="STATE.nw._form.owner=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
            ${[["household","ถือร่วม 50/50"],["fern","เฟิร์น"],["nut","นัท"]].map(([v,l])=>`<option value="${v}" ${fRe.owner===v?"selected":""}>${l}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">มูลค่าตลาดปัจจุบัน (฿)</label>
          <input class="num" type="text" inputmode="decimal" value="${fRe.marketValue||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.marketValue=this.value;}else{this.value=STATE.nw._form.marketValue||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ค่าเช่ารับ/เดือน (฿)</label>
          <input class="num" type="text" inputmode="decimal" value="${fRe.monthlyRentIncome||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.monthlyRentIncome=this.value;}else{this.value=STATE.nw._form.monthlyRentIncome||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ค่าใช้จ่ายอสังหาฯ/เดือน (฿)</label>
          <input class="num" type="text" inputmode="decimal" value="${fRe.monthlyRentExpense||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.monthlyRentExpense=this.value;}else{this.value=STATE.nw._form.monthlyRentExpense||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
        </div>
        <div style="grid-column:1/-1">
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">เชื่อมโยงกับหนี้สิน (linkedLiabilityId - หักยอดหนี้คอนโดอัตโนมัติ)</label>
          <select onchange="STATE.nw._form.linkedLiabilityId=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
            <option value="">-- ไม่เชื่อมโยงหนี้สิน --</option>
            ${liab.map(l=>`<option value="${l.id}" ${fRe.linkedLiabilityId===l.id?"selected":""}>${l.name} (${baht(l.principalRemaining)})</option>`).join("")}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn" onclick="nwCommit()" style="flex:1;background:linear-gradient(135deg,var(--accent-gold2),var(--accent-gold));color:#09090b;font-weight:600;padding:10px;border-radius:8px">${fRe.mode==="edit"?"บันทึกการแก้ไข ✓":"เพิ่มอสังหาฯ ✓"}</button>
        <button class="btn" onclick="nwToggleForm('realEstate')" style="flex:1;background:var(--ink3);color:var(--text-secondary);border:1px solid var(--border);font-weight:600;padding:10px;border-radius:8px">ยกเลิก</button>
      </div>
    </div>` : "";

  const reManageList = realEstate.length
    ? realEstate.map(x=>{
        const linkedText = x.linkedLiabilityId ? ` (ผูกหนี้: ${liab.find(l=>l.id===x.linkedLiabilityId)?.name || x.linkedLiabilityId})` : "";
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--line);font-size:13px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:var(--text-primary);font-size:14px">${x.name} <span class="muted" style="font-size:10px">(${x.owner==="household"?"ถือร่วม":x.owner==="fern"?"เฟิร์น":"นัท"})${linkedText}</span></div>
            <div class="muted" style="font-size:11px;margin-top:4px">
              มูลค่าประเมิน: <span style="font-weight:600;color:var(--text-primary)">${baht(x.marketValue)}</span> · ค่าเช่ารับ: ${baht(x.monthlyRentIncome)}/ด. · ค่าใช้จ่าย: ${baht(x.monthlyRentExpense)}/ด.
            </div>
          </div>
          <div style="display:flex;gap:14px;align-items:center">
            <button class="btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:12px;font-weight:700;padding:4px" onclick="nwEditRow('realEstate','${x.id}')">แก้ไข</button>
            <button class="btn" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:12px;font-weight:700;padding:4px" onclick="nwDelete('realEstate','${x.id}')">ลบ</button>
          </div>
        </div>`;
      }).join("")
    : `<div class="muted" style="font-size:12px;padding:8px 0">ยังไม่มีรายการอสังหาริมทรัพย์</div>`;

  const crudReCard=`<div class="card" style="margin-bottom:20px;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="ctitle" style="margin-bottom:0">จัดการอสังหาฯ ลงทุน</div>
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:6px 14px;font-size:12px;border-radius:8px" onclick="nwToggleForm('realEstate')">${fRe?"✕ ปิด":"＋ เพิ่มอสังหาฯ"}</button>
    </div>
    ${reManageList}
    ${reForm}
  </div>`;

  // ── 8. CRUD Section: Manage Income Streams ──
  const incomeStreams=STATE.nw.global.incomeStreams||[];
  const fInc=STATE.nw._form&&STATE.nw._form.section==="incomeStreams"?STATE.nw._form:null;
  const typeOptsInc=[["salary","เงินเดือน"],["business_interest","ดอกเบี้ยรับธุรกิจ"],["rental","ค่าเช่าอสังหาฯ"],["other","รายได้อื่นๆ"]];

  // Resolve incomeStreams inline for rendering in the list
  const resolvedStreams = incomeStreams.map(x => {
    let amt = +x.monthlyAmount || 0;
    let own = x.owner || "household";
    let linkLabel = "";
    if (x.linkedAssetId) {
      if (x.linkedAssetId.startsWith("r")) {
        const reAsset = realEstate.find(y => y.id === x.linkedAssetId);
        if (reAsset) {
          amt = (+reAsset.monthlyRentIncome || 0) - (+reAsset.monthlyRentExpense || 0);
          own = reAsset.owner;
          linkLabel = ` (ดึงค่าจากอสังหาฯ: ${reAsset.name})`;
        }
      } else if (x.linkedAssetId.startsWith("b")) {
        const bizAsset = businessAssets.find(y => y.id === x.linkedAssetId);
        if (bizAsset) {
          amt = (+bizAsset.monthlyDividend || 0) * ((+bizAsset.ownershipPct || 0) / 100);
          own = bizAsset.owner;
          linkLabel = ` (ดึงปันผลจากธุรกิจ: ${bizAsset.name})`;
        }
      }
    }
    return { ...x, monthlyAmount: amt, owner: own, linkLabel };
  });

  const incForm = fInc ? (() => {
    const isLinked = !!fInc.linkedAssetId;
    return `
      <div style="margin-top:16px;padding:16px;background:var(--bg-input);border-radius:12px;border:1px solid var(--border)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div style="grid-column:1/-1">
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">แหล่งที่มา / รายละเอียดรายได้</label>
            <input class="num" type="text" value="${fInc.source}" oninput="STATE.nw._form.source=this.value" style="width:100%;padding:8px 12px;font-size:14px;border-radius:8px">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ประเภทรายได้</label>
            <select onchange="STATE.nw._form.type=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
              ${typeOptsInc.map(([v,l])=>`<option value="${v}" ${fInc.type===v?"selected":""}>${l}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">เจ้าของรายได้</label>
            <select ${isLinked ? "disabled style='background:var(--border);opacity:0.7;cursor:not-allowed;'" : ""} onchange="STATE.nw._form.owner=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
              ${[["household","ถือร่วม 50/50"],["fern","เฟิร์น"],["nut","นัท"]].map(([v,l])=>`<option value="${v}" ${fInc.owner===v?"selected":""}>${l}</option>`).join("")}
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ยอดเงินสุทธิ/เดือน (฿) ${isLinked ? `<span style="color:var(--accent-gold);font-size:10px">(ดึงจากทรัพย์)</span>` : ""}</label>
            <input class="num" type="text" inputmode="decimal" value="${fInc.monthlyAmount||""}" ${isLinked ? "readonly style='background:var(--border);opacity:0.7;cursor:not-allowed;'" : ""} oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.monthlyAmount=this.value;}else{this.value=STATE.nw._form.monthlyAmount||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
          </div>
          <div style="display:flex;align-items:flex-end;padding-bottom:6px">
            <label style="font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" ${fInc.passive?"checked":""} onchange="STATE.nw._form.passive=this.checked"> Passive Income
            </label>
          </div>
          <div style="grid-column:1/-1">
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">เชื่อมโยงกับสินทรัพย์ต้นทาง (linkedAssetId - option)</label>
            <select onchange="STATE.nw._form.linkedAssetId=this.value; nwOnIncomeLinkChange(this.value);" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
              <option value="">-- ไม่เชื่อมโยง --</option>
              ${businessAssets.map(b=>`<option value="${b.id}" ${fInc.linkedAssetId===b.id?"selected":""}>[ธุรกิจ] ${b.name}</option>`).join("")}
              ${realEstate.map(r=>`<option value="${r.id}" ${fInc.linkedAssetId===r.id?"selected":""}>[อสังหาฯ] ${r.name}</option>`).join("")}
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn" onclick="nwCommit()" style="flex:1;background:linear-gradient(135deg,var(--accent-gold2),var(--accent-gold));color:#09090b;font-weight:600;padding:10px;border-radius:8px">${fInc.mode==="edit"?"บันทึกการแก้ไข ✓":"เพิ่มรายได้ ✓"}</button>
          <button class="btn" onclick="nwToggleForm('incomeStreams')" style="flex:1;background:var(--ink3);color:var(--text-secondary);border:1px solid var(--border);font-weight:600;padding:10px;border-radius:8px">ยกเลิก</button>
        </div>
      </div>`;
  })() : "";

  const incManageList = resolvedStreams.length
    ? resolvedStreams.map(x=>{
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--line);font-size:13px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:var(--text-primary);font-size:14px">${x.source} <span class="muted" style="font-size:10px">(${x.owner==="household"?"ถือร่วม":x.owner==="fern"?"เฟิร์น":"นัท"})</span><span style="color:var(--accent-gold);font-size:11px">${x.linkLabel}</span></div>
            <div class="muted" style="font-size:11px;margin-top:4px">
              จำนวนเงิน: <span style="font-weight:600;color:var(--text-primary)">${baht(x.monthlyAmount)}/ด.</span> · ประเภท: ${x.type === "salary" ? "เงินเดือน" : x.type === "business_interest" ? "ดอกเบี้ย" : x.type === "rental" ? "ค่าเช่า" : "อื่นๆ"} (${x.passive ? "Passive" : "Active"})
            </div>
          </div>
          <div style="display:flex;gap:14px;align-items:center">
            <button class="btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:12px;font-weight:700;padding:4px" onclick="nwEditRow('incomeStreams','${x.id}')">แก้ไข</button>
            <button class="btn" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:12px;font-weight:700;padding:4px" onclick="nwDelete('incomeStreams','${x.id}')">ลบ</button>
          </div>
        </div>`;
      }).join("")
    : `<div class="muted" style="font-size:12px;padding:8px 0">ยังไม่มีรายการแหล่งรายได้</div>`;

  const crudIncCard=`<div class="card" style="margin-bottom:0;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div class="ctitle" style="margin-bottom:0">จัดการแหล่งรายได้</div>
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:6px 14px;font-size:12px;border-radius:8px" onclick="nwToggleForm('incomeStreams')">${fInc?"✕ ปิด":"＋ เพิ่มรายได้"}</button>
    </div>
    ${incManageList}
    ${incForm}
  </div>`;

  // ── 9. CRUD Section: Cash Flow ──
  const cashFlow = STATE.nw.global.cashFlow || [];
  const fernExpObj = cashFlow.find(c => c.profile === "fern") || { monthlyExpense: 0 };
  const nutExpObj = cashFlow.find(c => c.profile === "nut") || { monthlyExpense: 0 };

  const crudCashFlowCard = `
    <div class="card" style="margin-top:20px;padding:20px">
      <div class="ctitle" style="margin-bottom:14px">จัดการกระแสเงินสด / ค่าใช้จ่ายประจำ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">รายจ่ายประจำ/เดือน ของเฟิร์น (฿)</label>
          <input id="cf-fern-exp" class="num" type="text" inputmode="decimal" value="${fernExpObj.monthlyExpense || ""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){}else{this.value=this.dataset.old||'';} this.dataset.old=this.value;" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">รายจ่ายประจำ/เดือน ของนัท (฿)</label>
          <input id="cf-nut-exp" class="num" type="text" inputmode="decimal" value="${nutExpObj.monthlyExpense || ""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){}else{this.value=this.dataset.old||'';} this.dataset.old=this.value;" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
        </div>
      </div>
      <button class="btn" onclick="nwSaveCashFlow(document.getElementById('cf-fern-exp').value, document.getElementById('cf-nut-exp').value)" style="width:100%;background:linear-gradient(135deg,var(--accent-gold2),var(--accent-gold));color:#09090b;font-weight:600;padding:10px;border-radius:8px">บันทึกรายจ่ายประจำ ✓</button>
    </div>
  `;

  // ── 10. CRUD Section: Manage Insurance ──
  const insurance = STATE.nw.global.insurance || [];
  const fIns = STATE.nw._form && STATE.nw._form.section === "insurance" ? STATE.nw._form : null;

  const insForm = fIns ? `
    <div style="margin-top:16px;padding:16px;background:var(--bg-input);border-radius:12px;border:1px solid var(--border)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div style="grid-column:1/-1">
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ชื่อกรมธรรม์ / บริษัทประกัน</label>
          <input class="num" type="text" value="${fIns.name}" oninput="STATE.nw._form.name=this.value" style="width:100%;padding:8px 12px;font-size:14px;border-radius:8px">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ประเภทประกัน</label>
          <select onchange="STATE.nw._form.type=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
            <option value="life" ${fIns.type==="life"?"selected":""}>ประกันชีวิต</option>
            <option value="health" ${fIns.type==="health"?"selected":""}>ประกันสุขภาพ</option>
          </select>
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ผู้เอาประกัน</label>
          <select onchange="STATE.nw._form.insured=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
            <option value="fern" ${fIns.insured==="fern"?"selected":""}>เฟิร์น</option>
            <option value="nut" ${fIns.insured==="nut"?"selected":""}>นัท</option>
          </select>
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ทุนประกัน (฿)</label>
          <input class="num" type="text" inputmode="decimal" value="${fIns.sumAssured||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.sumAssured=this.value;}else{this.value=STATE.nw._form.sumAssured||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">มูลค่าเวนคืน (฿)</label>
          <input class="num" type="text" inputmode="decimal" value="${fIns.cashValue||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.cashValue=this.value;}else{this.value=STATE.nw._form.cashValue||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">เบี้ยประกัน/ปี (฿)</label>
          <input class="num" type="text" inputmode="decimal" value="${fIns.annualPremium||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.annualPremium=this.value;}else{this.value=STATE.nw._form.annualPremium||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
        </div>
        <div>
          <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ความถี่การชำระเบี้ย</label>
          <select onchange="STATE.nw._form.premiumFrequency=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
            <option value="annual" ${fIns.premiumFrequency==="annual"?"selected":""}>รายปี</option>
            <option value="monthly" ${fIns.premiumFrequency==="monthly"?"selected":""}>รายเดือน</option>
          </select>
        </div>
        <div style="grid-column:1/-1;display:flex;align-items:center;padding-top:4px">
          <label style="font-size:11px;display:flex;align-items:center;gap:6px;cursor:pointer">
            <input type="checkbox" ${fIns.taxDeductible?"checked":""} onchange="STATE.nw._form.taxDeductible=this.checked"> ลดหย่อนภาษีได้
          </label>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn" onclick="nwCommit()" style="flex:1;background:linear-gradient(135deg,var(--accent-gold2),var(--accent-gold));color:#09090b;font-weight:600;padding:10px;border-radius:8px">${fIns.mode==="edit"?"บันทึกการแก้ไข ✓":"เพิ่มประกัน ✓"}</button>
        <button class="btn" onclick="nwToggleForm('insurance')" style="flex:1;background:var(--ink3);color:var(--text-secondary);border:1px solid var(--border);font-weight:600;padding:10px;border-radius:8px">ยกเลิก</button>
      </div>
    </div>` : "";

  const insManageList = insurance.length
    ? insurance.map(x=>{
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--line);font-size:13px">
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:var(--text-primary);font-size:14px">${x.name} <span class="muted" style="font-size:10px">(${x.insured === "fern" ? "เฟิร์น" : "นัท"})</span></div>
            <div class="muted" style="font-size:11px;margin-top:4px">
              ทุนประกัน: <span style="font-weight:600;color:var(--text-primary)">${baht(x.sumAssured)}</span> · เวนคืน: ${baht(x.cashValue)} · เบี้ย: ${baht(x.annualPremium)}/${x.premiumFrequency === "annual" ? "ปี" : "ด."}
              ${x.taxDeductible ? ' · <span style="color:var(--accent-gold);font-size:10px">ลดหย่อนได้</span>' : ''}
            </div>
          </div>
          <div style="display:flex;gap:14px;align-items:center">
            <button class="btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:12px;font-weight:700;padding:4px" onclick="nwEditRow('insurance','${x.id}')">แก้ไข</button>
            <button class="btn" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:12px;font-weight:700;padding:4px" onclick="nwDelete('insurance','${x.id}')">ลบ</button>
          </div>
        </div>`;
      }).join("")
    : `<div class="muted" style="font-size:12px;padding:8px 0">ยังไม่มีรายการกรมธรรม์ประกันภัย</div>`;

  const crudInsuranceCard = `
    <div class="card" style="margin-top:20px;margin-bottom:0;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div class="ctitle" style="margin-bottom:0">จัดการกรมธรรม์ประกันภัย</div>
        <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:6px 14px;font-size:12px;border-radius:8px" onclick="nwToggleForm('insurance')">${fIns?"✕ ปิด":"＋ เพิ่มประกัน"}</button>
      </div>
      ${insManageList}
      ${insForm}
    </div>
  `;

  m.innerHTML=head+assetsCard+liabSummaryCard+incomeCard+crudAssetsCard+crudLiabCard+crudReCard+crudIncCard+crudCashFlowCard+crudInsuranceCard;
}

// ── 11. Dedicated Business Tab (Phase 3a) ──
function tabBusiness(m){
  nwInit();
  if(STATE.nw.error){
    m.innerHTML=`<div class="card"><div class="red">โหลดข้อมูลธุรกิจไม่ได้</div><div class="muted" style="font-size:12px;margin-top:6px">${STATE.nw.error}</div></div>`;
    return;
  }
  const other=STATE.profile==="fern"?"nut":"fern";
  if((STATE.nw[other]==null||STATE.nw.global==null)){
    m.innerHTML=`<div class="center" style="padding:40px"><span class="spin"></span><span class="muted" style="font-size:12px;letter-spacing:2px">กำลังโหลดข้อมูลธุรกิจ…</span></div>`;
    if(!STATE.nw.loading) nwLoad().then(()=>renderTab());
    return;
  }

  const businessAssets = STATE.nw.global.businessAssets || [];
  const loanBook = STATE.nw.global.loanBook || [];

  const fBiz = STATE.nw._form && STATE.nw._form.section === "businessAssets" ? STATE.nw._form : null;
  const fLoan = STATE.nw._form && STATE.nw._form.section === "loanBook" ? STATE.nw._form : null;

  // Company management forms and list
  let companiesHtml = "";
  if (businessAssets.length === 0) {
    const defaultBizForm = fBiz ? `
      <div style="margin-top:16px;padding:16px;background:var(--bg-input);border-radius:12px;border:1px solid var(--border)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div style="grid-column:1/-1">
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ชื่อบริษัท</label>
            <input class="num" type="text" value="${fBiz.name}" oninput="STATE.nw._form.name=this.value" style="width:100%;padding:8px 12px;font-size:14px;border-radius:8px">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">สัดส่วนการถือหุ้นรวม (%)</label>
            <input class="num" type="text" inputmode="decimal" value="${fBiz.ownershipPct||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.ownershipPct=this.value;}else{this.value=STATE.nw._form.ownershipPct||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ทุน/เงินสดบริษัท (฿)</label>
            <input class="num" type="text" inputmode="decimal" value="${fBiz.additionalCapital||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.additionalCapital=this.value;}else{this.value=STATE.nw._form.additionalCapital||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
          </div>
          <div style="grid-column:1/-1">
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">เงินปันผลจ่ายของบริษัท/เดือน (฿)</label>
            <input class="num" type="text" inputmode="decimal" value="${fBiz.monthlyDividend||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.monthlyDividend=this.value;}else{this.value=STATE.nw._form.monthlyDividend||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
          </div>
          <div>
            <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">สิทธิ์ผู้เป็นเจ้าของ</label>
            <select onchange="STATE.nw._form.owner=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
              <option value="household" ${fBiz.owner==="household"?"selected":""}>ถือร่วม 50/50</option>
              <option value="fern" ${fBiz.owner==="fern"?"selected":""}>เฟิร์น</option>
              <option value="nut" ${fBiz.owner==="nut"?"selected":""}>นัท</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn" onclick="nwCommit()" style="flex:1;background:linear-gradient(135deg,var(--accent-gold2),var(--accent-gold));color:#09090b;font-weight:600;padding:10px;border-radius:8px">เพิ่มบริษัท ✓</button>
          <button class="btn" onclick="nwToggleForm('businessAssets')" style="flex:1;background:var(--ink3);color:var(--text-secondary);border:1px solid var(--border);font-weight:600;padding:10px;border-radius:8px">ยกเลิก</button>
        </div>
      </div>
    ` : "";
    companiesHtml = `
      <div class="card" style="text-align:center;padding:32px">
        <div class="muted" style="font-size:13px;margin-bottom:16px">ยังไม่มีรายการบริษัทปล่อยจำนองในระบบ</div>
        <button class="btn" style="padding:8px 18px;font-size:13px;border-radius:8px" onclick="nwToggleForm('businessAssets')">＋ เพิ่มบริษัท</button>
        ${defaultBizForm}
      </div>
    `;
  } else {
    companiesHtml = businessAssets.map(biz => {
      const loans = loanBook.filter(l => l.businessId === biz.id);
      const loansSum = loans.reduce((s, l) => s + (+l.principalOutstanding || 0), 0);
      const equity = loansSum + (+biz.additionalCapital || 0);

      const isCurrentBizForm = fBiz && fBiz.id === biz.id;
      const isCurrentLoanForm = fLoan && fLoan.businessId === biz.id;

      const activeBizForm = isCurrentBizForm ? `
        <div style="margin-top:16px;padding:16px;background:var(--bg-input);border-radius:12px;border:1px solid var(--border)">
          <div style="font-weight:700;margin-bottom:12px;font-size:13px">แก้ไขข้อมูลบริษัท</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
            <div style="grid-column:1/-1">
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ชื่อบริษัท</label>
              <input class="num" type="text" value="${fBiz.name}" oninput="STATE.nw._form.name=this.value" style="width:100%;padding:8px 12px;font-size:14px;border-radius:8px">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">สัดส่วนการถือหุ้นรวม (%)</label>
              <input class="num" type="text" inputmode="decimal" value="${fBiz.ownershipPct||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.ownershipPct=this.value;}else{this.value=STATE.nw._form.ownershipPct||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ทุน/เงินสดบริษัท (฿)</label>
              <input class="num" type="text" inputmode="decimal" value="${fBiz.additionalCapital||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.additionalCapital=this.value;}else{this.value=STATE.nw._form.additionalCapital||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
            </div>
            <div style="grid-column:1/-1">
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">เงินปันผลจ่ายของบริษัท/เดือน (฿)</label>
              <input class="num" type="text" inputmode="decimal" value="${fBiz.monthlyDividend||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.monthlyDividend=this.value;}else{this.value=STATE.nw._form.monthlyDividend||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">สิทธิ์ผู้เป็นเจ้าของ</label>
              <select onchange="STATE.nw._form.owner=this.value" style="width:100%;padding:8px;font-size:13px;border-radius:8px;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border)">
                <option value="household" ${fBiz.owner==="household"?"selected":""}>ถือร่วม 50/50</option>
                <option value="fern" ${fBiz.owner==="fern"?"selected":""}>เฟิร์น</option>
                <option value="nut" ${fBiz.owner==="nut"?"selected":""}>นัท</option>
              </select>
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn" onclick="nwCommit()" style="flex:1;background:linear-gradient(135deg,var(--accent-gold2),var(--accent-gold));color:#09090b;font-weight:600;padding:10px;border-radius:8px">บันทึกการแก้ไข ✓</button>
            <button class="btn" onclick="nwToggleForm('businessAssets')" style="flex:1;background:var(--ink3);color:var(--text-secondary);border:1px solid var(--border);font-weight:600;padding:10px;border-radius:8px">ยกเลิก</button>
          </div>
        </div>
      ` : "";

      const activeLoanForm = isCurrentLoanForm ? `
        <div style="margin-top:16px;padding:16px;background:var(--bg-input);border-radius:12px;border:1px solid var(--border)">
          <div style="font-weight:700;margin-bottom:12px;font-size:13px">${fLoan.mode==="edit"?"แก้ไขข้อมูลลูกหนี้":"เพิ่มลูกหนี้"}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
            <div style="grid-column:1/-1">
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">ชื่อผู้กู้ (ลูกหนี้)</label>
              <input class="num" type="text" value="${fLoan.borrowerName}" oninput="STATE.nw._form.borrowerName=this.value" style="width:100%;padding:8px 12px;font-size:14px;border-radius:8px">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">เงินต้นคงค้าง (฿)</label>
              <input class="num" type="text" inputmode="decimal" value="${fLoan.principalOutstanding||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.principalOutstanding=this.value;}else{this.value=STATE.nw._form.principalOutstanding||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">อัตราดอกเบี้ย (% ต่อปี)</label>
              <input class="num" type="text" inputmode="decimal" value="${fLoan.interestRate||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.interestRate=this.value;}else{this.value=STATE.nw._form.interestRate||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">งวดชำระ/เดือน (฿)</label>
              <input class="num" type="text" inputmode="decimal" value="${fLoan.monthlyPayment||""}" oninput="if(/^\\d*\\.?\\d*$/.test(this.value)){STATE.nw._form.monthlyPayment=this.value;}else{this.value=STATE.nw._form.monthlyPayment||'';}" style="width:100%;padding:8px 12px;font-size:14px;text-align:right;border-radius:8px">
            </div>
            <div>
              <label style="display:block;margin-bottom:4px;font-size:11px;font-weight:500;color:var(--text-secondary)">วันครบกำหนด (เช่น YYYY-MM)</label>
              <input class="num" type="text" placeholder="2027-06" value="${fLoan.dueDate}" oninput="STATE.nw._form.dueDate=this.value" style="width:100%;padding:8px 12px;font-size:14px;border-radius:8px">
            </div>
          </div>
          <div style="display:flex;gap:10px">
            <button class="btn" onclick="nwCommit()" style="flex:1;background:linear-gradient(135deg,var(--accent-gold2),var(--accent-gold));color:#09090b;font-weight:600;padding:10px;border-radius:8px">${fLoan.mode==="edit"?"บันทึกการแก้ไข ✓":"เพิ่มลูกหนี้ ✓"}</button>
            <button class="btn" onclick="nwToggleForm('loanBook')" style="flex:1;background:var(--ink3);color:var(--text-secondary);border:1px solid var(--border);font-weight:600;padding:10px;border-radius:8px">ยกเลิก</button>
          </div>
        </div>
      ` : "";

      const loansListHtml = loans.length
        ? loans.map(l => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-top:1px solid var(--line);font-size:13px">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;color:var(--text-primary);font-size:14px">${l.borrowerName}</div>
                <div class="muted" style="font-size:11px;margin-top:4px">
                  เงินต้น: <span style="font-weight:600;color:var(--text-primary)">${baht(l.principalOutstanding)}</span> · ดอกเบี้ย: ${l.interestRate}%/ปี · ค่างวด: ${baht(l.monthlyPayment)}/ด. · ครบกำหนด: ${l.dueDate||"-"}
                </div>
              </div>
              <div style="display:flex;gap:12px;align-items:center">
                <button class="btn" style="background:none;border:none;color:var(--accent-gold);cursor:pointer;font-size:12px;font-weight:700;padding:4px" onclick="nwEditRow('loanBook','${l.id}')">แก้ไข</button>
                <button class="btn" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:12px;font-weight:700;padding:4px" onclick="nwDelete('loanBook','${l.id}')">ลบ</button>
              </div>
            </div>
          `).join("")
        : `<div class="muted" style="font-size:12px;padding:12px 0">ยังไม่มีรายชื่อลูกหนี้ในสมุดเงินกู้</div>`;

      const ownerLabel = biz.owner === "household" ? "ถือร่วม 50/50" : biz.owner === "fern" ? "เฟิร์น" : "นัท";

      return `
        <div class="card" style="margin-bottom:20px;padding:20px">
          <!-- การ์ดบริษัท -->
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">
            <div>
              <div style="font-size:18px;font-weight:800;color:var(--gold)">${biz.name}</div>
              <div class="muted" style="font-size:12px;margin-top:4px">
                ถือหุ้นรวม: <span style="font-weight:600;color:var(--text-primary)">${biz.ownershipPct}%</span> (${ownerLabel})
              </div>
            </div>
            <div style="display:flex;gap:10px">
              <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:6px 14px;font-size:12px;border-radius:8px" onclick="nwEditRow('businessAssets','${biz.id}')">แก้ไขบริษัท</button>
              <button class="btn" style="background:none;border:none;color:var(--accent-red);cursor:pointer;font-size:12px;font-weight:700;padding:6px" onclick="nwDelete('businessAssets','${biz.id}')">ลบ</button>
            </div>
          </div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px;background:var(--bg-input);border-radius:10px;margin-bottom:20px;font-size:13px">
            <div>
              <span class="muted" style="font-size:11px">Equity รวมของบริษัท:</span>
              <div style="font-size:16px;font-weight:700;color:var(--green);margin-top:2px">${baht(equity)}</div>
            </div>
            <div>
              <span class="muted" style="font-size:11px">ปันผลจ่ายของบริษัท/เดือน:</span>
              <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-top:2px">${baht(biz.monthlyDividend)}</div>
            </div>
            <div style="grid-column:1/-1;font-size:10px;padding-top:4px;border-top:1px solid var(--line)" class="muted">
              * คำนวณอัตโนมัติ: เงินต้นลูกหนี้ ${baht(loansSum)} + ทุนบริษัท ${baht(biz.additionalCapital)}
            </div>
          </div>
          
          ${activeBizForm}

          <!-- ส่วนจัดการลูกหนี้ (Loan Book) -->
          <div style="border-top:1px solid var(--border);padding-top:20px;margin-top:10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <div style="font-weight:700;font-size:14px;color:var(--text-primary)">ลูกหนี้ (Loan Book)</div>
              <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:4px 10px;font-size:11px;border-radius:6px" onclick="nwToggleForm('loanBook')">＋ เพิ่มลูกหนี้</button>
            </div>
            
            ${loansListHtml}
            ${activeLoanForm}
            
            <div class="muted" style="font-size:11px;margin-top:14px;border-top:1px solid var(--line);padding-top:10px">
              รวมเงินต้นคงค้างทั้งหมด: <span style="font-weight:600;color:var(--text-primary)">${baht(loansSum)}</span> → ไหลเข้า Equity บริษัทอัตโนมัติ
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  const addCompanyBtn = businessAssets.length > 0 ? `
    <div style="text-align:right;margin-bottom:16px">
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line);padding:6px 14px;font-size:12px;border-radius:8px" onclick="nwToggleForm('businessAssets')">＋ เพิ่มบริษัทใหม่</button>
    </div>
  ` : "";

  m.innerHTML = `
    ${addCompanyBtn}
    <div style="margin-bottom:16px">
      ${companiesHtml}
    </div>
  `;
}
