import * as Sentry from '@sentry/react';

export const RootErrorBoundary = Sentry.withErrorBoundary(
  ({ children }: { children: React.ReactNode }) => <>{children}</>,
  {
    fallback: (
      <div style={{padding:'24px'}}>
        <h2>Something went wrong</h2>
        <p>If this persists, please refresh. We've logged the error.</p>
      </div>
    ),
  }
);