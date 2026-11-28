import React from 'react';
import {Cloud, Gauge, History, Laptop, LogOut, Moon, Settings, Sliders, Sun} from 'lucide-react';
import {motion} from 'motion/react';
import type {User} from 'firebase/auth';

export type PageAnchor = 'console' | 'diagnostics' | 'benchmark' | 'history';

interface AppNavProps {
  activeAnchor: PageAnchor;
  onSelectAnchor: (anchor: PageAnchor) => void;
  historyCount: number;
  onOpenHistory: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onOpenSettings: () => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
  cloudUser: User | null;
  authLoading?: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onNavigateSound?: () => void;
}

function BrandMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect
        width="32"
        height="32"
        rx="8"
        className="fill-[#1D4ED8] dark:fill-[#0D1322]"
      />
      <path
        d="M7.5 21A9.5 9.5 0 1 1 24.5 21"
        className="stroke-white/30 dark:stroke-[#1E2942]"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M7.5 21A9.5 9.5 0 0 1 22 10.2"
        className="stroke-white dark:stroke-[#38BDF8]"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M16 17.5L22.2 10.6"
        className="stroke-[#BEF264] dark:stroke-[#A3E635]"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="17.5" r="2" className="fill-white dark:fill-[#38BDF8]" />
    </svg>
  );
}

export const AppNav: React.FC<AppNavProps> = ({
  activeAnchor,
  onSelectAnchor,
  historyCount,
  onOpenHistory,
  showAdvanced,
  onToggleAdvanced,
  onOpenSettings,
  isDark = false,
  onToggleTheme,
  cloudUser,
  authLoading = false,
  onSignIn,
  onSignOut,
  onNavigateSound,
}) => {
  const scrollToSection = (anchor: PageAnchor) => {
    onNavigateSound?.();
    onSelectAnchor(anchor);
    if (anchor === 'history') {
      onOpenHistory();
      return;
    }
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
  };

  const navItems: Array<{id: PageAnchor; label: string}> = showAdvanced
    ? [
        {id: 'console', label: 'Speed Test'},
        {id: 'diagnostics', label: 'Diagnostics'},
        {id: 'benchmark', label: 'Network & Plan'},
        {id: 'history', label: `History (${historyCount})`},
      ]
    : [
        {id: 'console', label: 'Speed Test'},
        {id: 'diagnostics', label: 'Readiness'},
        {id: 'history', label: `History (${historyCount})`},
      ];

  return (
    <>
      {/* DESKTOP TOP NAVBAR (md and up) */}
      <header className="hidden md:block sticky top-0 z-30 border-b border-[#DFDAD0] dark:border-[#1E2942] bg-[#FFFDF9]/95 dark:bg-[#060913]/92 backdrop-blur-xs shadow-[inset_0_1px_0_0_var(--vx-top-highlight)] transition-colors duration-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('console');
            }}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-stone-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8] dark:focus-visible:outline-[#38BDF8]"
          >
            <BrandMark />
            <span>Veloxis</span>
          </a>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav
            aria-label="Desktop navigation"
            className="flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const active = activeAnchor === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1D4ED8] dark:focus-visible:outline-[#38BDF8] ${
                    active
                      ? 'text-stone-900 dark:text-slate-50 font-semibold'
                      : 'text-stone-500 dark:text-slate-400 hover:text-stone-900 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="desktop-nav-underline"
                      transition={{type: 'spring', stiffness: 440, damping: 34}}
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[14px] h-0.5 bg-[#1D4ED8] dark:bg-[#38BDF8]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Quiet utility toggles + Settings */}
          <div className="flex items-center gap-2 shrink-0">
            {onToggleTheme && (
              <button
                type="button"
                onClick={() => {
                  onNavigateSound?.();
                  onToggleTheme();
                }}
                aria-label={isDark ? 'Switch to Daylight palette' : 'Switch to Obsidian Dark palette'}
                title={isDark ? 'Switch to Daylight palette' : 'Switch to Obsidian Dark palette'}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 dark:text-[#38BDF8] hover:bg-[#EAE6DD]/70 dark:hover:bg-[#131C31] transition-colors cursor-pointer shrink-0"
              >
                {isDark ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            )}

            {!authLoading &&
              (cloudUser ? (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/35 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                  <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="max-w-[110px] truncate">
                    {cloudUser.displayName?.split(' ')[0] || 'Synced'}
                  </span>
                  <button
                    type="button"
                    onClick={onSignOut}
                    title="Sign out of Cloud Sync"
                    aria-label="Sign out of Cloud Sync"
                    className="ml-1 rounded p-0.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 cursor-pointer"
                  >
                    <LogOut className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-600 dark:text-slate-300 hover:bg-[#EAE6DD]/70 dark:hover:bg-[#131C31] hover:text-stone-900 dark:hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Cloud className="h-3.5 w-3.5 text-[#1D4ED8] dark:text-[#38BDF8]" aria-hidden="true" />
                  <span>Cloud Sync</span>
                </button>
              ))}

            <button
              type="button"
              onClick={() => {
                onNavigateSound?.();
                onOpenSettings();
              }}
              aria-label="Open settings and advanced options"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#0D1322] px-3 py-1.5 text-xs font-semibold text-stone-900 dark:text-slate-100 hover:bg-[#F8F7F4] dark:hover:bg-[#131C31] vx-btn-secondary transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5 text-stone-500 dark:text-slate-400" aria-hidden="true" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE NON-STICKY TOP BRAND STRIP */}
      <div className="flex items-center justify-between gap-3 border-b border-[#DFDAD0] dark:border-[#1E2942] bg-[#FFFDF9] dark:bg-[#090D18] px-4 py-2.5 shadow-[inset_0_1px_0_0_var(--vx-top-highlight)] md:hidden">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('console');
          }}
          className="flex items-center gap-2 text-base font-bold tracking-tight text-stone-900 dark:text-slate-50 whitespace-nowrap"
        >
          <BrandMark />
          <span>Veloxis</span>
        </a>

        <div className="flex items-center gap-1.5">
          {onToggleTheme && (
            <button
              type="button"
              onClick={() => {
                onNavigateSound?.();
                onToggleTheme();
              }}
              aria-label={isDark ? 'Switch to Daylight palette' : 'Switch to Obsidian Dark palette'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-600 dark:text-[#38BDF8] hover:bg-[#EAE6DD]/70 dark:hover:bg-[#131C31] cursor-pointer"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          )}

          {!authLoading &&
            (cloudUser ? (
              <button
                type="button"
                onClick={onSignOut}
                title="Signed in — tap to sign out"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/35 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 whitespace-nowrap cursor-pointer"
              >
                <Cloud className="h-3 w-3" aria-hidden="true" />
                <span>Synced</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-stone-600 dark:text-slate-300 hover:bg-[#EAE6DD]/70 dark:hover:bg-[#131C31] whitespace-nowrap cursor-pointer"
              >
                <Cloud className="h-3 w-3 text-[#1D4ED8] dark:text-[#38BDF8]" aria-hidden="true" />
                <span>Sync</span>
              </button>
            ))}

          <button
            type="button"
            onClick={() => {
              onNavigateSound?.();
              onOpenSettings();
            }}
            aria-label="Open settings"
            className="inline-flex items-center gap-1.5 rounded-lg bg-white dark:bg-[#0D1322] px-3 py-1.5 text-xs font-semibold text-stone-900 dark:text-slate-100 hover:bg-[#F8F7F4] dark:hover:bg-[#131C31] vx-btn-secondary whitespace-nowrap cursor-pointer"
          >
            <Settings className="h-3.5 w-3.5 text-stone-500 dark:text-slate-400" aria-hidden="true" />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* MOBILE FIXED BOTTOM NAVBAR (No Install Button) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-[#DFDAD0] dark:border-[#1E2942] bg-[#FFFDF9]/95 dark:bg-[#090D18]/95 backdrop-blur-md shadow-[inset_0_1px_0_0_var(--vx-top-highlight)] md:hidden pb-[env(safe-area-inset-bottom)] transition-colors duration-200"
      >
        <div
          className={`grid h-14 items-center ${showAdvanced ? 'grid-cols-4' : 'grid-cols-3'}`}
        >
          <button
            type="button"
            onClick={() => scrollToSection('console')}
            className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              activeAnchor === 'console'
                ? 'text-[#1D4ED8] dark:text-[#38BDF8] font-semibold'
                : 'text-stone-500 dark:text-slate-400'
            }`}
          >
            <Gauge className="h-5 w-5" aria-hidden="true" />
            <span>Speed</span>
          </button>

          {showAdvanced && (
            <button
              type="button"
              onClick={() => scrollToSection('benchmark')}
              className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                activeAnchor === 'benchmark'
                  ? 'text-[#1D4ED8] dark:text-[#38BDF8] font-semibold'
                  : 'text-stone-500 dark:text-slate-400'
              }`}
            >
              <Laptop className="h-5 w-5" aria-hidden="true" />
              <span>Network</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => scrollToSection('history')}
            className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              activeAnchor === 'history'
                ? 'text-[#1D4ED8] dark:text-[#38BDF8] font-semibold'
                : 'text-stone-500 dark:text-slate-400'
            }`}
          >
            <History className="h-5 w-5" aria-hidden="true" />
            <span>History ({historyCount})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavigateSound?.();
              onToggleAdvanced();
            }}
            className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              showAdvanced
                ? 'text-[#1D4ED8] dark:text-[#38BDF8] font-semibold'
                : 'text-stone-500 dark:text-slate-400'
            }`}
          >
            <Sliders className="h-5 w-5" aria-hidden="true" />
            <span>{showAdvanced ? 'Simple' : 'Advanced'}</span>
          </button>
        </div>
      </nav>
    </>
  );
};
