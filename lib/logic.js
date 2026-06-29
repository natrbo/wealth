// ╔══════════════════════════════════════════════════════════════╗
// ║  lib/logic.js — Pure logic (single source of truth)            ║
// ║  ภาษีไทย 2569 + helpers. ไม่พึ่ง DOM / STATE / network         ║
// ║  ใช้ได้ทั้งใน browser (เป็น global) และ Node/CommonJS (require)  ║
// ╚══════════════════════════════════════════════════════════════╝
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;            // Node / test runner
  } else {
    Object.assign(root, api);        // browser: แนบเป็น global ให้ index.html เรียกได้
    root.WealthLogic = api;          // และผูกไว้ใต้ namespace เดียวด้วย (สำหรับเทสต์)
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ── parse เลขจาก string ที่อาจมี comma / สัญลักษณ์ ──
  const num = v => { const c = String(v).replace(/[^0-9.]/g, ""); return c === "" ? 0 : parseFloat(c) || 0; };

  // ── format เป็นเงินบาท (ปัดเป็นจำนวนเต็ม) ──
  const baht = n => "฿" + Math.round(+n || 0).toLocaleString("th-TH");

  // ── จำนวนงวด DCA ที่เหลือในปีนี้ (งวดถัดไป → ธ.ค.) ตัดวันที่ dcaDay ──
  // now ฉีดเข้ามาได้เพื่อให้เทสต์กำหนดวันที่ได้ (default = ตอนนี้)
  function remainingMonths(dcaDay = 5, now = new Date()) {
    const d = now, mo = d.getMonth() + 1, day = d.getDate();
    let next = day < dcaDay ? mo : mo + 1;   // ถ้ายังไม่ถึงวันตัด งวดเดือนนี้ยังนับ
    if (next > 12) return 0;
    return 12 - next + 1;                     // งวด next..ธ.ค.
  }

  // ── ขั้นภาษี: ต้องลดหย่อนเพิ่มเท่าไรเพื่อตกขั้น + ประหยัดเท่าไร ──
  function bracketInfo(net, marginal) {
    const EDGES = [150000, 300000, 500000, 750000, 1000000, 2000000, 5000000];
    const RATES = [0, .05, .10, .15, .20, .25, .30, .35];
    let lower = 0;
    for (const e of EDGES) { if (net > e) lower = e; else break; }
    const need = net - lower;                 // ลดหย่อนเท่านี้ → ตกไปขั้นล่าง
    const idx = EDGES.indexOf(lower);
    const lowerRate = idx >= 0 ? RATES[idx] : 0;
    const saving = Math.round(need * marginal);
    return { need: Math.max(need, 0), curRate: marginal, lowerRate, saving, atBottom: net <= 150000 };
  }

  // ── Tax Engine 2569 ──
  function calcTax(s) {
    const inc = +s.income || 0;

    // PVD splitting: ≤10,000 เข้ากลุ่มเกษียณ; ส่วนเกิน (≤15%, ≤490k) ยกเว้นรายได้
    const pvdRaw = +s.pvd || 0;
    const pvdBase = Math.min(pvdRaw, 10000);
    const pvdExempt = Math.min(Math.max(pvdRaw - 10000, 0), inc * 0.15, 490000);

    const effInc = Math.max(inc - pvdExempt, 0);
    const exp = Math.min(effInc * 0.5, 100000);

    // ครอบครัว + allowances
    const fam = 60000 + (s.spouse ? 60000 : 0) + Math.min(+s.parents || 0, 4) * 30000
      + (+s.children || 0) * 30000 + (+s.children2nd || 0) * 60000
      + Math.min(+s.parentsHealth || 0, 15000) + (+s.ss || 0)
      + Math.min(+s.maternity || 0, 60000)
      + (+s.disabledCare || 0) * 60000;

    // ประกัน + pension spillover
    const hlth = Math.min(+s.healthInsurance || 0, 25000);
    const lifeAmt = +s.lifeInsurance || 0;
    const rawIns = lifeAmt + hlth;
    const insGap = Math.max(100000 - rawIns, 0);
    const pensionRaw = +s.pension || 0;
    const pensionForIns = Math.min(pensionRaw, insGap);
    const ins = Math.min(rawIns + pensionForIns, 100000);

    const pensionRest = Math.max(pensionRaw - pensionForIns, 0);
    const pen = Math.min(pensionRest, inc * 0.15, 200000);

    // กองทุน
    const rmf = Math.min(+s.rmf || 0, inc * 0.30, 500000);
    const ssf = Math.min(+s.ssf || 0, inc * 0.30, 200000);
    const retSum = rmf + pvdBase + ssf + pen;
    const ret = Math.min(retSum, 500000);
    const esg = Math.min(+s.thaiesg || 0, inc * 0.30, 300000);
    const home = Math.min(+s.homeLoan || 0, 100000);

    const easyReceipt = Math.min(+s.easyReceipt || 0, 50000);

    const sumD = exp + fam + ins + ret + esg + home + easyReceipt;
    const netBD = Math.max(effInc - sumD, 0);

    // 2x e-Donation ≤10% netBD
    const eDonAmt = +s.eDonation || 0;
    const eDonDeduct = Math.min(eDonAmt * 2, netBD * 0.10);
    const netAfterEDon = Math.max(netBD - eDonDeduct, 0);

    // 1x บริจาคทั่วไป ≤10% netAfterEDon
    const don = Math.min(+s.donation || 0, netAfterEDon * 0.10);
    const net = Math.max(netAfterEDon - don, 0);

    const B = [[150000, 0], [150000, .05], [200000, .10], [250000, .15], [250000, .20], [1000000, .25], [3000000, .30], [Infinity, .35]];
    let tax = 0, rem = net, mg = 0;
    for (const [b, r] of B) { if (rem <= 0) break; const c = Math.min(rem, b); tax += c * r; rem -= c; if (c > 0) mg = r; }
    const wht = +s.wht || 0, tp = Math.round(tax);
    return {
      exp, fam, ins, ret, esg, home, don, eDonDeduct, easyReceipt, retSum, pvdExempt, pvdBase,
      pen, pensionForIns,
      effInc, net, taxPayable: tp, wht, refund: Math.round(wht - tp), marginal: mg,
      allowedRMF: rmf,
      rmfRoom: Math.max(Math.min(inc * 0.30, 500000 - pvdBase - ssf - pen) - (+s.rmf || 0), 0),
      esgRoom: Math.max(Math.min(inc * 0.30, 300000) - esg, 0),
      retireRoom: Math.max(500000 - retSum, 0)
    };
  }

  // ── JSON.parse แบบไม่ throw ──
  function safeParse(s) { try { return JSON.parse(s); } catch { return {}; } }

  // ── coerce ข้อมูล tax จาก Sheet ให้เป็นตัวเลข + migrate field เก่า ──
  function coerceTax(o) {
    const out = { ...o };
    if (out.rmfBought === undefined && out.rmfHistorical !== undefined) out.rmfBought = out.rmfHistorical;
    if (out.esgBought === undefined && out.esgHistorical !== undefined) out.esgBought = out.esgHistorical;
    ["income", "wht", "ss", "pvd", "parents", "children", "children2nd", "parentsHealth",
      "lifeInsurance", "healthInsurance", "pension", "ssf", "homeLoan", "donation",
      "rmfBought", "esgBought", "easyReceipt", "eDonation", "maternity", "disabledCare"].forEach(k => out[k] = +out[k] || 0);
    out.spouse = +out.spouse ? 1 : 0;
    return out;
  }

  // ── pure aggregation helpers (index.html ห่อด้วย STATE.assets) ──
  function sumValues(assets) {
    return (assets || []).reduce((s, a) => s + (+a.value || 0), 0);
  }
  function groupByClass(assets, keys) {
    const m = {};
    (keys || []).forEach(k => m[k] = 0);
    (assets || []).forEach(a => m[a.asset_class] = (m[a.asset_class] || 0) + (+a.value || 0));
    return m;
  }
  function groupByBucket(assets) {
    const m = {};
    (assets || []).forEach(a => m[a.bucket] = (m[a.bucket] || 0) + (+a.value || 0));
    return m;
  }

  // ── Net Worth aggregation (Phase 1) — pure, read-only ต่อ engine เดิม ──
  // ของถือร่วมเก็บ splitFern/splitNut (0..1); owner เป็นแค่ตัวช่วย UI
  function ownerSplit(owner) {
    if (owner === "fern") return { splitFern: 1, splitNut: 0 };
    if (owner === "nut") return { splitFern: 0, splitNut: 1 };
    return { splitFern: 0.5, splitNut: 0.5 }; // household
  }
  function splitFor(row, p) { return p === "fern" ? (+row.splitFern || 0) : (+row.splitNut || 0); }
  function isActive(row) { return !(row.active === false || row.active === "FALSE" || row.active === 0); }

  // ctx = { portfolios:{fern:[],nut:[]}, liabilities:[], assetsOther:[] }
  function netWorthParts(p, ctx) {
    ctx = ctx || {};
    const portfolio = sumValues((ctx.portfolios || {})[p] || []);
    const other = (ctx.assetsOther || []).reduce((s, r) => s + (+r.currentValue || 0) * splitFor(r, p), 0);
    const assets = portfolio + other;
    const liabilities = (ctx.liabilities || []).filter(isActive)
      .reduce((s, r) => s + (+r.principalRemaining || 0) * splitFor(r, p), 0);
    return { portfolio, assetsOther: other, assets, liabilities, netWorth: assets - liabilities };
  }
  function netWorthAll(ctx) {
    const fern = netWorthParts("fern", ctx), nut = netWorthParts("nut", ctx);
    const household = {
      portfolio: fern.portfolio + nut.portfolio,
      assetsOther: fern.assetsOther + nut.assetsOther,
      assets: fern.assets + nut.assets,
      liabilities: fern.liabilities + nut.liabilities,
      netWorth: fern.netWorth + nut.netWorth,
    };
    return { fern, nut, household };
  }

  return {
    num, baht, remainingMonths, bracketInfo, calcTax, safeParse, coerceTax,
    sumValues, groupByClass, groupByBucket,
    ownerSplit, splitFor, isActive, netWorthParts, netWorthAll
  };
});
