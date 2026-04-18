/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ReactNode } from 'react';
import { 
  Bell, 
  LogIn, 
  LogOut, 
  Moon, 
  DoorOpen, 
  UserPlus, 
  CreditCard, 
  CalendarOff, 
  Plus, 
  LayoutDashboard, 
  BookText, 
  CalendarDays, 
  Bed, 
  Banknote,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'dashboard' | 'bookings' | 'calendar' | 'rooms' | 'payments';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  return (
    <div className="min-h-screen bg-surface flex flex-col font-body">
      {/* Top App Bar */}
      <header className="bg-surface sticky top-0 z-40 px-6 py-4 flex justify-between items-center w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-high border-2 border-primary-container">
            <img 
              alt="Manager Profile" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1gOFz1t-n-Pt4RU3nN-dVxv3rKrPi4S1Zqb2xCNYGLcmFeIDSVwy0MJ2f0MzsLYRL5_onjS_V31qKb4rqZn-MUrm2BP3mFFDtZzsAJ6PlAjnXPGY8vPmIahoWKv0P1y_5YVAvlemdE2TOEysUer68lwrRKlfETrR0UfsMQ_-zjZoMO7Ik9iWmpSRP9wQvgZYvtU4Q9J9Ih6EMgLuEeO3pwxQip92Dd3W2LZku4EudyoxeGR5aNnv4qzAau0wr4ShJZ06jycxjxOaj"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-xl font-bold text-primary font-headline tracking-tight">G&A Pods</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 text-outline hover:bg-surface-container-high transition-colors rounded-full active:scale-95 duration-150">
            <Bell size={24} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 pb-32 pt-4 max-w-5xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Dashboard Header */}
              <section className="mb-10">
                <p className="text-sm font-label uppercase tracking-[0.2em] text-outline mb-1">Overview</p>
                <h2 className="text-4xl font-extrabold font-headline text-on-surface tracking-tight">Dashboard</h2>
              </section>

              {/* Bento Grid Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                <SummaryCard 
                  icon={<LogIn className="text-primary" />} 
                  label="Today's Check-ins" 
                  value="2" 
                  className="bg-surface-container-lowest border border-outline-variant/15"
                />
                <SummaryCard 
                  icon={<LogOut className="text-secondary" />} 
                  label="Today's Check-outs" 
                  value="1" 
                  className="bg-surface-container-low"
                />
                <SummaryCard 
                  icon={<Moon className="text-primary" />} 
                  label="Active Stays" 
                  value="5" 
                  className="bg-primary-container/10"
                  valueClassName="text-primary"
                  labelClassName="text-on-primary-fixed-variant"
                />
                <SummaryCard 
                  icon={<DoorOpen className="text-tertiary" />} 
                  label="Available Rooms" 
                  value="2" 
                  className="bg-tertiary-fixed/30"
                  valueClassName="text-tertiary"
                  labelClassName="text-on-tertiary-fixed-variant"
                />
              </div>

              {/* Recent Activity Section */}
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold font-headline tracking-tight">Recent Activity</h3>
                  <button className="text-primary text-sm font-semibold hover:underline">View All History</button>
                </div>
                <div className="space-y-4">
                  <ActivityItem 
                    icon={<UserPlus size={24} />}
                    iconBg="bg-surface-container-lowest"
                    iconColor="text-primary"
                    badgeText="Inquiry"
                    badgeBg="bg-primary text-white"
                    time="15 mins ago"
                    title={<span>New Inquiry: <span className="text-primary">Juan Dela Cruz</span></span>}
                  />
                  <ActivityItem 
                    icon={<Banknote size={24} />}
                    iconBg="bg-tertiary/10"
                    iconColor="text-tertiary"
                    badgeText="Paid"
                    badgeBg="bg-tertiary text-white"
                    time="2 hours ago"
                    title={<span>Payment Received: <span className="text-primary">Room 202</span></span>}
                  />
                  <ActivityItem 
                    icon={<CalendarOff size={24} />}
                    iconBg="bg-error-container/20"
                    iconColor="text-error"
                    badgeText="Issue"
                    badgeBg="bg-error text-white"
                    time="Yesterday"
                    title={<span>Late Check-out: <span className="text-primary">Room 104</span></span>}
                  />
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center h-full text-outline"
            >
              <p className="text-xl font-headline italic">Coming Soon: {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} view</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FAB */}
      <button className="fixed bottom-28 right-6 w-14 h-14 bg-gradient-to-br from-primary to-primary-container text-white rounded-full shadow-fab flex items-center justify-center active:scale-95 transition-transform z-50">
        <Plus size={32} />
      </button>

      {/* Bottom Nav Bar */}
      <nav className="bg-surface/80 backdrop-blur-xl fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-8 pt-2 rounded-t-3xl shadow-[0_-10px_30px_rgba(26,28,30,0.06)] border-t border-gray-100">
        <NavButton 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          icon={<LayoutDashboard size={20} />} 
          label="Dashboard"
        />
        <NavButton 
          active={activeTab === 'bookings'} 
          onClick={() => setActiveTab('bookings')} 
          icon={<BookText size={20} />} 
          label="Bookings"
        />
        <NavButton 
          active={activeTab === 'calendar'} 
          onClick={() => setActiveTab('calendar')} 
          icon={<CalendarDays size={20} />} 
          label="Calendar"
        />
        <NavButton 
          active={activeTab === 'rooms'} 
          onClick={() => setActiveTab('rooms')} 
          icon={<Bed size={20} />} 
          label="Rooms"
        />
        <NavButton 
          active={activeTab === 'payments'} 
          onClick={() => setActiveTab('payments')} 
          icon={<Banknote size={20} />} 
          label="Payments"
        />
      </nav>
    </div>
  );
}

function SummaryCard({ 
  icon, 
  label, 
  value, 
  className = "", 
  valueClassName = "text-on-surface",
  labelClassName = "text-outline"
}: { 
  icon: ReactNode; 
  label: string; 
  value: string; 
  className?: string;
  valueClassName?: string;
  labelClassName?: string;
}) {
  return (
    <div className={`p-6 rounded-[2rem] flex flex-col justify-between aspect-square md:aspect-auto md:h-48 group hover:scale-[1.02] transition-all duration-300 ${className}`}>
      <div className="p-2 w-fit rounded-full">
        {icon}
      </div>
      <div>
        <p className={`text-[10px] font-label uppercase tracking-widest mb-1 ${labelClassName}`}>{label}</p>
        <p className={`text-5xl font-extrabold font-headline ${valueClassName}`}>{value}</p>
      </div>
    </div>
  );
}

function ActivityItem({ 
  icon, 
  iconBg, 
  iconColor, 
  badgeText, 
  badgeBg, 
  time, 
  title 
}: { 
  icon: ReactNode; 
  iconBg: string; 
  iconColor: string; 
  badgeText: string; 
  badgeBg: string; 
  time: string; 
  title: ReactNode; 
}) {
  return (
    <div className="bg-surface-container-low rounded-2xl p-5 flex items-center gap-4 group transition-all hover:bg-surface-container-high border border-transparent hover:border-outline-variant/30">
      <div className={`w-12 h-12 ${iconBg} ${iconColor} rounded-full flex items-center justify-center shadow-fab`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`${badgeBg} text-[10px] px-2 py-0.5 rounded-full font-label uppercase tracking-tighter`}>
            {badgeText}
          </span>
          <span className="text-xs text-outline font-label">{time}</span>
        </div>
        <p className="text-on-surface font-semibold font-body mt-1">{title}</p>
      </div>
      <div className="hidden md:block">
        <ChevronRight className="text-outline group-hover:text-primary transition-colors" size={20} />
      </div>
    </div>
  );
}

function NavButton({ 
  active, 
  onClick, 
  icon, 
  label 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: ReactNode; 
  label: string; 
}) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center py-2 px-4 transition-all duration-300 rounded-2xl ${
        active 
          ? "bg-gradient-to-br from-primary to-primary-container text-white scale-100" 
          : "text-outline hover:text-primary scale-90"
      }`}
    >
      <div className="mb-1">{icon}</div>
      <span className="font-headline text-[10px] uppercase tracking-wider font-semibold">{label}</span>
    </button>
  );
}
