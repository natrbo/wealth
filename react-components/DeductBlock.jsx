import React from 'react';

/**
 * DeductBlock Component
 * 
 * การ์ดกรอกยอดหักลดหย่อนแบบ Premium Fintech
 * แยกยอดพอร์ตรวมสะสม, ยอดซื้อแล้ว YTD และแผน DCA ในปีภาษี
 */
export default function DeductBlock({ 
  label, 
  color, 
  portVal, 
  value, 
  onChange, 
  onQuickFill, 
  onAddAmount,
  futureMonths,
  monthlyPlan,
  ytdLabel = "ซื้อแล้วปีนี้ (YTD)",
  totalLabel = "รวมลดหย่อนปีนี้"
}) {
  const futureAmt = monthlyPlan * futureMonths;
  const totalD = value + futureAmt;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm relative overflow-hidden transition-all duration-300">
      {/* Indicator line/badge */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></div>
          <span className="text-sm font-extrabold" style={{ color: color }}>{label}</span>
        </div>
        <span className="text-[10px] font-bold bg-zinc-150 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-md">ปีภาษี 2569</span>
      </div>

      <div className="space-y-4">
        {/* Total accumulated portfolio balance */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-550 font-medium">มูลค่าพอร์ตรวมสะสม</span>
          <span className="font-bold text-zinc-700 dark:text-zinc-300">฿{portVal.toLocaleString()}</span>
        </div>

        {/* Interactive YTD input & Premium Quick actions */}
        <div className="flex justify-between items-start flex-col gap-2.5">
          <div className="flex justify-between items-center w-full">
            <span className="text-xs text-zinc-550 font-semibold">{ytdLabel}</span>
            <div className="relative w-36">
              <input 
                type="text" 
                value={value.toLocaleString()} 
                onChange={(e) => {
                  const val = parseInt(e.target.value.replace(/,/g, '')) || 0;
                  onChange(val);
                }}
                className="w-full pl-3 pr-8 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-right outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 dark:text-white"
              />
              <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-[10px] text-zinc-400 font-bold">฿</span>
            </div>
          </div>
          
          {/* Quick Actions Buttons */}
          <div className="flex flex-wrap gap-2 mt-1 w-full justify-end">
            <button 
              type="button"
              onClick={onQuickFill}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border border-indigo-200/50 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              [ซื้อเต็มสิทธิ์]
            </button>
            <button 
              type="button"
              onClick={() => onAddAmount(50000)}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-350 border border-zinc-200 dark:border-zinc-750 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              [+50,000]
            </button>
            <button 
              type="button"
              onClick={() => onAddAmount(100000)}
              className="px-3 py-2 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-855 text-zinc-600 dark:text-zinc-355 border border-zinc-200 dark:border-zinc-750 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              [+100,000]
            </button>
          </div>
        </div>

        {/* DCA projections */}
        <div className="flex justify-between items-center text-xs">
          <span className="text-zinc-550 font-medium">แผน DCA ที่เหลือ</span>
          <span className="font-semibold text-zinc-750 dark:text-zinc-400">
            {futureMonths} เดือน × ฿{monthlyPlan.toLocaleString()} = ฿{futureAmt.toLocaleString()}
          </span>
        </div>

        {/* Sum Deductible */}
        <div className="flex justify-between items-center pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-xs font-extrabold text-zinc-900 dark:text-white">{totalLabel}</span>
          <span className="text-lg font-extrabold text-emerald-500">฿{totalD.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
