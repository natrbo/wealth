import React from 'react';

/**
 * NetWorthTab Component
 * 
 * หน้าแสดงประวัติยอดสินทรัพย์สุทธิรายเดือน พร้อมกราฟแนวโน้ม SVG
 */
export default function NetWorthTab({ data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      
      {/* Line Chart Growth View (Stretches across 2 columns on Tablet and laptop) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm md:col-span-2">
        <h3 className="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-6">แนวโน้มความมั่งคั่งสุทธิ (12 เดือนย้อนหลัง)</h3>
        
        <div className="w-full h-64 relative bg-zinc-50/50 dark:bg-zinc-950/20 p-4 rounded-xl border border-zinc-150 dark:border-zinc-850">
          <svg className="w-full h-full" viewBox="0 0 500 200" preserveAspectRatio="none">
            <defs>
              <linearGradient id="networth-chart-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/>
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0"/>
              </linearGradient>
            </defs>
            <path d="M 0 160 Q 125 150 250 120 T 500 40 L 500 200 L 0 200 Z" fill="url(#networth-chart-grad)" />
            <path d="M 0 160 Q 125 150 250 120 T 500 40" fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="250" cy="120" r="5" fill="#10B981" />
            <circle cx="500" cy="40" r="5" fill="#10B981" />
          </svg>
        </div>
      </div>

      {/* Balance Sheet Cards */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
        <h3 className="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-6">งบดุลย่อย (Balance Sheet Split)</h3>
        
        <div className="space-y-4 font-semibold text-sm">
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 flex justify-between items-center border border-zinc-150 dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-400">สินทรัพย์รวมทั้งหมด</span>
            <span className="text-zinc-900 dark:text-white font-extrabold">฿{(data.networth + 400000).toLocaleString()}</span>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-850 flex justify-between items-center border border-zinc-150 dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-400">หนี้สินรวมทั้งหมด</span>
            <span className="text-zinc-900 dark:text-white font-extrabold">฿400,000</span>
          </div>

          <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex justify-between items-center border border-emerald-500/20 shadow-sm">
            <span>ความมั่งคั่งสุทธิ</span>
            <span className="text-lg font-extrabold">฿{data.networth.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Historical Log Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm md:col-span-2 xl:col-span-3">
        <h3 className="font-extrabold text-sm text-zinc-400 uppercase tracking-wider mb-6">ประวัติยอดสินทรัพย์สุทธิรายเดือน</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr class="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs uppercase font-extrabold">
                <th class="py-3">เดือน/ปี</th>
                <th class="py-3">สินทรัพย์</th>
                <th class="py-3 text-right">หนี้สิน</th>
                <th class="py-3 text-right">ความมั่งคั่งสุทธิ</th>
                <th class="py-3 text-right">การเปลี่ยนแปลง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
              <tr>
                <td className="py-4 font-bold text-zinc-900 dark:text-white">มิถุนายน 2569</td>
                <td className="py-4">฿{(data.networth + 400000).toLocaleString()}</td>
                <td className="py-4 text-right">฿400,000</td>
                <td className="py-4 text-right font-extrabold text-emerald-500">฿{data.networth.toLocaleString()}</td>
                <td className="py-4 text-right text-emerald-500 font-bold">+฿75,000</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
