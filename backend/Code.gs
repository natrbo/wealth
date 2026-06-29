// ╔══════════════════════════════════════════════════════════════════════╗
// ║  Apps Script Web App — backend ของ Wealth Ledger (JSON-store)          ║
// ║  Deployed Web App snapshot — version 3, deployed ~2026-06-29           ║
// ║  /exec: AKfycbwfYIwblQzLUGs7V5hgA5_qbQ0o1EyWD0BkFRvTu3nqSfWYzbkBhOSLIpNpP1fhxRhP
// ╚══════════════════════════════════════════════════════════════════════╝
//
// ⚠️ ไฟล์นี้เป็น SNAPSHOT สำหรับ track ใน git เท่านั้น — ตัวจริงรันอยู่ใน Apps Script editor
//    - แก้ที่นี่ "ไม่" ทำให้ live เปลี่ยน ต้องไปแก้ใน editor แล้ว Deploy version ใหม่
//    - เวลาแก้ backend จริง: แก้ใน editor → Deploy → New version → แล้วก๊อปกลับมาทับไฟล์นี้
//
// ⚠️ VERIFY: ตอน debug 2026-06-29 พบว่า doPost ที่ deploy ตอบ {ok:true,data:null}
//    แต่โค้ดด้านล่าง respond({ok:true}) ตอบแค่ {ok:true} → snapshot นี้อาจไม่ตรง
//    deploy 100% ควรก๊อปจาก editor ตัวจริงมาทับเพื่อความชัวร์
//
// สัญญา API (frontend ใช้):
//   GET  ?profile=<p>            → {ok, data:{<section>:<json>, ...}} (ทุก key ที่ขึ้นต้น "<p>_")
//   POST {sheet|section, profile, rows|data} → เขียน key "<profile>_<section>" = JSON
//   profile "global" ใช้เก็บ sheet ถือร่วม: global_liabilities, global_assetsOther, global_config

const SS = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  try {
    const profile = e.parameter.profile;
    if (!profile) throw new Error('missing profile');
    const store = SS.getSheetByName('store');
    const rows = store.getDataRange().getValues();
    const result = {};
    for (let i = 0; i < rows.length; i++) {
      const key = String(rows[i][0]);
      const val = rows[i][1];
      if (key.startsWith(profile + '_') && val) {
        const section = key.slice(profile.length + 1);
        try { result[section] = JSON.parse(val); } catch(e) { result[section] = val; }
      }
    }
    return respond({ok: true, data: result});
  } catch(err) {
    return respond({ok: false, error: err.message});
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const profile = body.profile;
    const section = body.section || body.sheet;   // รองรับทั้ง 2 format
    const data    = body.data !== undefined ? body.data : body.rows;
    if (!profile || !section) throw new Error('missing profile/section');
    const key = profile + '_' + section;
    const store = SS.getSheetByName('store');
    const rows = store.getDataRange().getValues();
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === key) {
        store.getRange(i + 1, 2).setValue(JSON.stringify(data));
        return respond({ok: true});
      }
    }
    store.appendRow([key, JSON.stringify(data)]);
    return respond({ok: true});
  } catch(err) {
    return respond({ok: false, error: err.message});
  }
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}



function migrate() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const store = ss.getSheetByName('store');
  if (!store) { Logger.log('ERROR: no store sheet'); return; }

  ['fern','nut'].forEach(profile => {
    // Assets — per-profile sheet ก่อน, ถ้าไม่มีให้ลอง shared "assets" sheet
    let aSheet = ss.getSheetByName(profile) || ss.getSheetByName(profile+'_assets');
    const sharedAssets = ss.getSheetByName('assets');

    if (aSheet) {
      const [hdrs,...rows] = aSheet.getDataRange().getValues();
      const assets = rows.filter(r=>r[0]).map(r=>Object.fromEntries(hdrs.map((h,i)=>[h,r[i]])));
      _writeStore(store, profile+'_assets', assets);
      Logger.log(profile+' assets: '+assets.length+' rows');
    } else if (sharedAssets) {
      const [hdrs,...rows] = sharedAssets.getDataRange().getValues();
      const pIdx = hdrs.indexOf('profile');
      const matching = pIdx>=0
        ? rows.filter(r=>r[pIdx]===profile)
        : rows.filter(r=>r[0]);
      const assets = matching.map(r=>Object.fromEntries(hdrs.filter(h=>h&&h!=='profile').map(h=>[h,r[hdrs.indexOf(h)]])));
      _writeStore(store, profile+'_assets', assets);
      Logger.log(profile+' assets: '+assets.length+' rows from shared sheet');
    } else {
      Logger.log(profile+' assets: ไม่เจอเลย');
    }

    // Tax
    const tSheet = ss.getSheetByName(profile+'_tax') || ss.getSheetByName('tax');
    if (tSheet) {
      const [hdrs,...rows] = tSheet.getDataRange().getValues();
      const pIdx = hdrs.indexOf('profile');
      const row = pIdx>=0 ? rows.find(r=>r[pIdx]===profile) : rows[0];
      if (row) {
        const tax = Object.fromEntries(hdrs.filter(h=>h&&h!=='profile').map(h=>[h,row[hdrs.indexOf(h)]]));
        _writeStore(store, profile+'_tax', tax);
        Logger.log(profile+' tax: OK');
      }
    }

    // Snapshots
    const sSheet = ss.getSheetByName('snapshots') || ss.getSheetByName(profile+'_snapshots');
    if (sSheet) {
      const [hdrs,...rows] = sSheet.getDataRange().getValues();
      const pIdx = hdrs.indexOf('profile');
      const snaps = rows
        .filter(r=>r[0]&&(pIdx<0||r[pIdx]===profile))
        .map(r=>Object.fromEntries(hdrs.filter(h=>h&&h!=='profile').map(h=>[h,r[hdrs.indexOf(h)]])));
      if (snaps.length) { _writeStore(store, profile+'_snapshots', snaps); Logger.log(profile+' snaps: '+snaps.length); }
    }
  });

  Logger.log('migrate() done');
}

function _writeStore(sheet, key, value) {
  const data = sheet.getDataRange().getValues();
  for (let i=1; i<data.length; i++) {
    if (data[i][0]===key) { sheet.getRange(i+1,2).setValue(JSON.stringify(value)); return; }
  }
  sheet.appendRow([key, JSON.stringify(value)]);
}
