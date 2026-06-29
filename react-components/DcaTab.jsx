import React from 'react';

/**
 * DcaTab Component
 * 
 * หน้าต่างแสดงสถานะแผนและรายการเป้าหมาย DCA
 */
export default function DcaTab({ data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      
      {/* Column 1: DCA Overview Status Card */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">สถานะแผนลงทุน DCA ปี 2569</span>
          <div className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white mt-2">
            ฿{data.dcaAccum.toLocaleString()}
          </div>
          <span className="text-xs text-zinc-500 font-semibold block mb-4">สะสมครบแล้ว 6 เดือน / แผนทั้งหมด 12 เดือน</span>
          
          {/* Progress Bar */}
          <div className="w-full bg-zinc-150 dark:bg-zinc-800 h-3.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full w-[50%]" />
          </div>
        </div>

        {/* Monthly Savings Card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
          <h3 className="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-4">แผนลงทุนต่อเดือน</h3>
          <div className="text-3xl font-extrabold text-indigo-650 dark:text-indigo-400">
            ฿30,000 / เดือน
          </div>
        </div>
      </div>

      {/* Column 2: Assets List Table (Tablet-safe md:col-span-2) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm md:col-span-1 xl:col-span-2">
        <h3 class="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-6">รายการกองทุนเป้าหมาย DCA</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr class="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs uppercase font-extrabold">
                <th class="py-3">ชื่อสินทรัพย์</th>
                <th class="py-3 text-right">สะสมแล้ว (YTD)</th>
                <th class="py-3 text-right">แผนรายเดือน</th>
                <th class="py-3 text-right">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
              <tr>
                <td className="py-4 font-bold text-zinc-900 dark:text-white">B-INNOTECHRMF</td>
                <td className="py-4 text-right">฿90,000</td>
                <td className="py-4 text-right text-indigo-600 dark:text-indigo-400">฿15,000</td>
                <td className="py-4 text-right text-emerald-500 font-bold">50.0%</td>
              </tr>
              <tr>
                <td className="py-4 font-bold text-zinc-900 dark:text-white">SCBTB (ThaiESG)</td>
                <td className="py-4 text-right">฿60,000</td>
                <td className="py-4 text-right text-indigo-600 dark:text-indigo-400">฿10,000</td>
                <td className="py-4 text-right text-emerald-500 font-bold">50.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
