# แพตช์ Wealth Ledger — แยก "มูลค่าพอร์ตรวม" ออกจาก "ลดหย่อนภาษีปีนี้"

> วางทั้งไฟล์นี้ให้ Claude Code ในโฟลเดอร์ `F:\Cowork\wealth` แล้วสั่งว่า
> **"แก้ index.html ตามแพตช์นี้ทุกข้อ"**
> ทุกบล็อกระบุ "หา" (anchor ในไฟล์จริง) → "แทนด้วย" — จับด้วยชื่อฟังก์ชัน/ข้อความได้ ถ้า whitespace ในไฟล์ต่างเล็กน้อยให้ยึดตามไฟล์จริง

---

## หลักการ (กฎหลักที่ห้ามผิด)

- **`assets[].value`** = มูลค่าตลาดสะสมทุกปี (ปีก่อน + ปีนี้ + กำไร/ขาดทุน) → ใช้เฉพาะ **ภาพรวม / Net Worth** เท่านั้น
- **ภาษีห้ามใช้ `assets[].value` เด็ดขาด** → ลดหย่อนปีนี้ = `tax.rmfBought` + (`plan รายเดือน` × `remainingMonths`)
- RMF/ThaiESG **ปีก่อนๆ ลดหย่อนไปแล้วในปีนั้น** → ปีนี้ไม่นับ → ไม่มี field `prior` อีกต่อไป

---

## EDIT 1 — SEED ของ Fern (เปลี่ยน key + ตัวเลขจริงจาก iFUND)

**หา** (ใน `SEED.fern.tax`):
```js
rmfHistorical:90285,esgHistorical:25000},
```
**แทนด้วย:**
```js
rmfBought:87285,esgBought:30000},
```
> 87,285 = RMF ที่ซื้อจริง ม.ค.–มิ.ย. 2026 (รวมก้อนพิเศษ มิ.ย. INNOTECH 17,500) · 30,000 = ThaiESG (5,000×6)

## EDIT 2 — SEED ของ Nut

**หา** (ใน `SEED.nut.tax`):
```js
rmfHistorical:6000,esgHistorical:0},
```
**แทนด้วย:**
```js
rmfBought:6000,esgBought:0},
```

---

## EDIT 3 — `completedMonths` → `remainingMonths`

**หา** ฟังก์ชันทั้งก้อน:
```js
// ── completed DCA months (เริ่ม ก.ค. 2026, ตัดวันที่ 5) ──
function completedMonths(start="2026-07"){
const [sy,sm]=start.split("-").map(Number);
const d=new Date(), ny=d.getFullYear(), nm=d.getMonth()+1, nd=d.getDate();
let n=(ny-sy)*12+(nm-sm); if(nd>=5)n+=1; return Math.max(0,n);
}
```
**แทนด้วย:**
```js
// ── remaining DCA months ในปีนี้ (งวดถัดไป → ธ.ค. 2026, ตัดวันที่ 5) ──
function remainingMonths(dcaDay=5){
const d=new Date(), mo=d.getMonth()+1, day=d.getDate();
let next = day < dcaDay ? mo : mo+1;   // ยังไม่ถึงวันตัด = งวดเดือนนี้ยังนับ
if(next>12) return 0;
return 12 - next + 1;                   // นับงวด next..ธ.ค.
}
```
> 21 มิ.ย. (วันตัดผ่านแล้ว) → next=ก.ค. → คืน **6** งวด (ก.ค.–ธ.ค.) · ไม่นับ มิ.ย. ซ้ำกับ bought

---

## EDIT 4 — `derivedTax` (2-bucket: bought + future)

**หา** ฟังก์ชันทั้งก้อน:
```js
function derivedTax(){
const t=STATE.tax, done=completedMonths();
const rmfMonthly=STATE.assets.filter(a=>a.bucket==="RMF"&&(+a.plan>0)).reduce((s,a)=>s+(+a.plan||0),0);
const esgAsset=STATE.assets.find(a=>/esg/i.test(a.id)||/ThaiESG/i.test(a.name));
const esgMonthly=esgAsset?(+esgAsset.plan||0):0;
return {...t, rmf:(+t.rmfHistorical||0)+rmfMonthly*done, thaiesg:(+t.esgHistorical||0)+esgMonthly*done,
_done:done, _rmfMonthly:rmfMonthly, _esgMonthly:esgMonthly};
}
```
**แทนด้วย:**
```js
function derivedTax(){
const t=STATE.tax, future=remainingMonths();
const rmfMonthly=STATE.assets.filter(a=>a.bucket==="RMF"&&(+a.plan>0)).reduce((s,a)=>s+(+a.plan||0),0);
const esgAsset=STATE.assets.find(a=>/esg/i.test(a.id)||/ThaiESG/i.test(a.name));
const esgMonthly=esgAsset?(+esgAsset.plan||0):0;
const rmfBought=(+t.rmfBought||0), esgBought=(+t.esgBought||0);
return {...t,
rmf:rmfBought+rmfMonthly*future,        // ลดหย่อนปีนี้ = ซื้อแล้ว + ครึ่งหลัง
thaiesg:esgBought+esgMonthly*future,
_future:future, _rmfMonthly:rmfMonthly, _esgMonthly:esgMonthly,
_rmfBought:rmfBought, _esgBought:esgBought};
}
```

---

## EDIT 5 — `coerceTax` (migration เก่า→ใหม่ ปลอดภัย ไม่เสียข้อมูล)

**หา** ฟังก์ชันทั้งก้อน:
```js
function coerceTax(o){const out={...o};["income","wht","ss","pvd","parents","children","children2nd",
"parentsHealth","lifeInsurance","healthInsurance","pension","ssf","homeLoan","donation",
"rmfHistorical","esgHistorical"].forEach(k=>out[k]=+out[k]||0); out.spouse=+out.spouse?1:0; return out;}
```
**แทนด้วย:**
```js
function coerceTax(o){
const out={...o};
// migration: เลขเก่า rmfHistorical/esgHistorical = "ซื้อปีนี้ครึ่งแรก" → ย้ายเข้า bought
if(out.rmfBought===undefined && out.rmfHistorical!==undefined) out.rmfBought=out.rmfHistorical;
if(out.esgBought===undefined && out.esgHistorical!==undefined) out.esgBought=out.esgHistorical;
["income","wht","ss","pvd","parents","children","children2nd",
"parentsHealth","lifeInsurance","healthInsurance","pension","ssf","homeLoan","donation",
"rmfBought","esgBought"].forEach(k=>out[k]=+out[k]||0);
out.spouse=+out.spouse?1:0; return out;}
```
> ถ้าใน Google Sheet ยังมี `rmfHistorical` เก่า → ย้ายเข้า `rmfBought` อัตโนมัติตอนโหลด ไม่หาย

---

## EDIT 6 — เพิ่มฟังก์ชันใหม่ `deductBlock` (การ์ดแสดง 2 โลกให้ชัด)

**หา** บรรทัด `function taxRow(k,label,ro){` (วางฟังก์ชันใหม่ **ก่อน** บรรทัดนี้)
**แทรกก่อนหน้า:**
```js
// การ์ดลดหย่อน: แยก "มูลค่าพอร์ตรวม" (read-only) ออกจาก "ลดหย่อนปีนี้" (bought+future)
function deductBlock(label,color,portVal,boughtKey,boughtVal,future,monthly){
const futureAmt=monthly*future, totalD=boughtVal+futureAmt;
return `<div style="background:#0B1322;border-radius:10px;padding:14px;margin:10px 0">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
<span style="color:${color};font-weight:700;font-size:15px">${label}</span>
<span style="font-size:10px;background:rgba(77,208,199,.12);color:var(--tech);border-radius:4px;padding:2px 8px">ปีภาษี 2569</span></div>
<div style="display:flex;justify-content:space-between;padding:6px 0">
<span class="muted" style="font-size:12px">มูลค่าพอร์ตรวม</span>
<span class="tnum muted" style="font-size:13px">${baht(portVal)}</span></div>
<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0">
<span style="font-size:12px">ซื้อแล้วปีนี้ (YTD)</span>
<input class="num" type="text" inputmode="numeric" value="${boughtVal}" oninput="setTax('${boughtKey}',this.value)" style="width:110px;padding:5px 8px;font-size:13px"></div>
<div style="display:flex;justify-content:space-between;padding:6px 0">
<span class="muted" style="font-size:12px">แผน DCA ที่เหลือ</span>
<span class="tnum muted" style="font-size:13px">${future} เดือน × ${baht(monthly)} = ${baht(futureAmt)}</span></div>
<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);margin-top:6px;padding-top:10px">
<span style="font-size:13px;font-weight:600">รวมลดหย่อนปีนี้</span>
<span class="gold tnum" style="font-size:18px;font-weight:700">${baht(totalD)}</span></div></div>`;
}
```

---

## EDIT 7 — `tabTax`: การ์ดสรุป "ซื้อปีนี้" ใช้ยอดรวม (bought+future)

**หา:**
```js
const rmfThisYear=dt._rmfMonthly*dt._done, esgThisYear=dt._esgMonthly*dt._done;
```
**แทนด้วย:**
```js
const rmfThisYear=dt.rmf, esgThisYear=dt.thaiesg;
```

---

## EDIT 8 — `tabTax`: badge หัวข้อ accordion ใช้ retSum จริง

**หา:**
```js
h+=accHead("funds","3. กองทุนเพื่อการออม",`${baht(dt.retSum||((+dt.rmf||0)+(+dt.pvd||0)))} / 500k`);
```
**แทนด้วย:**
```js
h+=accHead("funds","3. กองทุนเพื่อการออม",`${baht(r.retSum)} / 500k`);
```

---

## EDIT 9 — `tabTax`: แทนแถว RMF AUTO ด้วย `deductBlock`

**หา** (คอมเมนต์ + แถว RMF AUTO ทั้งก้อน):
```js
// RMF — AUTO (ประวัติ + ปีนี้จาก DCA)
h+=`<div class="arow" style="align-items:flex-start"><div style="flex:1"><div style="font-size:14px">RMF <span style="font-size:9px;background:rgba(77,208,199,.15);color:var(--tech);border-radius:4px;padding:1px 7px">AUTO</span></div><div class="muted" style="font-size:10px;margin-top:2px">ปีก่อนๆ ${baht(dt.rmfHistorical)} + ปีนี้ ${dt._done} ด.×${baht(dt._rmfMonthly)} = ${baht(dt._rmfMonthly*dt._done)}</div></div>
<div style="text-align:right"><div class="gold tnum" style="font-weight:700">${baht(dt.rmf)}</div><div style="display:flex;align-items:center;gap:4px;margin-top:4px"><span class="muted" style="font-size:10px">ปีก่อนๆ:</span><input class="num" type="text" inputmode="numeric" value="${dt.rmfHistorical}" oninput="setTax('rmfHistorical',this.value)" style="width:84px;padding:3px 6px;font-size:12px"></div></div></div>`;
```
**แทนด้วย:**
```js
// RMF — แยกพอร์ตรวม / ซื้อปีนี้ / DCA เหลือ
h+=deductBlock("RMF","#5B8DEF",byBucket()["RMF"]||0,"rmfBought",dt._rmfBought,dt._future,dt._rmfMonthly);
```

---

## EDIT 10 — `tabTax`: แทนแถว ThaiESG AUTO ด้วย `deductBlock`

**หา** (คอมเมนต์ + แถว ThaiESG AUTO ทั้งก้อน):
```js
// ThaiESG — AUTO
h+=`<div class="arow" style="align-items:flex-start"><div style="flex:1"><div style="font-size:14px">ThaiESG <span style="font-size:9px;background:rgba(77,208,199,.15);color:var(--tech);border-radius:4px;padding:1px 7px">AUTO</span></div><div class="muted" style="font-size:10px;margin-top:2px">ปีก่อนๆ ${baht(dt.esgHistorical)} + ปีนี้ ${dt._done} ด.×${baht(dt._esgMonthly)} = ${baht(dt._esgMonthly*dt._done)}</div></div>
<div style="text-align:right"><div class="gold tnum" style="font-weight:700">${baht(dt.thaiesg)}</div><div style="display:flex;align-items:center;gap:4px;margin-top:4px"><span class="muted" style="font-size:10px">ปีก่อนๆ:</span><input class="num" type="text" inputmode="numeric" value="${dt.esgHistorical}" oninput="setTax('esgHistorical',this.value)" style="width:84px;padding:3px 6px;font-size:12px"></div></div></div>`;
```
**แทนด้วย:**
```js
// ThaiESG — แยกพอร์ตรวม / ซื้อปีนี้ / DCA เหลือ
h+=deductBlock("ThaiESG","#4DD0C7",byBucket()["ThaiESG"]||0,"esgBought",dt._esgBought,dt._future,dt._esgMonthly);
```

---

## EDIT 11 — `tabTax`: เพิ่มกำกับ "พอร์ตรวม vs ลดหย่อนปีนี้"

**หา** บรรทัดเปิด accordion (ก่อน RMF deductBlock):
```js
h+=`<div class="alert" style="border-left-color:var(--line);margin:8px 0"><span class="muted" style="font-size:11px">กลุ่มเกษียณ (RMF+PVD+SSF+บำนาญ) รวม ≤500k</span></div>`;
```
**แทนด้วย:**
```js
h+=`<div class="alert" style="border-left-color:var(--line);margin:8px 0"><span class="muted" style="font-size:11px">💡 ตัวเลขลดหย่อน = เฉพาะที่ซื้อใหม่ปี 2569 (bought + DCA เหลือ) · ของสะสมปีก่อนลดหย่อนไปแล้ว ดูมูลค่ารวมที่แท็บพอร์ต · กลุ่มเกษียณ RMF+PVD+SSF+บำนาญ รวม ≤500k</span></div>`;
```

---

## ⚙️ EDIT 12 — Backend (Google Sheet) — ทำครั้งเดียว

เปิด Google Sheet `WealthLedgerDB` แท็บ `tax` แล้ว **เปลี่ยนชื่อหัวคอลัมน์ 2 ช่อง** (แค่หัว ไม่ต้องแตะค่า):
- `rmfHistorical` → **`rmfBought`**
- `esgHistorical` → **`esgBought`**

> Apps Script อ่านหัวคอลัมน์แบบ dynamic (sheetToObjects) → เปลี่ยนหัวพอ ไม่ต้องแก้โค้ด .gs · ถ้าไม่เปลี่ยน ค่าที่บันทึกใหม่จะไม่ persist

---

## ✅ ผลลัพธ์ที่ verify แล้ว (Fern, รัน node จริง)

| รายการ | ค่า |
|---|--:|
| remainingMonths() (21 มิ.ย.) | 6 |
| plan RMF รวม/เดือน | 30,000 |
| RMF ปีนี้ (87,285 + 30,000×6) | 267,285 |
| ThaiESG ปีนี้ (30,000 + 5,000×6) | 60,000 |
| เงินได้สุทธิ | 1,112,820 |
| ภาษีที่ต้องจ่าย | 143,205 |
| **ได้คืน (WHT 225,026 −)** | **81,821** |
| RMF port value (แสดงเฉยๆ) | 204,925 |
| ThaiESG port value | 24,668 |

**ตอบ 4 ข้อ verify:**
1. **Time/Math** — `remainingMonths` คืน 6 ถูก · `derivedTax` = bought + monthly×future ตามสูตร ✓
2. **Migration** — `coerceTax` ย้าย old→new เฉพาะตอน new ยังไม่มี (ไม่ทับ ไม่หาย) ✓
3. **UI** — `deductBlock` โชว์ 4 บรรทัด: พอร์ตรวม / ซื้อปีนี้ (กรอกได้) / DCA เหลือ / รวมลดหย่อน ✓
4. **Edge/Bracket** — `getMonth()+1` ไม่มี off-by-one · `calcTax` ไม่แตะ logic ขั้น แค่รับ `rmf/thaiesg` ที่ถูก → ไม่มีบั๊กใหม่ ✓

**ปลอดภัยสำหรับ commit + push ขึ้น GitHub** หลังทำ EDIT 1–12 ครบ
