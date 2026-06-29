import React from 'react';

/**
 * Header Component
 * 
 * ส่วนหัวหลักและแถบสลับโปรไฟล์/ธีม
 */
export default function Header({ tab, profile, setProfile, theme, toggleTheme }) {
  const titles = {
    overview: ['ภาพรวมระบบพอร์ต', 'สรุปสินทรัพย์ สัดส่วนความมั่งคั่ง และแผนการลงทุนทั้งหมด'],
    dca: ['แผนและตารางการ DCA', 'กำหนดเป้าหมายลงทุนเฉลี่ยรายเดือนของคุณ'],
    tax: ['แผนลดหย่อนภาษีส่วนบุคคล', 'วิเคราะห์ฐานภาษีและแนะนำความคุ้มค่าแบบ Real-time'],
    networth: ['ประวัติความมั่งคั่งสุทธิ', 'ตารางเปรียบเทียบและการเติบโตทางรายได้ระยะยาว']
  };

  const [title, subtitle] = titles[tab] || ['', ''];

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-5 border-b border-zinc-200 dark:border-zinc-850 gap-4">
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">{title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{subtitle}</p>
      </div>

      <div className="flex items-center space-x-3 self-end md:self-auto">
        
        {/* Profiles Switcher (Slate/Zinc Premium colors) */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-xl flex space-x-1 shadow-sm">
          {['fern', 'nut', 'household'].map((p) => {
            const labelMap = { fern: 'เฟิร์น', nut: 'นัท', household: 'รวม' };
            const isActive = profile === p;
            return (
              <button
                key={p}
                onClick={() => setProfile(p)}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {labelMap[p]}
              </button>
            );
          })}
        </div>

        {/* Light/Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-all shadow-sm"
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m2.828-9.9a5 5 0 117.07 7.07l-2.828-2.828z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-zinc-750" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
