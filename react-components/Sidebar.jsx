import React from 'react';

/**
 * Sidebar Component
 * 
 * เมนูควบคุมและนำทางด้านซ้ายบน Desktop
 */
export default function Sidebar({ tab, setTab, networth }) {
  const menus = [
    { id: 'overview', label: 'ภาพรวม (Overview)', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z' },
    { id: 'dca', label: 'แผน DCA', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'tax', label: 'ลดหย่อนภาษี', icon: 'M9 14l2-2 4 4m5-7a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'networth', label: 'มูลค่าสุทธิ (Net Worth)', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' }
  ];

  return (
    <aside className="w-80 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-850 fixed h-full top-0 left-0 z-30 hidden md:flex flex-col p-6 transition-all duration-300">
      
      {/* Brand logo */}
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-zinc-900 to-zinc-700 dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center text-white dark:text-zinc-950 font-extrabold text-xl shadow-lg">
          W
        </div>
        <div>
          <h1 className="font-extrabold text-lg tracking-tight text-zinc-900 dark:text-white">Wealth Ledger</h1>
          <span className="text-[10px] text-indigo-600 dark:text-amber-400 font-extrabold uppercase tracking-widest">Premium Edition</span>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="space-y-1.5 flex-1">
        {menus.map((m) => {
          const isActive = tab === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setTab(m.id)}
              className={`w-full flex items-center space-x-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all border-l-4 ${
                isActive
                  ? 'border-indigo-600 bg-zinc-100 text-zinc-900 dark:bg-zinc-850 dark:text-amber-400 dark:border-amber-400 font-bold'
                  : 'border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-white'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={m.icon} />
              </svg>
              <span>{m.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Net Worth Summary Widget */}
      <div className="mt-auto p-5 rounded-2xl bg-zinc-900 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 text-white shadow-lg">
        <span className="text-xs text-zinc-450 font-medium">มูลค่าพอร์ตสุทธิรวม</span>
        <div className="text-2xl font-extrabold tracking-tight mt-1 text-emerald-450">
          ฿{networth.toLocaleString()}
        </div>
        <div className="text-[10px] text-emerald-400 font-bold mt-1.5 flex items-center bg-emerald-500/10 w-fit px-2 py-0.5 rounded-md">
          +4.2% ในเดือนนี้
        </div>
      </div>
    </aside>
  );
}
