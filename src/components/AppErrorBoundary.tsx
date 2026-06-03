import React from 'react'

interface State {
  hasError: boolean
  error?: Error
  info?: React.ErrorInfo
}

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] App crashed:', error, info)
    this.setState({ info })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 24, color: 'white', background: '#0a0a0f',
          minHeight: '100dvh', display: 'flex', flexDirection: 'column',
          gap: 16, alignItems: 'flex-start', justifyContent: 'center',
        }}>
          <h1 style={{ color: '#f87171', fontSize: 24, margin: 0 }}>App crashed</h1>
          <pre style={{
            background: '#1a1a2e', padding: 12, borderRadius: 8,
            color: '#f87171', fontSize: 12, whiteSpace: 'pre-wrap',
            maxWidth: '100%', overflowX: 'auto',
          }}>
            {this.state.error?.message ?? 'Unknown error'}
            {'\n\n'}
            {this.state.error?.stack?.slice(0, 800)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#7c3aed', color: 'white', border: 'none',
              borderRadius: 12, padding: '12px 32px', fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Reload App
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
