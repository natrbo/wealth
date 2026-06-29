# Wealth Ledger — Financial Life Module Spec (v2)

เป้าหมาย: ขยาย Wealth Ledger จาก "เครื่องมือดูพอร์ตกองทุน" → **เครื่องมือดูภาพการเงินครบทุกมิติ (personal balance sheet + cash flow + protection)**
โดย **ไม่แตะ** engine เดิม (DCA / tax / derivedTax / fund allocation)

Repo: `natrbo/wealth` | Local: `F:\Cowork\wealth` | Backend: Google Sheets + Apps Script

> v2 ต่างจาก v1: เพิ่ม business interest (ธุรกิจปล่อยจำนอง), investment property (คอนโดเช่า),
> income-generating asset, insurance/protection, emergency fund metric, และแยก income statement ออกจาก balance sheet

---

## 0. หลักการสำคัญ (อ่านก่อนเริ่ม)

- **ห้ามแก้ logic เดิมของ DCA/tax/derivedTax** — โมดูลนี้เป็นชั้นใหม่ที่ aggregate ข้างบน
- 3 profile: `fern`, `nut`, `household` (ของถือร่วม)
- ของ household ใช้ระบบ **split** (splitFern/splitNut) ปันส่วนเข้า net worth แต่ละคน
- มี concept ใหม่สำคัญ: **income-generating asset** = สินทรัพย์ที่มีทั้งมูลค่า (balance sheet) และสร้างรายได้ (cash flow) เช่น loan book, คอนโดเช่า
- ทำตามลำดับ Phase ห้ามข้าม; เสร็จ phase ไหน verify ก่อนไปต่อ
- ทำตาม pattern เดิมของ sheet กองทุน — **ไปอ่าน code เดิมก่อนเขียน endpoint ใหม่**

---

## 1. กรอบ 8 มิติที่ครอบ (CFP framework)

| # | มิติ | เก็บใน sheet | สถานะ |
|---|---|---|---|
| 1 | Cash flow (รายรับ-จ่าย) | `CashFlow` + `IncomeStreams` | ใหม่ |
| 2 | Investment (พอร์ต) | engine เดิม | คงเดิม |
| 3 | Debt (หนี้สิน) | `Liabilities` | ใหม่ |
| 4 | Business interest (ธุรกิจปล่อยกู้) | `BusinessAssets` | ใหม่ |
| 5 | Real estate (อสังหาฯ ลงทุน) | `RealEstate` | ใหม่ |
| 6 | Insurance / protection | `Insurance` | ใหม่ |
| 7 | Emergency fund | derived จาก AssetsOther + CashFlow | ใหม่ |
| 8 | Net worth roll-up | aggregation layer | ใหม่ |

---

## 2. Schemas (Google Sheets)

ทุก sheet ที่เป็นได้ทั้งส่วนตัว/ถือร่วม จะมี 3 field มาตรฐานเหมือนกัน:
`owner` (fern/nut/household), `splitFern` (0–1), `splitNut` (0–1)

### 2.1 Sheet `Liabilities`
| คอลัมน์ | ชนิด | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `id` | string | LIAB-001 | |
| `name` | string | บ้านเฟิร์น | |
| `type` | enum | mortgage / condo / personal / auto / credit | |
| `owner` | enum | household | |
| `splitFern` / `splitNut` | number | 0.5 / 0.5 | |
| `principalRemaining` | number | 2400000 | เงินต้นคงเหลือ |
| `interestRate` | number | 3.5 | % ต่อปี |
| `monthlyPayment` | number | 18000 | ค่างวด/เดือน (ยอดเต็มก้อน) |
| `termRemainingMonths` | number | 180 | |
| `startDate` | date | 2023-01 | |
| `linkedAssetId` | string | RE-001 | (option) ถ้าหนี้นี้ผูกกับ asset เช่นคอนโดเช่า |
| `active` | bool | TRUE | |

หนี้ปัจจุบัน: 3 ก้อน (บ้านเฟิร์น, คอนโดนัท, สินเชื่อตกแต่ง) — owner=household, split 0.5/0.5 ทุกก้อน

**Derived:** `monthlyInterest`=principalRemaining×rate/100/12 ; `monthlyPrincipal`=monthlyPayment−monthlyInterest ; `payoffDate` ; `totalInterestRemaining` (จาก amortization)

### 2.2 Sheet `AssetsOther` (เงินสด / ทอง / ของมีค่า)
| คอลัมน์ | ชนิด | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `id` | string | AST-001 | |
| `name` | string | ทองรูปพรรณ 2 บาท | |
| `type` | enum | cash / gold / other | |
| `owner` / `splitFern` / `splitNut` | | | |
| `currentValue` | number | 78000 | ทอง = **มูลค่าขายคืนจริง** หักกำเหน็จ |
| `unit` | string | THB | |
| `quantity` | number | 2 | |
| `liquid` | bool | TRUE | เงินสด=TRUE → ใช้คำนวณ emergency fund |
| `valuationDate` | date | 2026-06 | |

### 2.3 Sheet `BusinessAssets` (ธุรกิจปล่อยจำนอง)
| คอลัมน์ | ชนิด | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `id` | string | BIZ-001 | |
| `name` | string | บริษัทปล่อยจำนอง | |
| `type` | enum | mortgage_lending | |
| `owner` / `splitFern` / `splitNut` | | household / 0.5 / 0.5 | |
| `loanBookOutstanding` | number | 3000000 | **เงินต้นคงค้างที่ปล่อยกู้รวม** (ลูกหนี้หลายราย) |
| `monthlyInterestIncome` | number | 45000 | **ดอกเบี้ยรับ/เดือน** (รวมทุกลูกหนี้) |
| `avgInterestRate` | number | 18 | % ต่อปีเฉลี่ย (option, ไว้ประเมิน yield) |
| `provisionForDoubtful` | number | 150000 | กันสำรองหนี้สงสัยจะสูญ (หักจากมูลค่า) |
| `valuationDate` | date | 2026-06 | |

> หมายเหตุ: loan book เป็น "ลูกหนี้หลายรายกระจาย" — เก็บเป็นยอดรวม ไม่ต้องแยกรายคน
> มูลค่าธุรกิจที่นับเข้า net worth = `loanBookOutstanding − provisionForDoubtful`
> ดอกเบี้ยรับ = income stream (ไปข้อ 2.6)

### 2.4 Sheet `RealEstate` (อสังหาฯ ลงทุน เช่นคอนโดเช่า)
| คอลัมน์ | ชนิด | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `id` | string | RE-001 | |
| `name` | string | คอนโดปล่อยเช่า A | |
| `type` | enum | rental_condo | |
| `owner` / `splitFern` / `splitNut` | | | |
| `marketValue` | number | 3200000 | มูลค่าตลาดปัจจุบัน |
| `monthlyRentIncome` | number | 15000 | ค่าเช่า/เดือน (gross) |
| `monthlyRentExpense` | number | 3000 | ค่าส่วนกลาง/ซ่อม/ภาษีโรงเรือน เฉลี่ย |
| `linkedLiabilityId` | string | LIAB-00X | (option) ถ้ามีหนี้คอนโดผูกอยู่ |
| `valuationDate` | date | 2026-06 | |

> net rent = monthlyRentIncome − monthlyRentExpense → income stream
> ใน net worth นับ `marketValue` ฝั่ง asset; ถ้ามี linkedLiability หนี้ก้อนนั้นหักอยู่แล้วใน Liabilities (อย่านับซ้ำ)

### 2.5 Sheet `Insurance` (ประกันชีวิต + สุขภาพ)
| คอลัมน์ | ชนิด | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `id` | string | INS-001 | |
| `name` | string | ประกันชีวิต AIA | |
| `type` | enum | life / health | |
| `insured` | enum | fern / nut | ผู้เอาประกัน |
| `sumAssured` | number | 2000000 | ทุนประกัน (ความคุ้มครอง) |
| `cashValue` | number | 180000 | มูลค่าเวนคืน (ถ้ามี — แบบสะสมทรัพย์) → นับเป็น asset |
| `annualPremium` | number | 36000 | เบี้ย/ปี |
| `premiumFrequency` | enum | annual / monthly | ไว้กระจายเข้า cash flow |
| `taxDeductible` | bool | TRUE | เบี้ยประกันชีวิต/สุขภาพลดหย่อนได้ (ลิงก์ tax engine เดิมได้ทีหลัง) |

> ประกันมี 2 บทบาท: (1) `cashValue` → asset ใน net worth ; (2) `sumAssured` → ใช้ในมุม protection (เพียงพอกับหนี้+ผู้พึ่งพิงไหม) ; (3) `annualPremium` → cash outflow

### 2.6 Sheet `IncomeStreams` (รายได้ทุกทาง)
| คอลัมน์ | ชนิด | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `id` | string | INC-001 | |
| `source` | string | เงินเดือน / ดอกเบี้ยปล่อยกู้ / ค่าเช่าคอนโด | |
| `type` | enum | salary / business_interest / rental / other | |
| `owner` / `splitFern` / `splitNut` | | | |
| `monthlyAmount` | number | 120000 | รายได้สุทธิ/เดือน |
| `passive` | bool | FALSE | active (เงินเดือน) vs passive (ดอกรับ/ค่าเช่า) → สำคัญต่อ FIRE |
| `linkedAssetId` | string | BIZ-001 / RE-001 | (option) เชื่อมกับ asset ต้นทาง |

> passive income เป็น metric สำคัญต่อเกษียณ: เมื่อ passive income ≥ รายจ่าย = financial independence

### 2.7 Sheet `CashFlow` (รายจ่ายประจำ)
| คอลัมน์ | ชนิด | ตัวอย่าง | หมายเหตุ |
|---|---|---|---|
| `profile` | enum | fern | fern / nut |
| `monthlyExpense` | number | 40000 | รายจ่ายประจำ (ไม่รวมหนี้, ไม่รวม DCA, ไม่รวมเบี้ยประกัน) |

> รายได้แยกไปอยู่ใน IncomeStreams แล้ว (รองรับหลายแหล่ง); ที่นี่เก็บเฉพาะรายจ่าย

---

## 3. Aggregation Layer (JS ใหม่ — read-only ต่อ engine เดิม)

### 3.1 Net Worth ต่อ profile p (fern/nut)
```
ASSETS(p) =
    portfolioValue(p)                              ← engine เดิม (กองทุน/หุ้น/PVD) read-only
  + Σ AssetsOther.currentValue   × split[p]
  + Σ BusinessAssets.(loanBookOutstanding − provisionForDoubtful) × split[p]
  + Σ RealEstate.marketValue     × split[p]
  + Σ Insurance.cashValue        (where insured=p)

LIABILITIES(p) =
    Σ Liabilities.principalRemaining × split[p]   (active เท่านั้น)

netWorth(p) = ASSETS(p) − LIABILITIES(p)
```
Household รวม = netWorth(fern) + netWorth(nut)

> ⚠️ กันนับซ้ำ: ถ้า RealEstate มี linkedLiabilityId หนี้ก้อนนั้นต้องอยู่ใน Liabilities อยู่แล้ว — asset นับ marketValue เต็ม, หนี้นับแยก, ผลลัพธ์สุทธิคือ equity ในคอนโด ถูกต้อง

### 3.2 Cash flow & DCA capacity ต่อ profile p
```
income(p)        = Σ IncomeStreams.monthlyAmount × split[p]
debtPayment(p)   = Σ Liabilities.monthlyPayment × split[p]   (active)
insurancePrem(p) = Σ Insurance.annualPremium/12 (where insured=p)
expense(p)       = CashFlow.monthlyExpense(p)

safeDCACapacity(p) = income(p) − expense(p) − debtPayment(p) − insurancePrem(p)

IF (DCA ปัจจุบันของ p) > safeDCACapacity(p) → ⚠ warning "DCA เกินกระแสเงินสด"
```

### 3.3 Passive income ratio (FIRE metric)
```
passiveIncome(p) = Σ IncomeStreams.monthlyAmount × split[p] WHERE passive=TRUE
passiveRatio(p)  = passiveIncome(p) / expense(p)

passiveRatio ≥ 1.0  → financial independence (passive ครอบรายจ่ายแล้ว)
```

### 3.4 Emergency fund (เดือน)
```
liquidAssets(p)   = Σ AssetsOther.currentValue × split[p] WHERE liquid=TRUE
monthlyBurn(p)    = expense(p) + debtPayment(p) + insurancePrem(p)
emergencyMonths(p) = liquidAssets(p) / monthlyBurn(p)

เกณฑ์: < 3 เดือน = ⚠ ต่ำ ; 3–6 = ✅ พอ ; > 12 = 💡 เงินสดเกิน อาจเอาไปลงทุน
```

### 3.5 Protection gap (ประกันพอไหม)
```
สำหรับแต่ละคน p:
  needCoverage(p) = LIABILITIES(p) + (expense(p) × 12 × จำนวนปีที่อยากคุ้มครองผู้พึ่งพิง)
  haveCoverage(p) = Σ Insurance.sumAssured (life, insured=p)
  gap(p) = needCoverage(p) − haveCoverage(p)

  gap > 0 → ⚠ ความคุ้มครองชีวิตอาจไม่พอครอบหนี้+ครอบครัว
```

---

## 4. Dashboard UI (หน้า/แท็บใหม่)

```
┌──────────────────────────────────────────────────┐
│  [Fern] [Nut] [Household]      ← profile toggle
├──────────────────────────────────────────────────┤
│  NET WORTH: ฿X,XXX,XXX             ← ตัวเลขใหญ่สุด
│  assets ฿X,XXX  ·  debt ฿XXX
├─────────────────────────┬────────────────────────┤
│  ASSETS                 │  LIABILITIES           │
│   • พอร์ตกองทุน/หุ้น    │   • บ้านเฟิร์น (50%)   │
│   • เงินสด/เงินฝาก      │   • คอนโดนัท (50%)     │
│   • ทอง                 │   • สินเชื่อตกแต่ง (50%)│
│   • ธุรกิจปล่อยกู้      │                        │
│   • คอนโดเช่า (equity)  │                        │
│   • cash value ประกัน   │                        │
├─────────────────────────┴────────────────────────┤
│  CASH FLOW (รายเดือน)
│   รายได้ ฿XX · รายจ่าย ฿XX · หนี้ ฿XX · เบี้ย ฿XX
│   เหลือ/DCA capacity: ฿XX,XXX
│   ⚠ DCA ใช้ ฿35,000 / capacity ฿XX,XXX
├───────────────────────────────────────────────────┤
│  KEY METRICS
│   • Emergency fund: X.X เดือน  [bar เทียบเกณฑ์ 6]
│   • Passive income ratio: XX%  [passive ฿XX / จ่าย ฿XX]
│   • Debt-to-Asset: XX%
│   • Protection gap: ฿XXX (หรือ ✅ พอ)
├───────────────────────────────────────────────────┤
│  ANALYSIS
│   • Payoff timeline (bar ต่อก้อนหนี้ + payoffDate)
│   💡 Pay-off vs Invest (ต่อก้อน): หนี้ X% vs พอร์ต ~7%
└───────────────────────────────────────────────────┘
```

## 5. Pay-off vs Invest Analysis (logic)
```
ต่อหนี้แต่ละก้อน เทียบ cost of debt กับ expected return:
  expectedReturn = config (default 7% — ★ ผู้ใช้ปรับให้ตรงพอร์ตจริง)
  IF interestRate > expectedReturn → "โปะก้อนนี้ก่อน"
  ELSE                             → "ผ่อนตามงวด ลงทุนต่อ"
แสดงคำแนะนำ + ส่วนต่าง %
หมายเหตุ mortgage: ดอกเบี้ยบ้านลดหย่อนภาษีได้สูงสุด 100k/ปี → flag
หมายเหตุพิเศษ: ธุรกิจปล่อยกู้ yield ~18% สูงกว่าหนี้บ้าน 3.5% มาก
  → ถ้ามีเงินเหลือ การขยาย loan book อาจให้ผลตอบแทนดีกว่าโปะบ้าน (แสดงเป็น insight)
```

---

## 6. ลำดับ Implementation (ทำทีละ Phase, verify ก่อนไปต่อ)

**Phase 1 — Foundation (balance sheet พื้นฐาน)**
1. สร้าง sheet: `Liabilities`, `AssetsOther` + Apps Script CRUD (ตาม pattern กองทุนเดิม)
2. Aggregation layer ขั้นต้น: net worth = พอร์ต + AssetsOther − Liabilities
3. Dashboard read-only แสดง net worth 3 profile

**Phase 2 — Income-generating assets**
4. สร้าง sheet: `BusinessAssets`, `RealEstate`, `IncomeStreams` + CRUD
5. ขยาย aggregation: รวม business/real estate เข้า asset + income streams

**Phase 3 — Cash flow & protection**
6. สร้าง sheet: `CashFlow`, `Insurance` + CRUD
7. คำนวณ: DCA capacity, emergency fund, passive ratio, protection gap
8. แสดง warning ต่างๆ

**Phase 4 — Analysis (nice-to-have)**
9. Payoff timeline + Pay-off vs Invest + insight ธุรกิจปล่อยกู้

## 7. Definition of Done
- [ ] engine เดิม (DCA/tax/derivedTax) ไม่มี regression
- [ ] CRUD ครบทุก sheet ใหม่ผ่าน UI
- [ ] net worth fern/nut/household ถูกตามสูตร split — **ไม่มีการนับซ้ำ** (คอนโด+หนี้คอนโด)
- [ ] ทองแสดงมูลค่าขายคืนจริง / business แสดงสุทธิหลังหักสำรอง
- [ ] emergency fund, passive ratio, DCA capacity, protection gap คำนวณถูก
- [ ] payoff timeline + pay-off vs invest แสดงผล
- [ ] expectedReturn เป็น config ที่ปรับได้ (ไม่ hardcode)

## 8. ★ จุดที่ผู้ใช้ต้องตัดสินใจ/ใส่ค่าจริงก่อนใช้งาน
- `expectedReturn` ของพอร์ต (default 7%) — ปรับให้ตรงสมมติฐานจริง
- จำนวนปีคุ้มครองผู้พึ่งพิงในสูตร protection gap (เช่น 10 ปี)
- มูลค่าตลาดคอนโด/ทอง ต้องอัปเดต `valuationDate` เป็นระยะ (ราคาผันผวน)
- provision หนี้สงสัยจะสูญของ loan book — ประเมินตามจริง
