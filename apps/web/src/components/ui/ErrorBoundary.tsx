import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
  IconRefresh,
} from '@tabler/icons-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  showDetails: boolean;
}

// ─── Default Fallback UI ─────────────────────────────────────────────────────

interface DefaultFallbackProps {
  error: Error;
  onReset: () => void;
}

function DetailsWithToggle({ error, onReset }: DefaultFallbackProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 bg-[#f0f9ff]">
      {/* Error illustration container */}
      <div className="flex flex-col items-center max-w-md w-full">
        {/* Alert icon */}
        <div className="w-20 h-20 rounded-full bg-sky-100 flex items-center justify-center mb-6">
          <IconAlertCircle className="w-10 h-10 text-sky-600" />
        </div>

        {/* Message */}
        <h2 className="text-2xl font-bold text-sky-900 mb-2 text-center">Algo salió mal</h2>
        <p className="text-sky-700 text-center mb-6">
          Ha ocurrido un error inesperado. No te preocupes, puedes intentar de nuevo.
        </p>

        {/* Action button */}
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-sky-400 text-white font-bold rounded-2xl border-2 border-sky-600 shadow-gummy shadow-sky-fun-dark hover:bg-sky-300 hover:shadow-gummy-hover hover:-translate-y-0.5 active:translate-y-1 active:shadow-gummy-active transition-all duration-150 cursor-pointer"
        >
          <IconRefresh className="w-5 h-5" />
          Intentar de nuevo
        </button>

        {/* Collapsible error details */}
        <div className="mt-6 w-full">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-sky-600 hover:text-sky-800 transition-colors mx-auto"
          >
            {showDetails ? (
              <IconChevronDown className="w-4 h-4" />
            ) : (
              <IconChevronRight className="w-4 h-4" />
            )}
            {showDetails ? 'Ocultar detalles' : 'Ver detalles del error'}
          </button>

          {showDetails ? (
            <div className="mt-3 p-4 bg-white rounded-xl border-2 border-sky-200 overflow-hidden">
              <p className="text-sm font-mono text-red-600 break-all whitespace-pre-wrap">
                {error.message}
              </p>
              {error.stack ? (
                <pre className="mt-2 text-xs text-sky-600 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                  {error.stack}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Error Boundary Class Component ──────────────────────────────────────────

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    return {
      hasError: true,
      error: normalizedError,
      showDetails: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to hypothetical error service
    console.error('[ErrorBoundary] Uncaught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      showDetails: false,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) {
      return children;
    }

    // Custom fallback provided
    if (fallback !== undefined) {
      if (typeof fallback === 'function') {
        return fallback(error, this.handleReset);
      }
      return fallback;
    }

    // Default fallback UI
    return <DetailsWithToggle error={error} onReset={this.handleReset} />;
  }
}
