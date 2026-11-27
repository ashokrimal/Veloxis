import React from 'react';
import {Download, Gauge, History, Laptop} from 'lucide-react';

export type PageAnchor = 'console' | 'diagnostics' | 'benchmark' | 'history';

interface AppNavProps {
  activeAnchor: PageAnchor;
  onSelectAnchor: (anchor: PageAnchor) => void;
  historyCount: number;
  onOpenHistory: () => void;
  onOpenDistribution: () => void;
  isInstalled: boolean;
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
        className="fill-slate-900 dark:fill-slate-800"
      />
      <path
        d="M7.5 21A9.5 9.5 0 1 1 24.5 21"
        stroke="#334155"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M7.5 21A9.5 9.5 0 0 1 22 10.2"
        stroke="#3B82F6"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M16 17.5L22.2 10.6"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="16" cy="17.5" r="2" fill="#38BDF8" />
    </svg>
  );
}

export const AppNav: React.FC<AppNavProps> = ({
  activeAnchor,
  onSelectAnchor,
  historyCount,
  onOpenHistory,
  onOpenDistribution,
  isInstalled,
}) => {
  const scrollToSection = (anchor: PageAnchor) => {
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

  return (
    <>
      {/* DESKTOP TOP NAVBAR (md and up) — Strict 3-Zone Top Bar */}
      <header className="hidden md:block sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B1120]/90 backdrop-blur-xs transition-colors duration-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single-line Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('console');
            }}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400"
          >
            <BrandMark />
            <span>Veloxis</span>
          </a>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav
            aria-label="Desktop navigation"
            className="flex items-center gap-7 text-sm font-medium"
          >
            <button
              type="button"
              onClick={() => scrollToSection('console')}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 ${
                activeAnchor === 'console'
                  ? 'text-slate-900 dark:text-slate-50 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Speed Test
              {activeAnchor === 'console' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-600 dark:bg-blue-400"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('diagnostics')}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 ${
                activeAnchor === 'diagnostics'
                  ? 'text-slate-900 dark:text-slate-50 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Diagnostics
              {activeAnchor === 'diagnostics' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-600 dark:bg-blue-400"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('benchmark')}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 ${
                activeAnchor === 'benchmark'
                  ? 'text-slate-900 dark:text-slate-50 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Devices &amp; Plan
              {activeAnchor === 'benchmark' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-600 dark:bg-blue-400"
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('history')}
              className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400 ${
                activeAnchor === 'history'
                  ? 'text-slate-900 dark:text-slate-50 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              History ({historyCount})
              {activeAnchor === 'history' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-600 dark:bg-blue-400"
                />
              )}
            </button>
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={onOpenDistribution}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:focus-visible:outline-blue-400"
            >
              <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              <span>{isInstalled ? 'Chrome Extension' : 'App & Extension'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE NON-STICKY TOP BRAND STRIP (leaves vertical space clean) */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1424] px-4 py-2.5 md:hidden">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('console');
          }}
          className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap"
        >
          <BrandMark />
          <span>Veloxis</span>
        </a>

        <button
          type="button"
          onClick={onOpenDistribution}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap cursor-pointer"
        >
          <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <span>{isInstalled ? 'Extension' : 'Install'}</span>
        </button>
      </div>

      {/* MOBILE FIXED BOTTOM NAVBAR (Thumb-Zone Navigation Anchor) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0D1424]/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)] transition-colors duration-200"
      >
        <div className="grid h-14 grid-cols-4 items-center">
          <button
            type="button"
            onClick={() => scrollToSection('console')}
            className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              activeAnchor === 'console'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Gauge className="h-5 w-5" aria-hidden="true" />
            <span>Speed</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('benchmark')}
            className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              activeAnchor === 'benchmark'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Laptop className="h-5 w-5" aria-hidden="true" />
            <span>Devices</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('history')}
            className={`flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
              activeAnchor === 'history'
                ? 'text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <History className="h-5 w-5" aria-hidden="true" />
            <span>History ({historyCount})</span>
          </button>

          <button
            type="button"
            onClick={onOpenDistribution}
            className="flex h-full min-h-[44px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            <span>App</span>
          </button>
        </div>
      </nav>
    </>
  );
};
