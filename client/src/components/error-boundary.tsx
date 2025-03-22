
import React from 'react';
import { Card } from './ui/card';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-4 m-4 bg-destructive/10">
          <h2>Something went wrong.</h2>
          <pre className="text-sm">{this.state.error?.message}</pre>
        </Card>
      );
    }
    return this.props.children;
  }
}
