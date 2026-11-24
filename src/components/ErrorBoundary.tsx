import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, LogOut, RefreshCw } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  details: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      details: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let parsedMessage = error.message || 'Something unexpected happened.';
    let details: string | null = null;

    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        parsedMessage = parsed.error;
        details = `Operation: ${parsed.operationType || 'unknown'} · Path: ${parsed.path || 'n/a'}`;
      }
    } catch {
      // Plain error message
    }

    return {
      hasError: true,
      message: parsedMessage,
      details,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App ErrorBoundary caught:', error, errorInfo);
  }

  handleSignOutAndReload = async () => {
    try {
      await signOut(auth);
    } finally {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 text-amber-700 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Unable to load data
              </h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed mb-3">
              {this.state.message}
            </p>
            {this.state.details && (
              <p className="text-xs text-slate-500 font-mono mb-5 break-all">
                {this.state.details}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleSignOutAndReload}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-slate-100 text-slate-800 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                Switch Account
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 min-h-[44px] px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <RefreshCw className="w-4 h-4 shrink-0" />
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
