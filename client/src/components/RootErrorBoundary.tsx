import * as Sentry from '@sentry/browser';
import { ReactNode, Component, ErrorInfo } from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

export class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    try {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    } catch (e) {
      console.warn('Failed to send error to Sentry:', e);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:'24px'}}>
          <h2>Something went wrong</h2>
          <p>If this persists, please refresh. We've logged the error.</p>
        </div>
      );
    }

    return this.props.children;
  }
}