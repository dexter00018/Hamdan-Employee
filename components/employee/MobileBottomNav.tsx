'use client';

import { useState } from 'react';
import {
  Home,
  Clock,
  Plane,
  Bell,
  UserRound,
} from 'lucide-react';

type MobileTab =
  | 'home'
  | 'attendance'
  | 'leave'
  | 'actions'
  | 'profile';

type MobileBottomNavProps = {
  actionCount?: number;
  onHome: () => void;
  onAttendance: () => void;
  onLeave: () => void;
  onActionCenter: () => void;
  onProfile: () => void;
};

export default function MobileBottomNav({
  actionCount = 0,
  onHome,
  onAttendance,
  onLeave,
  onActionCenter,
  onProfile,
}: MobileBottomNavProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>('home');

  const handleClick = (
    tab: MobileTab,
    action: () => void
  ) => {
    setActiveTab(tab);
    action();
  };

  const navItems = [
    {
      key: 'home' as MobileTab,
      label: 'Home',
      icon: Home,
      action: onHome,
    },
    {
      key: 'attendance' as MobileTab,
      label: 'Attendance',
      icon: Clock,
      action: onAttendance,
    },
    {
      key: 'leave' as MobileTab,
      label: 'Leave',
      icon: Plane,
      action: onLeave,
    },
    {
      key: 'actions' as MobileTab,
      label: 'Action Center',
      icon: Bell,
      action: onActionCenter,
      badge: actionCount,
    },
    {
      key: 'profile' as MobileTab,
      label: 'Profile',
      icon: UserRound,
      action: onProfile,
    },
  ];

  return (
    <nav
      aria-label="Employee mobile navigation"
      className="
        fixed inset-x-0 bottom-0 z-[45]
        lg:hidden
        border-t border-slate-200/80
        bg-white/95 dark:bg-[#292f2b]/95
        backdrop-blur-xl
        shadow-[0_-8px_30px_rgba(15,23,42,0.08)]
      "
    >
      <div
        className="
          mx-auto
          flex
          max-w-lg
          items-start
          justify-between
          px-2
          pt-2
        "
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          const badge = item.badge ?? 0;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleClick(item.key, item.action)}
              className={`
                relative
                flex
                min-w-0
                flex-1
                flex-col
                items-center
                justify-center
                gap-1
                rounded-2xl
                px-1
                min-h-11
                py-1
                transition-all
                duration-200
                ${
                  isActive
                    ? 'text-[#15803d] dark:text-[#5ee28b]'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-100'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              <span
                className={`
                  relative
                  grid
                  h-9
                  w-9
                  place-items-center
                  rounded-2xl
                  transition-all
                  duration-200
                  ${
                    isActive
                      ? 'bg-green-50 text-[#15803d] dark:bg-[#263b2f] dark:text-[#5ee28b]'
                      : 'bg-transparent'
                  }
                `}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                />

                {item.key === 'actions' && badge > 0 && (
                  <span
                    className="
                      absolute
                      -right-1
                      -top-1
                      flex
                      h-4
                      min-w-4
                      items-center
                      justify-center
                      rounded-full
                      bg-red-500
                      px-1
                      text-[9px]
                      font-extrabold
                      leading-none
                      text-white
                      shadow-sm
                    "
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>

              <span
                className={`
                  max-w-full
                  truncate
                  text-[10px]
                  leading-tight
                  ${
                    isActive
                      ? 'font-extrabold'
                      : 'font-semibold'
                  }
                `}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
