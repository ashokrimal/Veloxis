import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Veloxis ErrorBoundary:', error, info);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F3F1EC] dark:bg-[#060913] p-6 text-stone-900 dark:text-slate-100">
          <div className="max-w-md w-full rounded-xl bg-white dark:bg-[#0D1322] p-6 vx-card">
            <h2 className="text-base font-bold">Something went wrong</h2>
            <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
              {this.state.message.startsWith('{')
                ? 'A cloud sync permission or configuration issue occurred. Your local speed test telemetry remains safe.'
                : this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#0EA5E9] dark:hover:bg-[#38BDF8] px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 vx-btn-primary cursor-pointer"
            >
              Reload Veloxis
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
