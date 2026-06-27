// ╔══════════════════════════════════════════════════╗
// ║  lib/config.js — ค่าคงที่, SEED, asset classes    ║
// ║  แก้กองทุน / เป้าหมาย / ข้อมูลตั้งต้นที่นี่ที่เดียว  ║
// ╚══════════════════════════════════════════════════╝

const API_URL = "https://script.google.com/macros/s/AKfycby784l1qVZ2Kc21xqTdVIE-O30PddA0OrtM2bpWzhb05c1aXqngb_azUzIzzCmlpQuD/exec";

// ── Asset class master (รวม 100%) ──
const CLASSES = {
  dm_core:    {label:"หุ้นต่างประเทศ (กระจาย)", target:27, color:"#5B8DEF"},
  dm_tech:    {label:"หุ้น Tech / Growth",       target:22, color:"#4DD0C7", ceiling:28},
  thai_equity:{label:"หุ้นไทย",                target:17, color:"#D8745F"},
  fixed:      {label:"ตราสารหนี้",              target:22, color:"#5FB98E"},
  em_growth:  {label:"EM โต (อินเดีย+เวียดนาม)", target:7,  color:"#B98ED8"},
  em_china:   {label:"จีน (tactical)",           target:6,  color:"#9B7BC4", ceiling:8},
  gold:       {label:"ทองคำ",                   target:5,  color:"#C8A35B"},
  reit:       {label:"อสังหา / REIT",            target:2,  color:"#E0975C"},
};
const CK = Object.keys(CLASSES);
const BUCKET_COLORS = ["#C8A35B","#5B8DEF","#5FB98E","#B98ED8","#E0975C","#D8745F"];

// ── Per-profile target overrides ──
// เฉพาะ key ที่ต่างจาก CLASSES จะ override, ที่เหลือใช้ค่า default
const PROFILE_TARGETS = {
  nut: {
    dm_tech:    {target:30, ceiling:35},
    dm_core:    {target:28},
    fixed:      {target:14},
    thai_equity:{target:11},
    em_growth:  {target:6},
    em_china:   {target:6, ceiling:8},
    gold:       {target:5},
    reit:       {target:0},
  }
};
// ผลรวม nut: 30+28+14+11+6+6+5+0 = 100 ✓

// helper: คืน CLASSES[k] merged กับ profile override ของ STATE.profile
// (STATE เป็น global ที่ index.html กำหนด — ปลอดภัยเพราะ cls() ถูกเรียกหลัง STATE พร้อมแล้ว)
function cls(k){ return {...CLASSES[k], ...(PROFILE_TARGETS[STATE.profile]||{})[k]}; }

// ── SEED — ข้อมูลตั้งต้นสำหรับ "โหลด seed เริ่มต้น" ──
const SEED = {
  fern: {
    assets:[
      {id:"pvd_f",    bucket:"PVD",     name:"MRT-F ตราสารหนี้",         asset_class:"fixed",       value:377560.80, plan:0, pvd_pct:0},
      {id:"pvd_e",    bucket:"PVD",     name:"MRT-E หุ้นไทย",            asset_class:"thai_equity", value:226536.48, plan:0, pvd_pct:0},
      {id:"pvd_fif_t",bucket:"PVD",     name:"MRT-FIF (Tech)",            asset_class:"dm_tech",     value:30205,     plan:0, pvd_pct:0},
      {id:"pvd_fif_c",bucket:"PVD",     name:"MRT-FIF (กระจาย)",          asset_class:"dm_core",     value:120819,    plan:0, pvd_pct:0},
      {id:"th_advanc",bucket:"หุ้นไทย", name:"ADVANC",                    asset_class:"thai_equity", value:192150,    plan:0},
      {id:"th_aot",   bucket:"หุ้นไทย", name:"AOT",                       asset_class:"thai_equity", value:90016,     plan:0},
      {id:"th_bdms",  bucket:"หุ้นไทย", name:"BDMS",                      asset_class:"thai_equity", value:75474,     plan:0},
      {id:"th_cpall", bucket:"หุ้นไทย", name:"CPALL",                     asset_class:"thai_equity", value:80080,     plan:0},
      {id:"f_inno_t", bucket:"RMF",     name:"B-INNOTECHRMF (Tech)",      asset_class:"dm_tech",     value:143923,    plan:2850},
      {id:"f_inno_c", bucket:"RMF",     name:"B-INNOTECHRMF (อื่น)",      asset_class:"dm_core",     value:7575,      plan:150},
      {id:"f_sp_t",   bucket:"RMF",     name:"SCBRMS&P500 (Tech)",        asset_class:"dm_tech",     value:14519,     plan:0},
      {id:"f_sp_c",   bucket:"RMF",     name:"SCBRMS&P500 (อื่น)",        asset_class:"dm_core",     value:21779,     plan:0},
      {id:"f_eu",     bucket:"RMF",     name:"SCBRMEU",                   asset_class:"dm_core",     value:25388.93,  plan:3000},
      {id:"f_china",  bucket:"RMF",     name:"SCBRMMLCA",                 asset_class:"em_china",    value:23385.39,  plan:0},
      {id:"f_india",  bucket:"RMF",     name:"B-INDIAMRMF",               asset_class:"em_growth",   value:21827.96,  plan:4000},
      {id:"f_viet",   bucket:"RMF",     name:"KFVIETRMF",                 asset_class:"em_growth",   value:6210.51,   plan:3000},
      {id:"f_global_t",bucket:"RMF",    name:"B-GLOBALRMF (Tech 38%)",    asset_class:"dm_tech",     value:0,         plan:4180},
      {id:"f_global_c",bucket:"RMF",   name:"B-GLOBALRMF (กระจาย 62%)", asset_class:"dm_core",     value:0,         plan:6820},
      {id:"f_gold",   bucket:"RMF",     name:"SCBGOLDHRMF",               asset_class:"gold",        value:0,         plan:6000},
      {id:"f_kfgg_t", bucket:"SSF",     name:"KFGGSSF (Tech)",            asset_class:"dm_tech",     value:37676,     plan:0},
      {id:"f_kfgg_c", bucket:"SSF",     name:"KFGGSSF (กระจาย)",         asset_class:"dm_core",     value:30826,     plan:0},
      {id:"f_spssf_t",bucket:"SSF",     name:"SCBS&P500-SSF (Tech)",      asset_class:"dm_tech",     value:32224,     plan:0},
      {id:"f_spssf_c",bucket:"SSF",     name:"SCBS&P500-SSF (อื่น)",      asset_class:"dm_core",     value:48336,     plan:0},
      {id:"f_kchg_t", bucket:"SSF",     name:"K-CHANGE-SSF (Tech)",       asset_class:"dm_tech",     value:34367,     plan:0},
      {id:"f_kchg_c", bucket:"SSF",     name:"K-CHANGE-SSF (กระจาย)",    asset_class:"dm_core",     value:28118,     plan:0},
      {id:"f_kchina", bucket:"SSF",     name:"K-CHINA-SSF",               asset_class:"em_china",    value:43453.37,  plan:0},
      {id:"f_scbce",  bucket:"SSF",     name:"SCBCE(SSF) จีน A",          asset_class:"em_china",    value:3269.28,   plan:0},
      {id:"f_vietssf",bucket:"SSF",     name:"B-VIETNAMSSF",              asset_class:"em_growth",   value:3072.09,   plan:0},
      {id:"f_scbfp",  bucket:"SSF",     name:"SCBFP-SSF (REIT)",          asset_class:"reit",        value:6192.66,   plan:0},
      {id:"f_scbsff", bucket:"SSF",     name:"SCBSFF (บอนด์สั้น)",        asset_class:"fixed",       value:72.2,      plan:0},
      {id:"f_thaiesg",bucket:"ThaiESG", name:"SCBTB (ThaiESG)",           asset_class:"fixed",       value:24667.5,   plan:5000},
    ],
    tax:{income:1683028,wht:225026,ss:10500,pvd:72423,spouse:0,parents:0,children:0,children2nd:0,
      parentsHealth:0,lifeInsurance:0,healthInsurance:0,pension:0,ssf:0,homeLoan:0,donation:0,
      rmfBought:87285,esgBought:30000},
  },
  nut: {
    assets:[
      {id:"n_inno",    bucket:"BBLAM",  name:"RMFBINNOTECH",        asset_class:"dm_tech",     value:129140, plan:1000},
      {id:"n_gold",    bucket:"BBLAM",  name:"BGOLDRMF",            asset_class:"gold",        value:3929,   plan:500},
      {id:"n_china_rmf",bucket:"BBLAM", name:"RMFBCHINAA",          asset_class:"em_china",    value:0,      plan:2750},
      {id:"n_gh",      bucket:"KAsset", name:"K-GHRMF (หุ้นโลก)",  asset_class:"dm_core",     value:65709,  plan:0},
      {id:"n_usa",     bucket:"KAsset", name:"K-USA-SSF (S&P500)",  asset_class:"dm_core",     value:20036,  plan:0},
      {id:"n_china",   bucket:"SSF",    name:"K-CHINA-SSF",         asset_class:"em_china",    value:2451,   plan:0},
      {id:"n_fixed",   bucket:"KAsset", name:"K-FIXEDPLUS-SSF",     asset_class:"fixed",       value:6422,   plan:0},
      {id:"n_firmf",   bucket:"KAsset", name:"K-FIRMF",             asset_class:"fixed",       value:2533,   plan:0},
      {id:"n_esg_e",   bucket:"SCB",    name:"SCBTM(ThaiESG) หุ้น",       asset_class:"thai_equity", value:0, plan:6200},
      {id:"n_esg_f",   bucket:"SCB",    name:"SCBTM(ThaiESG) ตราสารหนี้", asset_class:"fixed",       value:0, plan:2200},
      {id:"n_us_dca",  bucket:"BBLAM",  name:"RMFBUSPASSIVE",       asset_class:"dm_core",     value:0,      plan:2650},
      {id:"n_india",   bucket:"BBLAM",  name:"B-INDIAMRMF",         asset_class:"em_growth",   value:0,      plan:3000},
      {id:"n_pvd_world",bucket:"PVD",  name:"PVDWORLD",            asset_class:"dm_core",     value:11842.86,plan:0, pvd_pct:20},
      {id:"n_pvd_fi",   bucket:"PVD",  name:"PVDMPFFI",            asset_class:"fixed",       value:39938.50,plan:0, pvd_pct:70},
      {id:"n_pvd_gold", bucket:"PVD",  name:"PVDMGLDH",            asset_class:"gold",        value:4323.20, plan:0, pvd_pct:10},
    ],
    tax:{income:1439111,wht:139245,ss:10500,pvd:48400,spouse:0,parents:1,children:0,children2nd:0,
      parentsHealth:0,lifeInsurance:4510,healthInsurance:33000,pension:0,ssf:0,homeLoan:62000,donation:0,
      rmfBought:6000,esgBought:0},
  },
};
