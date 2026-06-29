import React, { useState } from 'react';
import DeductBlock from './DeductBlock';

/**
 * TaxCalculator Component
 * 
 * หน้าต่างจำลองภาษีและการคำนวณขั้นบันได
 */
export default function TaxCalculator({ data }) {
  const [rmfYtd, setRmfYtd] = useState(150000);
  const [esgYtd, setEsgYtd] = useState(50000);
  const [income, setIncome] = useState(1200000);
  const [wht, setWht] = useState(60000);

  // Constants
  const futureMonths = 6;
  const rmfMonthly = 15000;
  const esgMonthly = 10000;

  // Calculators
  const rmfProj = rmfYtd + rmfMonthly * futureMonths;
  const esgProj = esgYtd + esgMonthly * futureMonths;
  const totalDeduct = rmfProj + esgProj;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      
      {/* COL 1: REAL-TIME TAX CALCULATOR WATERFALL */}
      <div className="space-y-6">
        
        {/* Summary Hero Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm text-center">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">ผลสรุปรายการภาษีปี 2569</span>
          
          {/* Large Value */}
          <div className="text-4xl font-extrabold tracking-tight text-emerald-500 mt-3" id="tax-refund-amt">
            ฿{data.taxRefund.toLocaleString()}
          </div>
          <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500">
            คาดว่าจะได้รับเงินคืน 🎉
          </span>
          
          {/* Subtitle details */}
          <div className="flex justify-between items-center text-xs text-zinc-500 mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <span>ถูกหักภาษี ณ ที่จ่าย (WHT)</span>
            <span className="font-bold text-zinc-750 dark:text-zinc-300">฿{wht.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-zinc-500 mt-2">
            <span>ภาษีที่ต้องจ่ายจริง</span>
            <span className="font-bold text-zinc-755 dark:text-zinc-350">฿17,500</span>
          </div>
        </div>

        {/* Tax Calculation Steps Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
          <h3 className="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-4">สรุปการคำนวณขั้นบันได</h3>
          
          <div className="space-y-3 text-xs font-medium">
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span class="text-zinc-550">เงินได้ทั้งปี (พึงประเมิน)</span>
              <span class="font-bold text-zinc-800 dark:text-white">฿{income.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-550">หักลดหย่อน RMF+ThaiESG</span>
              <span className="font-bold text-emerald-500">-฿{totalDeduct.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-550">เงินได้สุทธิ (Net Income)</span>
              <span className="font-bold text-indigo-650 dark:text-indigo-400">฿660,000</span>
            </div>
          </div>
        </div>
      </div>

      {/* COL 2: ACTIONABLE INPUTS & DEDUCT BLOCKS */}
      <div className="space-y-6">
        
        {/* Standard Inputs */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
          <h3 className="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-5">ข้อมูลการหักภาษี</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">เงินได้รวมทั้งปี</label>
              <div className="relative rounded-xl shadow-sm">
                <input 
                  type="text" 
                  value={income.toLocaleString()} 
                  onChange={(e) => setIncome(parseInt(e.target.value.replace(/,/g, '')) || 0)}
                  className="w-full pl-4 pr-12 py-3 bg-zinc-50 dark:bg-zinc-850 border border-zinc-250 dark:border-zinc-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 outline-none text-right transition-all dark:text-white"
                />
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-xs font-bold text-zinc-400">บาท</div>
              </div>
            </div>
          </div>
        </div>

        {/* Deduct Block 1: RMF */}
        <DeductBlock 
          label="กองทุนลดหย่อน RMF"
          color="#6366F1"
          portVal={450000}
          value={rmfYtd}
          onChange={setRmfYtd}
          onQuickFill={() => setRmfYtd(260000)}
          onAddAmount={(amt) => setRmfYtd(prev => prev + amt)}
          futureMonths={futureMonths}
          monthlyPlan={rmfMonthly}
        />

        {/* Deduct Block 2: ThaiESG */}
        <DeductBlock 
          label="กองทุนลดหย่อน ThaiESG"
          color="#10B981"
          portVal={240000}
          value={esgYtd}
          onChange={setEsgYtd}
          onQuickFill={() => setEsgYtd(190000)}
          onAddAmount={(amt) => setEsgYtd(prev => prev + amt)}
          futureMonths={futureMonths}
          monthlyPlan={esgMonthly}
        />
      </div>

      {/* COL 3: THERMO GAUGE & ADVICE PANEL (Stretches across 2 cols on md size, spans 1 col on xl) */}
      <div className="space-y-6 md:col-span-2 xl:col-span-1">
        
        {/* Real-time Advice Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
          <h3 className="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-4">💡 คำแนะนำ</h3>
          
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border-l-4 border-indigo-500 text-xs leading-relaxed text-zinc-650 dark:text-zinc-300">
              <strong className="text-indigo-750 dark:text-indigo-400 block mb-1">มีโควตาสำหรับสิทธิลดหย่อน ThaiESG เหลือ</strong>
              สะสมเพิ่มเพื่อประหยัดภาษีได้สูงสุด
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
