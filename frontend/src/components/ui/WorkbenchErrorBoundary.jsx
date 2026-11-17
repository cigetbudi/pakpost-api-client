import { Component } from 'react';

/** Last-resort UI for render failures. Never prints request bodies or session data. */
export class WorkbenchErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="pp-app-fallback" role="alert">
      <section className="pp-app-fallback-panel">
        <h1>PakPost couldn't open the workbench</h1>
        <p>The application encountered a rendering error. This error screen does not clear your stored data.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload PakPost</button>
        <small>If the problem continues, check the browser console and report the error without including credentials.</small>
      </section>
    </main>;
  }
}
