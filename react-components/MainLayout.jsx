import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

/**
 * MainLayout Component
 * 
 * โครงสร้างเลย์เอาต์หลักของระบบ รองรับ Sidebar และ Header ดีไซน์ใหม่
 * และแสดงผลเนื้อหารองรับ Routing ภายในของระบบคุณ ({children} หรือ <Outlet />)
 */
export default function MainLayout({ 
  children, 
  tab, 
  setTab, 
  profile, 
  setProfile, 
  theme, 
  toggleTheme, 
  networth 
}) {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 min-h-screen font-sans flex">
      
      {/* 1. Sidebar เมนูด้านซ้าย (Desktop) */}
      <Sidebar 
        tab={tab} 
        setTab={setTab} 
        networth={networth} 
      />

      {/* 2. Main Content Area ด้านขวา */}
      <div className="flex-1 md:ml-80 min-h-screen flex flex-col transition-all duration-300">
        
        {/* Header ส่วนหัวด้านบน (สลับโปรไฟล์/ธีม) */}
        <div className="p-4 md:p-8 pb-0">
          <Header 
            tab={tab} 
            profile={profile} 
            setProfile={setProfile} 
            theme={theme} 
            toggleTheme={toggleTheme} 
          />
        </div>

        {/* 3. Dynamic Page Canvas (สำหรับแสดงหน้าอื่นๆ ใน Routing ของคุณ) */}
        <div className="flex-1 p-4 md:p-8 pt-2 pb-24 md:pb-8">
          {children}
        </div>
      </div>

      {/* 4. Mobile Navigation Bottom Bar (แถบนำทางด้านล่างสำหรับหน้าจอมือถือ) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex justify-around p-3 z-30 shadow-lg">
        <button 
          onClick={() => setTab('overview')} 
          className={`flex flex-col items-center justify-center transition-all ${
            tab === 'overview' ? 'text-indigo-650 dark:text-amber-450 font-bold' : 'text-zinc-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"></path></svg>
          <span className="text-[9px] mt-1">ภาพรวม</span>
        </button>
        <button 
          onClick={() => setTab('dca')} 
          className={`flex flex-col items-center justify-center transition-all ${
            tab === 'dca' ? 'text-indigo-650 dark:text-amber-450 font-bold' : 'text-zinc-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span class="text-[9px] mt-1">แผน DCA</span>
        </button>
        <button 
          onClick={() => setTab('tax')} 
          className={`flex flex-col items-center justify-center transition-all ${
            tab === 'tax' ? 'text-indigo-650 dark:text-amber-450 font-bold' : 'text-zinc-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 14l2-2 4 4m5-7a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span class="text-[9px] mt-1">ภาษี</span>
        </button>
        <button 
          onClick={() => setTab('networth')} 
          className={`flex flex-col items-center justify-center transition-all ${
            tab === 'networth' ? 'text-indigo-650 dark:text-amber-450 font-bold' : 'text-zinc-500'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
          <span class="text-[9px] mt-1">สินทรัพย์</span>
        </button>
      </nav>

    </div>
  );
}
