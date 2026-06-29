import React from 'react';

/**
 * OverviewTab Component
 * 
 * หน้าแสดงผลภาพรวมสินทรัพย์ สัดส่วน Donut Chart และตารางรายการ
 */
export default function OverviewTab({ data }) {
  return (
    <div className="space-y-6">
      
      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Card 1 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">มูลค่าสินทรัพย์สภาพคล่อง</span>
          <div className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-2">
            ฿{data.liquid.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 mt-2">ฝากออมทรัพย์ & กองทุนตลาดเงิน</div>
        </div>

        {/* Card 2 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">ยอด DCA คงเหลือปีนี้</span>
          <div className="text-3xl font-extrabold tracking-tight text-indigo-650 dark:text-indigo-400 mt-2">
            ฿{data.dcaLeft.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 mt-2">เหลือ 6 งวด · เฉลี่ยงวดละ ฿40,000</div>
        </div>

        {/* Card 3: Spans 2 columns on Tablet and 1 column on XL */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm relative overflow-hidden md:col-span-2 xl:col-span-1">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">ประหยัดภาษีสะสมปีนี้</span>
          <div className="text-3xl font-extrabold tracking-tight text-emerald-500 mt-2">
            ฿{data.taxRefund.toLocaleString()}
          </div>
          <div className="text-xs text-zinc-500 mt-2">จากกองทุนลดหย่อน RMF/ThaiESG</div>
        </div>
      </div>

      {/* Asset Allocation & Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Donut Chart Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center shadow-sm">
          <h3 className="font-extrabold text-sm text-zinc-400 uppercase tracking-wider self-start mb-6">สัดส่วนพอร์ตปัจจุบัน</h3>
          
          <div className="relative w-48 h-48 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="transparent" strokeWidth="4" />
              <circle className="stroke-indigo-500" cx="18" cy="18" r="15.915" fill="none" strokeDasharray="30 70" strokeDashoffset="100" strokeWidth="4" />
              <circle className="stroke-emerald-400" cx="18" cy="18" r="15.915" fill="none" strokeDasharray="45 55" strokeDashoffset="70" strokeWidth="4" />
              <circle className="stroke-amber-500" cx="18" cy="18" r="15.915" fill="none" strokeDasharray="15 85" stroke-dashoffset="25" strokeWidth="4" />
              <circle className="stroke-red-400" cx="18" cy="18" r="15.915" fill="none" strokeDasharray="10 90" stroke-dashoffset="10" strokeWidth="4" />
            </svg>
            <div className="absolute text-center">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-widest">Total Asset</span>
              <span className="text-xl font-extrabold text-zinc-900 dark:text-white">
                ฿{(data.networth / 1000000).toFixed(2)}M
              </span>
            </div>
          </div>
        </div>

        {/* Assets Detail Table Card: Spans 2 columns on Tablet and XL */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm md:col-span-1 xl:col-span-2">
          <h3 class="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-6">รายละเอียดสินทรัพย์ลงทุน</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs uppercase font-extrabold">
                  <th className="py-3">ชื่อสินทรัพย์</th>
                  <th class="py-3">ประเภท</th>
                  <th class="py-3 text-right">มูลค่าพอร์ต</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
                <tr>
                  <td className="py-4 font-bold text-zinc-900 dark:text-white">B-INNOTECHRMF</td>
                  <td className="py-4 text-xs text-zinc-500">กองทุน RMF</td>
                  <td className="py-4 text-right font-semibold">฿450,000</td>
                </tr>
                <tr>
                  <td className="py-4 font-bold text-zinc-900 dark:text-white">SCBTB (ThaiESG)</td>
                  <td className="py-4 text-xs text-zinc-500">กองทุน ThaiESG</td>
                  <td className="py-4 text-right font-semibold">฿240,000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
