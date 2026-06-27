// ╔══════════════════════════════════════════════════╗
// ║  lib/render.js — ฟังก์ชัน render ทั้งหมด           ║
// ║  อ่าน STATE (global) แต่ไม่ mutate data / API      ║
// ╚══════════════════════════════════════════════════╝

// ── computed shortcuts ──
function total(){return sumValues(STATE.assets);}
function byClass(){return groupByClass(STATE.assets,CK);}
function byBucket(){return groupByBucket(STATE.assets);}
function buckets(){return [...new Set(STATE.assets.map(a=>a.bucket))];}

function alerts(){
  const out=[],t=total(),bc=byClass();

  // helper: top assets of a class (non-zero, sorted by value desc)
  const topOf=(cls,n=3)=>STATE.assets
    .filter(a=>a.asset_class===cls&&(+a.value||0)>0)
    .sort((a,b)=>(+b.value||0)-(+a.value||0))
    .slice(0,n);

  // helper: assets with active DCA plan in a class
  const dcaOf=(cls)=>STATE.assets.filter(a=>a.asset_class===cls&&(+a.plan||0)>0);

  CK.forEach(k=>{
    const c=cls(k);
    const pct=t?bc[k]/t*100:0, tgt=c.target, d=pct-tgt;
    const excess=Math.round((pct-tgt)/100*t);
    const deficit=Math.round((tgt-pct)/100*t);
    if(tgt===0) return; // ซ่อน class ที่ตั้ง target=0 ออกจาก alert

    // ── Thai Equity overweight ──
    if(k==="thai_equity"&&d>5){
      const sellable=STATE.assets
        .filter(a=>a.asset_class==="thai_equity"&&!["PVD"].includes(a.bucket)&&(+a.value||0)>0)
        .sort((a,b)=>(+b.value||0)-(+a.value||0));
      out.push({w:1,
        title:`หุ้นไทย ${pct.toFixed(1)}% — เกินเป้า ${tgt}% อยู่ ${d.toFixed(1)}%`,
        body:`เกินเป้า ~${baht(excess)} · หยุด DCA หุ้นไทยทั้งหมด ปล่อยให้เจือจางเอง`,
        action:sellable.length
          ?`พิจารณาขาย/สวิตช์: ${sellable.map(a=>a.name).join(", ")} → เพิ่มสัดส่วน dm_core`
          :`PVD เป็นหุ้นไทยหลัก — ปล่อยเจือจางตามการเติบโตของพอร์ตรวม`,
        chips:sellable.map(a=>a.name),
      });
    }

    // ── Thai Equity slightly over ──
    if(k==="thai_equity"&&d>2&&d<=5){
      out.push({w:0,
        title:`หุ้นไทย ${pct.toFixed(1)}% — เกินเป้าเล็กน้อย`,
        body:`เกินเป้า ~${baht(excess)} · หยุด DCA หุ้นไทยไว้ก่อน`,
        action:`ไม่ต้องเทขาย — ปล่อยพอร์ตส่วนอื่นโต แล้วสัดส่วนจะลดเอง`,
      });
    }

    // ── dm_core underweight ──
    if(k==="dm_core"&&d<-5){
      const dca=dcaOf("dm_core");
      out.push({w:0,
        title:`หุ้นกระจาย (Global) ${pct.toFixed(1)}% — ต่ำกว่าเป้า ${tgt}%`,
        body:`ขาดอยู่ ~${baht(deficit)} · ควรเป็นกลุ่มหลักของพอร์ต`,
        action:dca.length
          ?`เพิ่มวงเงิน DCA: ${dca.map(a=>`${a.name} (${baht(a.plan)}/ด.)`).join(", ")}`
          :`เริ่ม DCA กองหุ้นโลก เช่น KKP GNP RMF / SCBS&P500 เพื่อเติมสัดส่วน`,
      });
    }

    // ── Gold underweight ──
    if(k==="gold"&&d<-3){
      const dca=dcaOf("gold");
      out.push({w:0,
        title:`ทองคำ ${pct.toFixed(1)}% — ต่ำกว่าเป้า ${tgt}%`,
        body:`ขาดอยู่ ~${baht(deficit)} · ทองคำช่วย hedge ความผันผวน`,
        action:dca.length
          ?`DCA ต่อเนื่อง: ${dca.map(a=>a.name).join(", ")} (${baht(dca.reduce((s,a)=>s+(+a.plan||0),0))}/ด.)`
          :`เพิ่ม DCA กองทอง เช่น SCBGOLDHRMF เข้าแผนเดือนนี้`,
      });
    }

    // ── Tech ceiling breach ──
    if(k==="dm_tech"&&c.ceiling){
      const ceil=c.ceiling;
      if(pct>ceil){
        const top=topOf("dm_tech",2);
        out.push({w:1,
          title:`Tech ${pct.toFixed(1)}% — เกิน ceiling ${ceil}%`,
          body:`เกิน ceiling ~${baht(excess)} · ความเสี่ยงกระจุกตัวสูง`,
          action:`หยุด DCA Tech ทั้งหมด${top.length?` · รอโอกาสสวิตช์บางส่วนจาก: ${top.map(a=>a.name).join(", ")} → dm_core`:""}`,
          chips:top.map(a=>a.name),
        });
      } else if(pct>ceil-2){
        out.push({w:0,
          title:`Tech ${pct.toFixed(1)}% — ใกล้ ceiling ${ceil}%`,
          body:`เหลือห่าง ceiling แค่ ${(ceil-pct).toFixed(1)}% (~${baht(Math.round((ceil-pct)/100*t))})`,
          action:`ชะลอ DCA Tech — ถ้าตลาดขึ้นแรงอาจชน ceiling เร็ว`,
        });
      }
    }

    // ── China over ceiling ──
    if(k==="em_china"&&c.ceiling){
      const ceil=c.ceiling;
      if(pct>ceil){
        const top=topOf("em_china",2);
        out.push({w:1,
          title:`จีน ${pct.toFixed(1)}% — เกิน ceiling ${ceil}%`,
          body:`เกิน ceiling ~${baht(excess)} · จีนเป็น tactical เท่านั้น`,
          action:`หยุด DCA จีน${top.length?` · พิจารณาสวิตช์: ${top.map(a=>a.name).join(", ")} → em_growth (อินเดีย/เวียดนาม)`:""}`,
          chips:top.map(a=>a.name),
        });
      }
    }

    // ── EM Growth underweight ──
    if(k==="em_growth"&&d<-3){
      const dca=dcaOf("em_growth");
      out.push({w:0,
        title:`EM โต (อินเดีย+เวียดนาม) ${pct.toFixed(1)}% — ต่ำกว่าเป้า ${tgt}%`,
        body:`ขาดอยู่ ~${baht(deficit)} · เป็น satellite ที่มี upside สูง`,
        action:dca.length
          ?`เพิ่ม DCA: ${dca.map(a=>a.name).join(", ")}`
          :`เริ่ม DCA กองอินเดีย/เวียดนาม เช่น B-INDIARMF / KFVIETRMF`,
      });
    }

    // ── REIT missing ──
    if(k==="reit"&&pct<0.5&&tgt>0){
      out.push({w:0,
        title:`REIT ${pct.toFixed(1)}% — ต่ำมาก (เป้า ${tgt}%)`,
        body:`ขาดอยู่ ~${baht(deficit)} · REIT ให้ yield และ diversify`,
        action:`พิจารณาเพิ่ม REIT เช่น SCBFP-SSF ในรอบลงทุนถัดไป`,
      });
    }
  });

  // ── Retirement bucket near cap ──
  const dt=derivedTax(), ru=(+dt.rmf||0)+(+dt.pvd||0)+(+dt.ssf||0)+(+dt.pension||0);
  if(ru/500000>0.9){
    out.push({w:1,
      title:`กลุ่มเกษียณ ${(ru/500000*100).toFixed(0)}% ของ 500k — ใกล้เต็ม`,
      body:`ใช้ไปแล้ว ${baht(ru)} จาก 500k`,
      action:`เหลือ ${baht(500000-ru)} — ใช้ ThaiESG หรือประกันบำนาญแทน`,
    });
  }

  return out;
}

// ╔══════════ RENDER ══════════╗
function render(loading){
  const app=$("#app");
  if(loading){app.innerHTML=`<div class="center"><span class="spin"></span><span class="muted" style="letter-spacing:3px;font-size:12px">กำลังโหลด ${STATE.profile}…</span></div>`;return;}
  const t=total();
  app.innerHTML=`
    <header>
      <div><div class="eyebrow">UNIFIED PORTFOLIO</div><h1>Wealth Ledger</h1></div>
      <div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <label class="theme-toggle" onclick="toggleTheme()">
          <span>🌙</span>
          <div class="tog-track"><div class="tog-thumb"></div></div>
          <span>☀️</span>
        </label>
        <div>
          <div class="sub">มูลค่ารวม</div>
          <div class="total">${baht(t)}</div>
          <div class="sub">${STATE.profile==="fern"?"เฟิร์น":"นัท"}</div>
        </div>
      </div>
    </header>
    <div class="profiles">
      <button class="pf ${STATE.profile==="fern"?"on":""}" onclick="switchProfile('fern')">เฟิร์น</button>
      <button class="pf ${STATE.profile==="nut"?"on":""}" onclick="switchProfile('nut')">นัท</button>
    </div>
    <nav>
      ${[["overview","ภาพรวม"],["update","อัปเดต"],["dca","แผน DCA"],["growth","เติบโต"],["tax","ภาษี"]]
        .map(([k,l])=>`<button class="tab ${STATE.tab===k?"on":""}" onclick="go('${k}')">${l}</button>`).join("")}
    </nav>
    <main id="main"></main>`;
  renderTab();
}
function renderTab(){
  const m=$("#main"); if(!m)return;
  if(STATE._error){m.innerHTML=`<div class="card"><div class="red">เชื่อมต่อไม่ได้</div><div class="muted" style="font-size:12px;margin-top:6px">${STATE._error}</div><div class="muted" style="font-size:11px;margin-top:8px">เช็คว่า API_URL ถูกต้อง และ deploy เป็น Anyone</div></div>`;return;}
  if(STATE.assets.length===0 && STATE.tab!=="tax"){
    m.innerHTML=`<div class="card" style="text-align:center;padding:36px">
      <div class="gold" style="font-size:15px;margin-bottom:8px">ยังไม่มีข้อมูล</div>
      <div class="muted" style="font-size:13px;line-height:1.6;margin-bottom:16px">โหลดข้อมูลตั้งต้นของ${STATE.profile==="fern"?"เฟิร์น":"นัท"} แล้วกดบันทึก</div>
      <button class="btn" onclick="loadSeed()">โหลด seed เริ่มต้น</button></div>`;return;
  }
  ({overview:tabOverview,update:tabUpdate,dca:tabDCA,growth:tabGrowth,tax:tabTax}[STATE.tab])(m);
}

function tabOverview(m){
  const t=total(),bc=byClass(),bb=byBucket();

  // ── alerts ──
  const alertsHtml=alerts().map(a=>{
    const col=a.w?'var(--red)':'var(--gold)';
    const chips=a.chips&&a.chips.length
      ?`<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${a.chips.map(n=>`<span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${a.w?'rgba(216,116,95,.15)':'rgba(200,163,91,.12)'};color:${col};border:1px solid ${col}40">${n}</span>`).join('')}</div>`
      :'';
    return `<div class="alert ${a.w?'warn':''}" style="padding:13px 15px">
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:${a.body||a.action?6:0}px">
        <span style="color:${col};font-weight:700;font-size:13px;flex-shrink:0;margin-top:1px">${a.w?'▲':'›'}</span>
        <span style="font-size:13px;font-weight:600;line-height:1.4">${a.title||a.t||''}</span>
      </div>
      ${a.body?`<div class="muted" style="font-size:11px;line-height:1.5;margin-left:21px;margin-bottom:${a.action?5:0}px">${a.body}</div>`:''}
      ${a.action?`<div style="margin-left:21px;font-size:11px;line-height:1.5;color:${col};background:${a.w?'rgba(216,116,95,.08)':'rgba(200,163,91,.08)'};border-radius:7px;padding:6px 9px">⟶ ${a.action}</div>`:''}
      ${chips}
    </div>`;
  }).join("");

  // ── donut ──
  const entries=Object.entries(bb);
  const sz=140,sk=24,rad=(sz-sk)/2,circ=2*Math.PI*rad; let off=0;
  const segs=entries.map(([b,v],i)=>{const len=(t?v/t:0)*circ;const s=`<circle cx="${sz/2}" cy="${sz/2}" r="${rad}" fill="none" stroke="${BUCKET_COLORS[i%6]}" stroke-width="${sk}" stroke-dasharray="${len} ${circ-len}" stroke-dashoffset="${-off}"/>`;off+=len;return s;}).join("");
  const donutHtml=`<div class="card" style="margin-bottom:0">
    <div class="ctitle">กระเป๋าสินทรัพย์</div>
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <svg width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" style="flex-shrink:0">
        <g transform="rotate(-90 ${sz/2} ${sz/2})">${segs}</g>
        <text x="50%" y="44%" text-anchor="middle" fill="var(--mute)" font-size="10">รวม</text>
        <text x="50%" y="60%" text-anchor="middle" fill="var(--gold)" font-size="15" font-weight="700">${(t/1e6).toFixed(2)}M</text>
      </svg>
      <div style="flex:1;min-width:120px">
        ${entries.map(([b,v],i)=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-top:1px solid var(--line)">
          <span style="display:flex;align-items:center;gap:6px;font-size:12px"><span class="dot" style="background:${BUCKET_COLORS[i%6]}"></span>${b}</span>
          <span style="font-size:12px;font-weight:600;color:${BUCKET_COLORS[i%6]};font-variant-numeric:tabular-nums">${(t?v/t*100:0).toFixed(0)}%</span>
        </div>`).join("")}
      </div>
    </div>
  </div>`;

  // ── dilution ──
  let dilutionHtml="";
  const thai=bc.thai_equity||0,thaiPct=t?thai/t*100:0,thaiTgt=cls("thai_equity").target;
  if(thaiPct>thaiTgt+1){
    let tt=thai,rest=t-thai,rows=[{y:0,p:thaiPct}],yr=0;
    for(let i=1;i<=6;i++){tt*=1.04;rest=rest*1.07+420000;const p=tt/(tt+rest)*100;rows.push({y:i,p});if(p<=thaiTgt&&!yr)yr=i;}
    dilutionHtml=`<div class="card" style="margin-bottom:0"><div class="ctitle">คาดการณ์: หุ้นไทยเจือจางเอง</div>
      <div style="font-size:12px;line-height:1.6;margin-bottom:12px;color:var(--mute)">หยุดเติมหุ้นไทย → ลด ${thaiPct.toFixed(0)}% สู่เป้า ${thaiTgt}% ใน <b class="gold">~${yr||">6"} ปี</b></div>
      <div style="display:flex;align-items:flex-end;gap:6px;height:100px">${rows.map(rw=>{const hh=12+(rw.p/thaiPct)*76;const hit=rw.p<=thaiTgt;return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px"><span style="font-size:9px;color:${hit?'var(--green)':'var(--mute)'}">${rw.p.toFixed(0)}%</span><div style="width:100%;max-width:28px;height:${hh}px;background:${hit?'var(--green)':'linear-gradient(180deg,#D8745F,#A85647)'};border-radius:3px 3px 0 0"></div><span class="muted" style="font-size:8px">${rw.y===0?'now':'+'+rw.y+'y'}</span></div>`;}).join("")}</div></div>`;
  }

  // ── asset class mini-cards (always 2-col on mobile, 4-col on desktop via CSS) ──
  let cardsHtml="";
  CK.forEach(k=>{
    const c=cls(k);
    const pct=t?bc[k]/t*100:0,tgt=c.target,d=pct-tgt;
    if(tgt===0) return; // ซ่อน class ที่ target=0 (เช่น REIT สำหรับนัท)
    cardsHtml+=`<div class="mini-card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
        <span style="font-size:10px;color:${c.color};font-weight:600;line-height:1.3">${c.label}</span>
        <span style="font-size:10px;color:${Math.abs(d)<2?"var(--green)":d>0?"var(--red)":"var(--mute)"};flex-shrink:0;margin-left:4px">${d>0?"+":""}${d.toFixed(1)}%</span>
      </div>
      <div class="track" style="margin-bottom:7px">
        <div class="fill" style="width:${Math.min(pct,100)}%;background:${c.color}"></div>
        <div class="tick" style="left:${Math.min(tgt,100)}%"></div>
        ${c.ceiling?`<div class="ceil" style="left:${Math.min(c.ceiling,100)}%"></div>`:""}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <span class="tnum" style="font-size:16px;font-weight:700;color:${c.color}">${pct.toFixed(1)}%</span>
        <span class="muted" style="font-size:9px">เป้า ${tgt}%</span>
      </div>
      <div class="muted tnum" style="font-size:11px;margin-top:2px">${baht(bc[k])}</div>
    </div>`;
  });

  m.innerHTML=`<div class="dash-overview">
    <div class="ov-left">
      ${alertsHtml}
      ${donutHtml}
      ${dilutionHtml}
    </div>
    <div class="ov-right g2">${cardsHtml}</div>
  </div>`;
}

function tabUpdate(m){
  const t=total();
  const af=STATE._addForm;

  let h=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <div><div style="font-size:15px;font-weight:600">มูลค่ารายสินทรัพย์</div>
    <div class="muted" style="font-size:12px">เปิดแอป คัดมูลค่ามาใส่ แล้วบันทึก</div></div>
    <div style="display:flex;gap:8px">
      <button class="btn" style="background:var(--ink3);color:var(--mute);border:1px solid var(--line);font-size:12px" onclick="syncSeedPlans()">↻ plan</button>
      <button class="btn" style="background:var(--ink3);color:var(--gold);border:1px solid var(--line)" onclick="toggleAddForm()">＋ เพิ่ม</button>
      ${STATE.editing?`<button class="btn" onclick="saveAll()">บันทึก ✓</button>`:`<button class="btn" onclick="toggleEdit()">แก้ไข</button>`}
    </div>
  </div>`;

  // ── Add asset form ──
  if(af){
    const bkOpts=[...new Set(STATE.assets.map(a=>a.bucket))];
    h+=`<div class="card" style="margin-bottom:16px;border-color:var(--gold)">
      <div class="ctitle">สินทรัพย์ใหม่</div>
      <div class="g2">
        <div style="grid-column:1/-1">
          <div class="muted" style="font-size:11px;margin-bottom:4px">ชื่อกองทุน / หุ้น</div>
          <input class="num" type="text" placeholder="เช่น KFGGRMF" value="${af.name}"
            oninput="STATE._addForm.name=this.value" style="width:100%">
        </div>
        <div>
          <div class="muted" style="font-size:11px;margin-bottom:4px">กระเป๋า</div>
          <input class="num" type="text" list="bk-list" placeholder="RMF / PVD / ..." value="${af.bucket}"
            oninput="STATE._addForm.bucket=this.value" style="width:100%">
          <datalist id="bk-list">${bkOpts.map(b=>`<option value="${b}">`).join("")}</datalist>
        </div>
        <div>
          <div class="muted" style="font-size:11px;margin-bottom:4px">ประเภทสินทรัพย์</div>
          <select onchange="STATE._addForm.asset_class=this.value"
            style="width:100%;background:var(--ink3);color:var(--text);border:1px solid var(--line);
                   border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit">
            ${CK.map(k=>`<option value="${k}" ${af.asset_class===k?"selected":""}>${CLASSES[k].label}</option>`).join("")}
          </select>
        </div>
        <div>
          <div class="muted" style="font-size:11px;margin-bottom:4px">มูลค่าปัจจุบัน (฿)</div>
          <input class="num" type="text" inputmode="numeric" placeholder="0" value="${af.value||""}"
            oninput="STATE._addForm.value=num(this.value)" style="width:100%">
        </div>
        <div>
          <div class="muted" style="font-size:11px;margin-bottom:4px">แผน DCA/เดือน (฿)</div>
          <input class="num" type="text" inputmode="numeric" placeholder="0" value="${af.plan||""}"
            oninput="STATE._addForm.plan=num(this.value)" style="width:100%">
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn" onclick="commitAddAsset()" style="flex:1">เพิ่มสินทรัพย์ ✓</button>
        <button class="btn" onclick="toggleAddForm()" style="flex:1;background:var(--ink3);color:var(--mute);border:1px solid var(--line)">ยกเลิก</button>
      </div>
    </div>`;
  }

  buckets().forEach(b=>{
    const assets=STATE.assets.filter(a=>a.bucket===b);
    const bTotal=assets.reduce((s,a)=>s+(+a.value||0),0);
    h+=`<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;padding:0 2px">
        <span style="font-size:11px;color:var(--gold2);letter-spacing:2px;font-weight:600">${b}</span>
        <span class="tnum muted" style="font-size:12px">${baht(bTotal)}</span>
      </div>
      <div class="g2">`;
    assets.forEach(a=>{
      h+=`<div class="mini-card" style="position:relative">
        ${STATE.editing?`<button onclick="deleteAsset('${a.id}')"
          style="position:absolute;top:8px;right:8px;background:rgba(216,116,95,.15);border:none;
                 color:var(--red);font-size:12px;cursor:pointer;border-radius:6px;padding:2px 7px;line-height:1.4;font-family:inherit">✕</button>`:""}
        <div style="font-size:10px;color:${CLASSES[a.asset_class].color};margin-bottom:6px;padding-right:${STATE.editing?"24px":"0"}">${CLASSES[a.asset_class].label}</div>
        <div style="font-size:12px;font-weight:600;margin-bottom:10px;line-height:1.3;padding-right:${STATE.editing?"24px":"0"}">${a.name}</div>
        ${STATE.editing
          ?`<input class="num" type="text" inputmode="numeric" value="${a.value}" oninput="setVal('${a.id}',this.value)" style="width:100%;font-size:15px">`
          :`<div class="tnum" style="font-size:16px;font-weight:700;color:var(--gold)">${baht(a.value)}</div>`}
      </div>`;
    });
    h+=`</div></div>`;
  });

  h+=`<div class="mini-card" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
    <span class="muted" style="font-size:13px">รวมทั้งหมด</span>
    <span id="update-total" class="gold tnum" style="font-size:22px;font-weight:700">${baht(t)}</span>
  </div>`;
  m.innerHTML=h;
}

// ── DCA Impact simulation ──
function setDcaMonths(mo){
  STATE._dcaMonths=mo;
  const sl=document.getElementById('dca-months-slider');
  const lbl=document.getElementById('dca-months-label');
  if(sl) sl.value=mo;
  if(lbl) lbl.textContent=mo+' เดือน';
  document.querySelectorAll('.dca-preset-btn').forEach(b=>{
    const active=+b.dataset.mo===mo;
    b.style.background=active?'linear-gradient(135deg,var(--gold2),var(--gold))':'var(--ink3)';
    b.style.color=active?'var(--ink)':'var(--mute)';
  });
  renderDcaImpact();
}

function renderDcaImpact(){
  const el=document.getElementById('dca-impact');
  if(!el) return;
  const months=STATE._dcaMonths||12;
  const t=total();
  const tp=STATE.assets.reduce((s,a)=>s+(+a.plan||0),0);

  const curByClass={}, dcaByClass={};
  CK.forEach(k=>{curByClass[k]=0; dcaByClass[k]=0;});
  STATE.assets.forEach(a=>{
    curByClass[a.asset_class]=(curByClass[a.asset_class]||0)+(+a.value||0);
    if(+a.plan>0) dcaByClass[a.asset_class]=(dcaByClass[a.asset_class]||0)+(+a.plan||0);
  });

  const projByClass={};
  CK.forEach(k=>projByClass[k]=(curByClass[k]||0)+(dcaByClass[k]||0)*months);
  const projTotal=t+tp*months;

  const activeKeys=CK.filter(k=>cls(k).target>0||curByClass[k]>0||dcaByClass[k]>0);

  const mkBar=(byClass,tot)=>activeKeys.map(k=>{
    const pct=tot?(byClass[k]||0)/tot*100:0;
    return pct>0.05?`<div title="${cls(k).label}: ${pct.toFixed(1)}%" style="width:${pct.toFixed(2)}%;background:${cls(k).color};height:100%;transition:width .25s ease"></div>`:'';
  }).join('');

  const tgtBar=activeKeys.map(k=>{
    const tgt=cls(k).target;
    return tgt>0?`<div style="width:${tgt}%;background:${cls(k).color};opacity:.4;height:100%"></div>`:'';
  }).join('');

  const rows=activeKeys.map(k=>{
    const c=cls(k);
    const curPct=t?(curByClass[k]||0)/t*100:0;
    const projPct=projTotal?(projByClass[k]||0)/projTotal*100:0;
    const delta=projPct-curPct;
    const dca=dcaByClass[k]||0;
    const vsTarget=projPct-c.target;
    return {k,c,curPct,projPct,delta,dca,vsTarget};
  });

  el.innerHTML=`
    <div style="display:grid;grid-template-columns:40px 1fr;gap:8px;align-items:center;margin-bottom:16px">
      <span class="muted" style="font-size:9px;letter-spacing:.5px">ตอนนี้</span>
      <div>
        <div style="display:flex;height:12px;border-radius:5px;overflow:hidden;background:var(--ink3)">${mkBar(curByClass,t)}</div>
        <div class="muted tnum" style="font-size:9px;text-align:right;margin-top:2px">${(t/1e6).toFixed(2)}M</div>
      </div>
      <span class="muted" style="font-size:9px;letter-spacing:.5px">+${months}ด.</span>
      <div>
        <div style="display:flex;height:12px;border-radius:5px;overflow:hidden;background:var(--ink3)">${mkBar(projByClass,projTotal)}</div>
        <div style="font-size:9px;text-align:right;margin-top:2px;color:var(--green);font-variant-numeric:tabular-nums">${(projTotal/1e6).toFixed(2)}M <span class="muted">(+${baht(tp*months)})</span></div>
      </div>
      <span class="muted" style="font-size:9px;letter-spacing:.5px">เป้า</span>
      <div style="display:flex;height:12px;border-radius:5px;overflow:hidden;background:var(--ink3)">${tgtBar}</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
      ${activeKeys.filter(k=>dcaByClass[k]>0).map(k=>`
        <div style="display:flex;align-items:center;gap:4px;font-size:10px">
          <span style="width:7px;height:7px;border-radius:2px;background:${cls(k).color};display:inline-block;flex-shrink:0"></span>
          <span style="color:var(--mute)">${cls(k).label}</span>
          <span class="gold tnum" style="font-weight:600">${baht(dcaByClass[k])}/ด.</span>
        </div>`).join('<span style="color:var(--line)">·</span>')}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead><tr>
        <th style="text-align:left;padding:4px 4px 4px 0;color:var(--mute);font-size:9px;font-weight:600;letter-spacing:.5px;border-bottom:1px solid var(--line)">ประเภท</th>
        <th style="text-align:right;padding:4px 0;color:var(--mute);font-size:9px;font-weight:600;border-bottom:1px solid var(--line)">ตอนนี้</th>
        <th style="text-align:right;padding:4px 0;color:var(--mute);font-size:9px;font-weight:600;border-bottom:1px solid var(--line)">+${months}ด.</th>
        <th style="text-align:right;padding:4px 0;color:var(--mute);font-size:9px;font-weight:600;border-bottom:1px solid var(--line)">เปลี่ยน</th>
        <th style="text-align:right;padding:4px 0;color:var(--mute);font-size:9px;font-weight:600;border-bottom:1px solid var(--line)">เป้า</th>
      </tr></thead>
      <tbody>
        ${rows.map(r=>`
          <tr>
            <td style="padding:6px 4px 6px 0;border-top:1px solid var(--line)">
              <div style="display:flex;align-items:center;gap:5px">
                <span style="width:7px;height:7px;border-radius:2px;background:${r.c.color};flex-shrink:0;display:inline-block"></span>
                <span style="font-size:10px;line-height:1.3">${r.c.label}</span>
                ${r.dca>0?`<span class="gold tnum" style="font-size:9px;opacity:.8">+${baht(r.dca)}</span>`:''}
              </div>
            </td>
            <td style="text-align:right;padding:6px 0;border-top:1px solid var(--line);color:var(--mute);font-variant-numeric:tabular-nums">${r.curPct.toFixed(1)}%</td>
            <td style="text-align:right;padding:6px 0;border-top:1px solid var(--line);font-weight:700;font-variant-numeric:tabular-nums">${r.projPct.toFixed(1)}%</td>
            <td style="text-align:right;padding:6px 0;border-top:1px solid var(--line);font-weight:700;font-variant-numeric:tabular-nums;font-size:12px;color:${r.delta>0.3?'var(--green)':r.delta<-0.3?'var(--red)':'var(--mute)'}">
              ${r.delta>=0?'▲':'▼'}${Math.abs(r.delta).toFixed(1)}%
            </td>
            <td style="text-align:right;padding:6px 0;border-top:1px solid var(--line);font-variant-numeric:tabular-nums;color:${Math.abs(r.vsTarget)<1?'var(--green)':r.vsTarget>3?'var(--red)':'var(--mute)'}">
              ${r.c.target}%${Math.abs(r.vsTarget)<1?' ✓':r.vsTarget>3?' ▲':r.vsTarget<-3?' ▼':''}
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="muted" style="font-size:9px;margin-top:8px;line-height:1.5">* DCA สะสม ${months} เดือน · ไม่รวมผลตอบแทน / rebalance · สีเขียว = เพิ่มสัดส่วน · สีแดง = ลดสัดส่วน (dilute)</div>
  `;
}

function tabDCA(m){
  const pvdAssets=STATE.assets.filter(a=>a.bucket==='PVD');
  const nonPvd=STATE.assets.filter(a=>a.bucket!=='PVD');
  const planned=nonPvd.filter(a=>+a.plan>0||a._isEditingDca);
  const notPlanned=nonPvd.filter(a=>!(+a.plan>0)&&!a._isEditingDca);
  const tp=STATE.assets.reduce((s,a)=>s+(+a.plan||0),0);
  const cls={}; STATE.assets.forEach(a=>{if(+a.plan>0)cls[a.asset_class]=(cls[a.asset_class]||0)+(+a.plan);});

  const dcaF=STATE._dcaAddForm;
  const bkOpts=[...new Set(STATE.assets.map(a=>a.bucket))];

  let h=`<div class="card" style="padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div class="muted" style="font-size:10px;letter-spacing:2px">รายเดือนทั้งหมด</div>
        <div id="dca-monthly-total" class="gold tnum" style="font-size:28px;font-weight:700;line-height:1.2">${baht(tp)}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        ${notPlanned.length?`<select onchange="addDcaFund(this.value);this.value=''"
          style="background:var(--ink3);color:var(--text);border:1px solid var(--line);border-radius:10px;
                 padding:8px 10px;font-size:12px;font-family:inherit;max-width:130px">
          <option value="">จากพอร์ต…</option>
          ${notPlanned.map(a=>`<option value="${a.id}">${a.name}</option>`).join('')}
        </select>`:''}
        <button class="btn" onclick="toggleDcaAddForm()"
          style="${dcaF?'background:var(--ink3);color:var(--mute);border:1px solid var(--line)':''}">
          ${dcaF?'ยกเลิก':'＋ กองใหม่'}
        </button>
      </div>
    </div>

    ${dcaF?`<div style="border:1px solid var(--gold);border-radius:12px;padding:14px;margin-bottom:14px">
      <div style="font-size:12px;color:var(--gold2);font-weight:600;letter-spacing:1px;margin-bottom:12px">เพิ่มกอง DCA ใหม่</div>
      <div class="g2">
        <div style="grid-column:1/-1">
          <div class="muted" style="font-size:11px;margin-bottom:4px">ชื่อกองทุน / ติ๊กเกอร์</div>
          <input class="num" type="text" placeholder="เช่น BRMFCHINAA" value="${dcaF.name}"
            oninput="STATE._dcaAddForm.name=this.value"
            style="width:100%;text-align:left" autofocus>
        </div>
        <div>
          <div class="muted" style="font-size:11px;margin-bottom:4px">กระเป๋า</div>
          <input class="num" type="text" list="dca-bk-list" placeholder="BBLAM / RMF / …" value="${dcaF.bucket}"
            oninput="STATE._dcaAddForm.bucket=this.value" style="width:100%;text-align:left">
          <datalist id="dca-bk-list">${bkOpts.map(b=>`<option value="${b}">`).join('')}</datalist>
        </div>
        <div>
          <div class="muted" style="font-size:11px;margin-bottom:4px">ประเภทสินทรัพย์</div>
          <select onchange="STATE._dcaAddForm.asset_class=this.value"
            style="width:100%;background:var(--ink3);color:var(--text);border:1px solid var(--line);
                   border-radius:8px;padding:8px 10px;font-size:12px;font-family:inherit">
            ${CK.map(k=>`<option value="${k}"${dcaF.asset_class===k?' selected':''}>${CLASSES[k].label}</option>`).join('')}
          </select>
        </div>
        <div>
          <div class="muted" style="font-size:11px;margin-bottom:4px">จำนวน / เดือน (฿)</div>
          <input class="num" type="text" inputmode="numeric" placeholder="0" value="${dcaF.plan||''}"
            oninput="STATE._dcaAddForm.plan=num(this.value)" style="width:100%">
        </div>
      </div>
      <button class="btn" onclick="commitDcaNewFund()" style="width:100%;margin-top:12px">เพิ่มกองนี้ ✓</button>
    </div>`:''}

    ${!planned.length&&!dcaF?`<div class="muted" style="text-align:center;padding:20px 0;font-size:13px">ยังไม่มีกอง — กด "＋ กองใหม่" หรือเลือกจากพอร์ต</div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${planned.map(a=>`
        <div style="background:var(--ink3);border-radius:12px;padding:14px;position:relative${a._isEditingDca?';outline:2px solid var(--gold)':''}">
          <button onclick="removeDcaFund('${a.id}')"
            style="position:absolute;top:8px;right:10px;background:none;border:none;
                   color:var(--mute);font-size:14px;cursor:pointer;line-height:1">×</button>
          <div style="font-size:11px;color:${CLASSES[a.asset_class].color};margin-bottom:4px">${CLASSES[a.asset_class].label}</div>
          <div style="font-size:13px;font-weight:600;margin-bottom:10px;padding-right:16px;line-height:1.3">${a.name}</div>
          <input class="num" type="text" inputmode="numeric" value="${+a.plan||''}"
            placeholder="กรอกจำนวน"
            oninput="setPlan('${a.id}',this.value)"
            ${a._isEditingDca?'autofocus':''}
            style="width:100%;padding:6px 8px;font-size:16px;font-weight:700;background:var(--ink2)">
          <div class="muted" style="font-size:10px;margin-top:4px">บาท / เดือน</div>
        </div>`).join('')}
    </div>
  </div>`;

  // ── PVD สมทบรายเดือน ──
  if(pvdAssets.length){
    const pvdTotal=pvdAssets.reduce((s,a)=>s+(+a.plan||0),0);
    const pctSum=pvdAssets.reduce((s,a)=>s+(+a.pvd_pct||0),0);
    h+=`<div class="card" style="padding:18px">
      <div class="ctitle" style="margin-bottom:12px">PVD สมทบรายเดือน</div>
      <div style="margin-bottom:14px">
        <div class="muted" style="font-size:11px;margin-bottom:4px">ยอดสมทบรวม (฿/เดือน)</div>
        <input class="num" type="text" inputmode="numeric"
          value="${STATE._pvdMonthly||''}" placeholder="0"
          oninput="setPvdTotal(this.value)"
          style="width:100%;font-size:22px;font-weight:700">
      </div>
      <div style="display:grid;gap:8px">
        ${pvdAssets.map(a=>`
          <div style="display:grid;grid-template-columns:1fr 64px 100px;gap:8px;align-items:center;
               background:var(--ink3);border-radius:10px;padding:10px 12px">
            <div>
              <div style="font-size:10px;color:${CLASSES[a.asset_class].color};margin-bottom:2px">${CLASSES[a.asset_class].label}</div>
              <div style="font-size:12px;font-weight:600">${a.name}</div>
            </div>
            <div>
              <input class="num" type="text" inputmode="numeric"
                value="${+a.pvd_pct||''}" placeholder="0"
                oninput="setPvdPct('${a.id}',this.value)"
                style="width:100%;font-size:15px;font-weight:700;text-align:center;padding:4px 6px">
              <div class="muted" style="font-size:9px;text-align:center;margin-top:2px">%</div>
            </div>
            <div class="tnum" style="font-size:15px;font-weight:700;color:var(--gold);text-align:right">
              ${baht(+a.plan||0)}
            </div>
          </div>`).join('')}
      </div>
      ${pctSum>0&&pctSum!==100?`<div style="font-size:11px;margin-top:8px;text-align:right;color:var(--red)">รวม % = ${pctSum}% (ต้องรวมเป็น 100)</div>`:''}
    </div>`;
  }

  // breakdown แนวนอน
  if(tp>0){
    h+=`<div class="card" style="padding:18px">
      <div class="ctitle">สัดส่วนรายเดือน</div>
      <div style="display:flex;height:10px;border-radius:6px;overflow:hidden;margin-bottom:14px">
        ${CK.filter(k=>cls[k]).map(k=>`<div style="width:${(cls[k]/tp*100).toFixed(1)}%;background:${CLASSES[k].color}"></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${CK.filter(k=>cls[k]).map(k=>`
          <div style="display:flex;align-items:center;gap:8px">
            <span class="dot" style="background:${CLASSES[k].color};flex-shrink:0"></span>
            <div style="min-width:0">
              <div style="font-size:11px;color:${CLASSES[k].color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${CLASSES[k].label}</div>
              <div class="tnum" style="font-size:13px;font-weight:600">${baht(cls[k])} <span class="muted" style="font-size:10px">${(cls[k]/tp*100).toFixed(0)}%</span></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  // ── ผลต่อ Asset Allocation ──
  const impMonths=STATE._dcaMonths||12;
  h+=`<div class="card" style="padding:18px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="ctitle" style="margin-bottom:0">ผลต่อ Asset Allocation</div>
      <span id="dca-months-label" class="gold tnum" style="font-size:13px;font-weight:700">${impMonths} เดือน</span>
    </div>
    <input id="dca-months-slider" type="range" min="1" max="60" value="${impMonths}" step="1"
      oninput="setDcaMonths(+this.value)" style="margin-bottom:8px">
    <div style="display:flex;gap:4px;margin-bottom:14px">
      ${[3,6,12,24,36,60].map(mo=>`<button class="dca-preset-btn" data-mo="${mo}" onclick="setDcaMonths(${mo})"
        style="flex:1;background:${impMonths===mo?'linear-gradient(135deg,var(--gold2),var(--gold))':'var(--ink3)'};color:${impMonths===mo?'var(--ink)':'var(--mute)'};border:1px solid var(--line);border-radius:7px;padding:4px 0;font-size:10px;cursor:pointer;font-family:inherit;font-weight:600">${mo<12?mo+'ด.':(mo/12)===1?'1ปี':(mo/12)+'ปี'}</button>`).join('')}
    </div>
    <div id="dca-impact"></div>
  </div>`;

  m.innerHTML=h;
  renderDcaImpact();
}

function tabGrowth(m){
  const hs=STATE.snapshots;
  if(!hs.length){m.innerHTML=`<div class="card" style="text-align:center;padding:40px"><div class="gold" style="font-size:15px;margin-bottom:8px">ยังไม่มีประวัติ</div><div class="muted" style="font-size:13px">ไปแท็บอัปเดต กรอกแล้วกดบันทึก จะเก็บ snapshot ให้</div></div>`;return;}
  const max=Math.max(...hs.map(s=>s.total)),min=Math.min(...hs.map(s=>s.total),0),rng=max-min||1;
  const first=hs[0].total,last=hs[hs.length-1].total,g=first?((last-first)/first*100):0;
  let h=`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <div class="ctitle" style="margin-bottom:0">Net Worth รายเดือน</div>
      <div style="font-size:13px;font-weight:600;color:${g>=0?'var(--green)':'var(--red)'}">${g>=0?"▲":"▼"} ${Math.abs(g).toFixed(1)}%</div>
    </div>
    <div class="muted" style="font-size:11px;margin-bottom:16px">กดปุ่ม ✕ ใต้แท่งเพื่อลบ snapshot ที่ผิดพลาด</div>
    <div style="display:flex;align-items:flex-end;gap:8px;height:180px;margin-top:4px">
      ${hs.map(s=>{
        const hpx=24+((s.total-min)/rng)*130;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
          <span class="muted tnum" style="font-size:9px">${(s.total/1e6).toFixed(2)}M</span>
          <div style="width:100%;max-width:38px;height:${hpx}px;background:linear-gradient(180deg,#E4CF9B,#C8A35B);border-radius:4px 4px 0 0"></div>
          <span class="muted" style="font-size:10px">${s.month}</span>
          <button onclick="deleteSnapshot('${s.month}')"
            title="ลบ snapshot นี้"
            style="background:none;border:1px solid var(--line);color:var(--mute);font-size:9px;
                   border-radius:4px;padding:1px 5px;cursor:pointer;font-family:inherit;line-height:1.4">✕</button>
        </div>`;
      }).join("")}
    </div>
  </div>`;
  m.innerHTML=h;
}

// ── iTAX render helpers ──
function buildBracketThermoHtml(r, bi){
  if(bi.atBottom) return `<div style="text-align:center;padding:10px;color:var(--green);font-size:13px">✓ อยู่ขั้นภาษีต่ำสุด (0%) แล้ว</div>`;
  const EDGES=[150000,300000,500000,750000,1000000,2000000,5000000];
  let lower=0;
  for(const e of EDGES){if(r.net>e)lower=e;else break;}
  const upper=EDGES[EDGES.indexOf(lower)+1]??10000000;
  const pct=Math.min((r.net-lower)/(upper-lower)*100,100);
  const danger=pct>70, close=bi.need<(upper-lower)*0.2;
  const fillColor=danger?'linear-gradient(90deg,var(--green),var(--red))':'linear-gradient(90deg,var(--green),var(--gold))';
  return `<div style="margin-bottom:4px;display:flex;justify-content:space-between">
    <span style="font-size:10px;color:var(--mute)">ขั้น ${(bi.lowerRate*100).toFixed(0)}%  ←  ขั้น ${(bi.curRate*100).toFixed(0)}%</span>
    <span style="font-size:10px;color:${close?'var(--green)':'var(--mute)'}">${pct.toFixed(0)}% เต็มขั้น</span>
  </div>
  <div class="thermo-bar">
    <div class="thermo-fill" style="width:${pct}%;background:${fillColor}"></div>
    <div class="thermo-label"><span style="font-size:10px;font-weight:700;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.6)">${baht(r.net)}</span></div>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:6px">
    <span style="font-size:10px;color:var(--mute)">${baht(lower)}</span>
    <span style="font-size:10px;font-weight:${close?700:400};color:${close?'var(--green)':'var(--gold)'}">
      ${close?'✓ ใกล้แล้ว — ':''}ลดอีก ${baht(bi.need)} → ตกขั้น
    </span>
    <span style="font-size:10px;color:var(--mute)">${baht(upper)}</span>
  </div>`;
}

function updateBracketThermo(r,bi){
  const el=document.getElementById('bracket-thermo');
  if(el) el.innerHTML=buildBracketThermoHtml(r,bi);
}

function updateTaxSummary(r){
  const s=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  const sc=(id,c)=>{const e=document.getElementById(id);if(e)e.style.color=c;};
  const bi=bracketInfo(r.net,r.marginal);

  // Col1 hero
  s('tlv-refund-label',r.refund>=0?'คืนภาษี 🎉':'จ่ายเพิ่ม ⚠️');
  s('tlv-refund-amt',baht(Math.abs(r.refund)));
  sc('tlv-refund-amt',r.refund>=0?'var(--green)':'var(--red)');
  s('tlv-wht-line',`WHT ${baht(r.wht)} − ภาษี ${baht(r.taxPayable)}`);
  s('tlv-marginal',(r.marginal*100).toFixed(0)+'%');
  s('tlv-net',baht(r.net));
  // RMF/ESG mini cards
  s('tlv-rmf-val',baht(r.allowedRMF));
  s('tlv-rmf-room',`เหลือ ${baht(r.rmfRoom)}`);
  s('tlv-esg-val',baht(r.esg));
  s('tlv-esg-room',`เหลือ ${baht(r.esgRoom)}`);
  // Bracket action
  const ba=document.getElementById('tlv-bracket-action');
  if(ba){
    if(bi.atBottom){
      ba.innerHTML=`<div class="mini-card" style="color:var(--green);font-size:13px;margin-bottom:10px">✓ อยู่ขั้นต่ำสุดแล้ว</div>`;
    } else {
      ba.innerHTML=`<div class="mini-card" style="margin-bottom:10px">
        <div style="font-size:13px;line-height:1.7">อยู่ขั้น <b class="gold">${(bi.curRate*100).toFixed(0)}%</b> — ลดหย่อนเพิ่ม <b class="green tnum">${baht(bi.need)}</b> จะตกขั้น <b class="green">${(bi.lowerRate*100).toFixed(0)}%</b></div>
        <div class="muted" style="font-size:11px;margin-top:4px">ประหยัด ~${baht(bi.saving)}</div>
      </div>`;
    }
  }
  // Col3 Tax Alpha
  s('tlv-alpha-mg',(r.marginal*100).toFixed(0)+'%');
  s('tlv-alpha-1k','฿'+(r.marginal*1000).toFixed(0));
  s('tlv-alpha-esg-room',baht(r.esgRoom));
  s('tlv-alpha-esg-save',`~${baht(Math.round(r.esgRoom*r.marginal))}`);
  s('tlv-alpha-rmf-room',baht(r.rmfRoom));
  s('tlv-alpha-rmf-save',`~${baht(Math.round(r.rmfRoom*r.marginal))}`);
  // Advice
  const adv=document.getElementById('tlv-alpha-advice');
  if(adv) adv.innerHTML=`<b class="gold">แนะนำ:</b> ThaiESG ก่อน ${baht(r.esgRoom)} → ประหยัด ~${baht(Math.round(r.esgRoom*r.marginal))} แล้วค่อย RMF`;
  // Waterfall
  const dt=derivedTax();
  const inc=+dt.income||0;
  const wf=document.getElementById('tax-waterfall');
  if(wf){
    const lines=[
      ["รายได้รวม",inc],
      r.pvdExempt>0?["− PVD ยกเว้นรายได้ (ส่วนเกิน10k)",-r.pvdExempt]:null,
      ["− ค่าใช้จ่าย 50%",-r.exp],
      ["− ส่วนตัว+ครอบครัว+ปกส.",-r.fam],
      ["− ประกัน",-r.ins],
      ["− กลุ่มเกษียณ",-r.ret],
      r.home>0?["− ดอกเบี้ยบ้าน",-r.home]:null,
      r.esg>0?["− ThaiESG",-r.esg]:null,
      r.easyReceipt>0?["− Easy E-Receipt",-r.easyReceipt]:null,
      r.eDonDeduct>0?["− บริจาค 2x e-Don",-r.eDonDeduct]:null,
      r.don>0?["− บริจาคทั่วไป",-r.don]:null,
    ].filter(Boolean).filter(x=>x[1]!==0);
    wf.innerHTML=lines.map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)"><span class="muted" style="font-size:11px">${l}</span><span class="tnum" style="font-size:11px;color:${v<0?'var(--green)':'var(--text)'}">${v<0?'−'+baht(-v):baht(v)}</span></div>`).join('')
      +`<div style="border-top:2px solid #C8A35B50;margin-top:4px;padding-top:8px;display:flex;justify-content:space-between"><span class="gold" style="font-size:12px">เงินได้สุทธิ</span><span class="gold tnum" style="font-weight:700">${baht(r.net)}</span></div>
       <div style="padding-top:6px;display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:600">ภาษีที่คำนวณได้</span><span class="tnum" style="font-weight:700">${baht(r.taxPayable)}</span></div>`;
  }
  updateBracketThermo(r,bi);
}

function taxSliderRow(k, label, sliderMax){
  const v=STATE.tax[k]??0;
  const step=sliderMax>=100000?1000:500;
  return `<div style="border-top:1px solid var(--line);padding:11px 0 6px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:14px">${label}</div>
      <input id="tax-input-${k}" class="num" type="text" inputmode="numeric" value="${v}"
        oninput="setTaxLive('${k}',this.value)" style="width:110px">
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <span class="muted" style="font-size:9px;flex-shrink:0">0</span>
      <input id="tax-slider-${k}" type="range" min="0" max="${sliderMax}" step="${step}" value="${Math.min(+v,sliderMax)}"
        oninput="setTaxLive('${k}',this.value)">
      <span class="muted" style="font-size:9px;flex-shrink:0;min-width:28px;text-align:right">${(sliderMax/1000).toFixed(0)}k</span>
    </div>
  </div>`;
}

function tabTax(m){
  const dt=derivedTax(), r=calcTax(dt);
  const ao=STATE.accOpen;
  const bi=bracketInfo(r.net, r.marginal);
  const rmfThisYear=dt.rmf, esgThisYear=dt.thaiesg;
  const inc=+dt.income||0;

  // ══ COL 1: Recommendations ══
  // summary hero cards
  let col1=`<div class="card">
    <div class="ctitle">ผลสรุปภาษี</div>
    <div class="mini-card" style="text-align:center;padding:20px;margin-bottom:10px">
      <div id="tlv-refund-label" class="muted" style="font-size:10px;letter-spacing:2px;margin-bottom:4px">${r.refund>=0?"คืนภาษี 🎉":"จ่ายเพิ่ม ⚠️"}</div>
      <div id="tlv-refund-amt" class="tnum" style="font-size:34px;font-weight:700;color:${r.refund>=0?'var(--green)':'var(--red)'}">${baht(Math.abs(r.refund))}</div>
      <div id="tlv-wht-line" class="muted" style="font-size:10px;margin-top:4px">WHT ${baht(r.wht)} − ภาษี ${baht(r.taxPayable)}</div>
    </div>
    <div class="g2" style="margin-bottom:10px">
      <div class="mini-card" style="text-align:center">
        <div class="muted" style="font-size:10px">Marginal Rate</div>
        <div id="tlv-marginal" class="gold" style="font-size:26px;font-weight:700">${(r.marginal*100).toFixed(0)}%</div>
      </div>
      <div class="mini-card" style="text-align:center">
        <div class="muted" style="font-size:10px">เงินได้สุทธิ</div>
        <div id="tlv-net" class="tnum" style="font-size:16px;font-weight:700;margin-top:4px">${baht(r.net)}</div>
      </div>
    </div>
  </div>`;

  // bracket action
  col1+=`<div class="card"><div class="ctitle">📋 แนะนำตอนนี้</div>`;
  col1+=`<div id="tlv-bracket-action">`;
  if(!bi.atBottom&&bi.need>0){
    col1+=`<div class="mini-card" style="margin-bottom:10px">
      <div style="font-size:13px;line-height:1.7">อยู่ขั้น <b class="gold">${(bi.curRate*100).toFixed(0)}%</b> — ลดหย่อนเพิ่ม <b class="green tnum">${baht(bi.need)}</b> จะตกขั้น <b class="green">${(bi.lowerRate*100).toFixed(0)}%</b></div>
      <div class="muted" style="font-size:11px;margin-top:4px">ประหยัด ~${baht(bi.saving)}</div>
    </div>`;
  } else if(bi.atBottom){
    col1+=`<div class="mini-card" style="color:var(--green);font-size:13px;margin-bottom:10px">✓ อยู่ขั้นต่ำสุดแล้ว</div>`;
  }
  col1+=`</div><div class="g2">
    <div class="mini-card" style="text-align:center">
      <div class="muted" style="font-size:10px">RMF ปีนี้</div>
      <div id="tlv-rmf-val" class="gold tnum" style="font-size:16px;font-weight:700;margin:4px 0">${baht(rmfThisYear)}</div>
      <div id="tlv-rmf-room" class="muted" style="font-size:9px">เหลือ ${baht(r.rmfRoom)}</div>
    </div>
    <div class="mini-card" style="text-align:center">
      <div class="muted" style="font-size:10px">ThaiESG ปีนี้</div>
      <div id="tlv-esg-val" class="gold tnum" style="font-size:16px;font-weight:700;margin:4px 0">${baht(esgThisYear)}</div>
      <div id="tlv-esg-room" class="muted" style="font-size:9px">เหลือ ${baht(r.esgRoom)}</div>
    </div>
  </div></div>`;

  // calc summary waterfall
  const lines=[
    ["รายได้รวม",inc],
    r.pvdExempt>0?["− PVD ยกเว้นรายได้ (ส่วนเกิน10k)",-r.pvdExempt]:null,
    ["− ค่าใช้จ่าย 50%",-r.exp],
    ["− ส่วนตัว+ครอบครัว+ปกส.",-r.fam],
    ["− ประกัน",-r.ins],
    ["− กลุ่มเกษียณ",-r.ret],
    r.home>0?["− ดอกเบี้ยบ้าน",-r.home]:null,
    r.esg>0?["− ThaiESG",-r.esg]:null,
    r.easyReceipt>0?["− Easy E-Receipt",-r.easyReceipt]:null,
    r.eDonDeduct>0?["− บริจาค 2x e-Don",-r.eDonDeduct]:null,
    r.don>0?["− บริจาคทั่วไป",-r.don]:null,
  ].filter(Boolean).filter(x=>x[1]!==0);
  col1+=`<div class="card"><div class="ctitle">สรุปการคำนวณ</div><div id="tax-waterfall">`;
  lines.forEach(([l,v])=>col1+=`<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--line)"><span class="muted" style="font-size:11px">${l}</span><span class="tnum" style="font-size:11px;color:${v<0?'var(--green)':'var(--text)'}">${v<0?'−'+baht(-v):baht(v)}</span></div>`);
  col1+=`<div style="border-top:2px solid #C8A35B50;margin-top:4px;padding-top:8px;display:flex;justify-content:space-between"><span class="gold" style="font-size:12px">เงินได้สุทธิ</span><span class="gold tnum" style="font-weight:700">${baht(r.net)}</span></div>
    <div style="padding-top:6px;display:flex;justify-content:space-between"><span style="font-size:12px;font-weight:600">ภาษีที่คำนวณได้</span><span class="tnum" style="font-weight:700">${baht(r.taxPayable)}</span></div>
  </div></div>`;

  // ══ COL 2: Form ══
  const rmfMax=Math.floor(Math.min(inc*.30,500000)/1000)*1000;
  const esgMax=Math.floor(Math.min(inc*.30,300000)/1000)*1000;

  // auto-open กองทุน accordion ครั้งแรกที่โหลด tab ภาษี
  if(ao.funds===undefined) ao.funds=true;

  let col2=`<div class="card"><div class="ctitle">กรอก / แก้ข้อมูล</div>`;
  col2+=taxRow("income","รายได้รวมทั้งปี")+taxRow("wht","WHT ถูกหัก");
  col2+=accHead("family","1. ครอบครัว & อื่นๆ","");
  if(ao.family)col2+=taxBool("spouse","คู่สมรสไม่มีรายได้")+taxRow("parents","บิดามารดา (คน)")+taxRow("children","บุตรคนแรก (คน)")+taxRow("children2nd","บุตรคนที่ 2+ (คน)")+taxRow("parentsHealth","ประกันสุขภาพพ่อแม่")+taxRow("ss","ประกันสังคม")+taxRow("maternity","คลอดบุตร (≤60k)")+taxRow("disabledCare","ดูแลผู้พิการ (คน × 60k)")+taxRow("homeLoan","ดอกเบี้ยบ้าน");
  col2+=accHead("insurance","2. ประกัน",r.ins>0?baht(r.ins):"");
  if(ao.insurance)col2+=`<div class="alert" style="border-left-color:var(--line);margin:8px 0"><span class="muted" style="font-size:11px">สุขภาพ ≤25k · รวมชีวิต ≤100k · บำนาญเติมช่องว่างได้</span></div>`+taxRow("lifeInsurance","ประกันชีวิต")+taxRow("healthInsurance","ประกันสุขภาพตัวเอง");
  col2+=accHead("funds","3. กองทุนเพื่อการออม",`${baht(r.retSum)} / 500k`);
  if(ao.funds){
    col2+=`<div class="alert" style="border-left-color:var(--line);margin:8px 0"><span class="muted" style="font-size:11px">RMF+PVD(ส่วน10k)+SSF+บำนาญ รวม ≤500k · PVD ส่วนเกิน10k ยกเว้นรายได้</span></div>`;
    col2+=taxSliderRow("rmfBought","RMF ปีนี้",rmfMax)+taxRow("pvd","PVD (เงินสะสมปีนี้)");
    col2+=`<div class="arow"><div style="flex:1"><div style="font-size:14px;color:var(--mute)">SSF <span style="font-size:9px;background:rgba(138,153,181,.15);color:var(--mute);border-radius:4px;padding:1px 7px">🔒 สิ้นสิทธิ์</span></div><div class="muted" style="font-size:10px">ซื้อเพิ่มไม่ได้แล้ว</div></div><span class="muted tnum">${baht(STATE.tax.ssf||0)}</span></div>`;
    col2+=taxRow("pension","ประกันบำนาญ");
    col2+=`<div style="border-top:1px solid var(--line);margin:8px 0"></div>`;
    col2+=taxSliderRow("esgBought","ThaiESG ปีนี้",esgMax);
    col2+=`<div style="background:var(--ink3);border-radius:12px;padding:14px;margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-size:11px;color:var(--gold2);font-weight:600;letter-spacing:1px">🌡️ ขั้นภาษีปัจจุบัน</span>
        <span class="muted" style="font-size:10px">real-time</span>
      </div>
      <div id="bracket-thermo">${buildBracketThermoHtml(r,bi)}</div>
    </div>`;
  }
  col2+=accHead("donations","4. บริจาค & ช้อปดีมีคืน","");
  if(ao.donations){
    col2+=`<div class="alert" style="border-left-color:var(--line);margin:8px 0"><span class="muted" style="font-size:11px">Easy E-Receipt ≤50k · 2x e-Donation ≤10%สุทธิ · บริจาค 1x ≤10% (หลัง eDon)</span></div>`;
    col2+=taxRow("easyReceipt","Easy E-Receipt (ช้อปดีมีคืน ≤50k)")+taxRow("eDonation","บริจาค 2x e-Donation (ยอดจ่ายจริง)")+taxRow("donation","บริจาคทั่วไป 1x");
  }
  col2+=`<div style="margin-top:14px;display:flex;gap:8px"><button class="btn" onclick="recomputeTax()" style="flex:1">คำนวณใหม่</button><button class="btn" onclick="saveTax()" style="flex:1">บันทึก</button></div></div>`;

  // ══ COL 3: Tax Alpha ══
  let col3=`<div class="card"><div class="ctitle">Tax Alpha & Liquidity</div>
    <div class="g2" style="margin-bottom:14px">
      <div class="mini-card" style="text-align:center">
        <div class="muted" style="font-size:10px;letter-spacing:1px;margin-bottom:4px">Marginal Rate</div>
        <div id="tlv-alpha-mg" class="gold" style="font-size:28px;font-weight:700">${(r.marginal*100).toFixed(0)}%</div>
      </div>
      <div class="mini-card" style="text-align:center">
        <div class="muted" style="font-size:10px;letter-spacing:1px;margin-bottom:4px">ลดหย่อน ฿1,000</div>
        <div id="tlv-alpha-1k" class="green" style="font-size:28px;font-weight:700">฿${(r.marginal*1000).toFixed(0)}</div>
      </div>
    </div>
    <div style="padding:12px 0;border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <div><span style="color:#4DD0C7;font-weight:700;font-size:15px">ThaiESG</span><span class="muted" style="font-size:10px;margin-left:8px">ล็อค 5 ปี</span></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span class="muted" style="font-size:11px">ซื้อได้อีก</span><span id="tlv-alpha-esg-room" class="tnum" style="font-size:13px">${baht(r.esgRoom)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:2px">
        <span class="muted" style="font-size:11px">ประหยัดภาษี</span><span id="tlv-alpha-esg-save" class="green tnum" style="font-weight:700;font-size:13px">~${baht(Math.round(r.esgRoom*r.marginal))}</span>
      </div>
    </div>
    <div style="padding:12px 0;border-top:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
        <div><span style="color:#5B8DEF;font-weight:700;font-size:15px">RMF</span><span class="muted" style="font-size:10px;margin-left:8px">ล็อคถึงอายุ 55 ปี</span></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px">
        <span class="muted" style="font-size:11px">ซื้อได้อีก</span><span id="tlv-alpha-rmf-room" class="tnum" style="font-size:13px">${baht(r.rmfRoom)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:2px">
        <span class="muted" style="font-size:11px">ประหยัดภาษี</span><span id="tlv-alpha-rmf-save" class="green tnum" style="font-weight:700;font-size:13px">~${baht(Math.round(r.rmfRoom*r.marginal))}</span>
      </div>
    </div>
    <div class="alert" style="margin-top:12px"><span class="gold" style="font-weight:700;margin-right:6px">›</span><span id="tlv-alpha-advice" style="font-size:12px;line-height:1.6"><b class="gold">แนะนำ:</b> ThaiESG ก่อน ${baht(r.esgRoom)} → ประหยัด ~${baht(Math.round(r.esgRoom*r.marginal))} แล้วค่อย RMF</span></div>
  </div>`;

  // ── DCA Projection (dynamic) ──
  const rmfMonthly=STATE.assets.filter(a=>/rmf/i.test(a.name)||/rmf/i.test(a.bucket)).reduce((s,a)=>s+(+a.plan||0),0);
  const esgMonthly=STATE.assets.filter(a=>/esg/i.test(a.name)||a.bucket==="ThaiESG").reduce((s,a)=>s+(+a.plan||0),0);
  const mLeft=remainingMonths();
  const hasDca=rmfMonthly>0||esgMonthly>0;
  if(hasDca){
    const rmfProj=rmfThisYear+rmfMonthly*mLeft;
    const esgProj=esgThisYear+esgMonthly*mLeft;
    const rProj=calcTax({...dt, rmf:rmfProj, thaiesg:esgProj});
    const refundDelta=rProj.refund-r.refund;
    col3+=`<div class="card"><div class="ctitle">DCA Projection ปีนี้</div>
      <div class="muted" style="font-size:10px;margin-bottom:10px">เหลืออีก ${mLeft} งวด · ตัวเลขนี้คือ <b>คาดการณ์</b> ไม่ใช่ฐานภาษีข้างบน (ข้างบนใช้ยอด YTD จริง)</div>`;
    if(rmfMonthly>0) col3+=deductBlock("RMF","#5B8DEF",rmfThisYear,rmfMonthly);
    if(esgMonthly>0) col3+=deductBlock("ThaiESG","#4DD0C7",esgThisYear,esgMonthly);
    const biProj=bracketInfo(rProj.net, rProj.marginal);
    const bracketChanged=rProj.marginal!==r.marginal;
    col3+=`<div style="border-top:2px solid var(--line);margin-top:10px;padding-top:12px">
      <div class="muted" style="font-size:10px;letter-spacing:1px;margin-bottom:8px">คาดการณ์ภาษีสิ้นปี (ถ้า DCA ครบ)</div>

      ${rmfMonthly>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--line)">
        <span class="muted" style="font-size:11px">RMF (YTD + DCA)</span>
        <span class="tnum" style="font-size:11px;color:#5B8DEF">${baht(rmfThisYear)} + ${baht(rmfMonthly*mLeft)} = <b>${baht(rmfProj)}</b></span>
      </div>`:''}
      ${esgMonthly>0?`<div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--line)">
        <span class="muted" style="font-size:11px">ThaiESG (YTD + DCA)</span>
        <span class="tnum" style="font-size:11px;color:#4DD0C7">${baht(esgThisYear)} + ${baht(esgMonthly*mLeft)} = <b>${baht(esgProj)}</b></span>
      </div>`:''}
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--line)">
        <span class="muted" style="font-size:11px">ลดหย่อนกลุ่มเกษียณ (คาด)</span>
        <span class="tnum" style="font-size:11px">${baht(rProj.retSum)} / 500k</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--line)">
        <span class="muted" style="font-size:11px">เงินได้สุทธิ (คาด)</span>
        <span class="tnum" style="font-size:11px">${baht(rProj.net)}</span>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--line);margin-top:2px">
        <span class="muted" style="font-size:11px">ขั้นภาษี (คาด)</span>
        <div style="display:flex;align-items:center;gap:8px">
          ${bracketChanged?`<span style="font-size:11px;color:var(--mute);text-decoration:line-through">${(r.marginal*100).toFixed(0)}%</span>
          <span style="font-size:11px;color:var(--green)">→</span>`:''}
          <span style="font-size:20px;font-weight:700;color:${bracketChanged?'var(--green)':'var(--gold)'}">${(rProj.marginal*100).toFixed(0)}%</span>
        </div>
      </div>
      ${bracketChanged?`<div style="font-size:11px;padding:4px 8px;border-radius:6px;background:rgba(95,185,142,.12);color:var(--green);margin-bottom:6px">
        ✓ ตกขั้นจาก ${(r.marginal*100).toFixed(0)}% → ${(rProj.marginal*100).toFixed(0)}% ถ้า DCA ครบ
      </div>`:`<div style="font-size:11px;color:var(--mute);margin-bottom:6px">
        ยังอยู่ขั้น ${(rProj.marginal*100).toFixed(0)}% · ต้องลดหย่อนเพิ่ม ${baht(biProj.need)} จึงจะตกขั้น
      </div>`}

      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid var(--line)">
        <div>
          <div style="font-size:13px;font-weight:600">${rProj.refund>=0?"คืนภาษี 🎉":"จ่ายเพิ่ม ⚠️"}</div>
          <div class="muted" style="font-size:10px">WHT ${baht(rProj.wht)} − ภาษี ${baht(rProj.taxPayable)}</div>
        </div>
        <span class="tnum" style="font-size:24px;font-weight:700;color:${rProj.refund>=0?'var(--green)':'var(--red)'}">${baht(Math.abs(rProj.refund))}</span>
      </div>
      ${refundDelta!==0?`<div style="font-size:11px;padding:4px 8px;border-radius:6px;background:${refundDelta>0?'rgba(95,185,142,.12)':'rgba(216,116,95,.12)'};color:${refundDelta>0?'var(--green)':'var(--red)'}">
        ${refundDelta>0?'▲':'▼'} ${baht(Math.abs(refundDelta))} จากยอดปัจจุบัน (${baht(Math.abs(r.refund))})
      </div>`:''}
    </div></div>`;
  }

  // PVD breakdown info (only show if pvdExempt active)
  if(r.pvdExempt>0){
    col3+=`<div class="card"><div class="ctitle">PVD 2569</div>
      <div style="padding:7px 0;display:flex;justify-content:space-between;border-top:1px solid var(--line)"><span class="muted" style="font-size:12px">PVD รวม</span><span class="tnum">${baht(dt.pvd)}</span></div>
      <div style="padding:7px 0;display:flex;justify-content:space-between;border-top:1px solid var(--line)"><span class="muted" style="font-size:12px">ส่วนที่ 1 (≤10k → กลุ่มเกษียณ)</span><span class="tnum green">${baht(r.pvdBase)}</span></div>
      <div style="padding:7px 0;display:flex;justify-content:space-between;border-top:1px solid var(--line)"><span class="muted" style="font-size:12px">ส่วนที่ 2 (เกิน 10k → ยกเว้นรายได้)</span><span class="tnum green">${baht(r.pvdExempt)}</span></div>
    </div>`;
  }

  m.innerHTML=`<div class="dash-tax">
    <div class="tax-col">${col1}</div>
    <div class="tax-col">${col2}</div>
    <div class="tax-col">${col3}</div>
  </div>`;
}

function deductBlock(label,color,boughtVal,monthly){
  const future=remainingMonths();
  const futureAmt=monthly*future;
  const totalD=boughtVal+futureAmt;
  return `<div style="background:var(--ink3);border-radius:10px;padding:12px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="color:${color};font-weight:700;font-size:13px">${label}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--line)">
      <span class="muted" style="font-size:11px">ซื้อแล้ว YTD</span>
      <span class="tnum" style="font-size:11px">${baht(boughtVal)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:1px solid var(--line)">
      <span class="muted" style="font-size:11px">+ DCA ที่เหลือ (${future} × ${baht(monthly)})</span>
      <span class="tnum" style="font-size:11px">${baht(futureAmt)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;padding:6px 0 0;border-top:1px solid var(--line);margin-top:2px">
      <span style="font-size:11px;font-weight:600">คาดการณ์รวม</span>
      <span class="tnum" style="font-size:13px;font-weight:700;color:${color}">${baht(totalD)}</span>
    </div>
  </div>`;
}
function taxRow(k,label,ro){const v=STATE.tax[k]??0;return `<div class="arow"><div style="flex:1"><div style="font-size:14px">${label}</div></div>${ro?`<span class="gold tnum" style="font-weight:600">${baht(v)}</span>`:`<input class="num" type="text" inputmode="numeric" value="${v}" oninput="setTax('${k}',this.value)">`}</div>`;}
function taxBool(k,label){const on=+STATE.tax[k]?1:0;return `<div class="arow"><div style="font-size:14px">${label}</div><button onclick="toggleTaxBool('${k}')" style="background:${on?'var(--gold)':'var(--line)'};color:${on?'var(--ink)':'var(--mute)'};border:none;border-radius:20px;padding:6px 18px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">${on?'มี ✓':'ไม่มี'}</button></div>`;}
function accHead(k,label,badge){return `<button class="acc" onclick="toggleAcc('${k}')"><span style="font-size:14px;font-weight:600">${label}</span><span style="display:flex;align-items:center;gap:10px">${badge?`<span class="muted" style="font-size:12px">${badge}</span>`:""}<span class="gold" style="font-size:12px">${STATE.accOpen[k]?"▲":"▼"}</span></span></button>`;}
