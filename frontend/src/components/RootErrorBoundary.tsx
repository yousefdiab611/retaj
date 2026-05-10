import { Component, type ErrorInfo, type ReactNode } from "react";

type State = { error: Error | null; info: ErrorInfo | null };

/**
 * Top-level safety net. The packaged Electron build hides DevTools by
 * default, so an uncaught render error would otherwise leave a blank
 * window with no diagnostic. This component catches the error, logs it
 * to the console (and to electron-main.log via the renderer console
 * forwarder), and renders an actionable fallback.
 */
export class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info });
    // eslint-disable-next-line no-console
    console.error("[RootErrorBoundary]", error, info?.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div
        dir="ltr"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          background: "#0f172a",
          color: "#f1f5f9",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <div style={{ maxWidth: 720, width: "100%" }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
            Something went wrong while loading the interface.
          </h1>
          <p style={{ opacity: 0.8, marginBottom: 24 }}>
            The app could not finish starting. Press <kbd>F12</kbd> to open the developer console for full
            details, or click reload below.
          </p>
          <pre
            style={{
              background: "#1e293b",
              padding: 16,
              borderRadius: 8,
              overflow: "auto",
              fontSize: 13,
              maxHeight: 220,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.message}
            {info?.componentStack ? `\n\n${info.componentStack}` : ""}
          </pre>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              marginTop: 16,
              background: "#facc15",
              color: "#0f172a",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
