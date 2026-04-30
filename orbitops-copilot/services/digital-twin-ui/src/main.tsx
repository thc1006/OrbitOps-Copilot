// Sprint 0 placeholder. Real shell + CopilotPanel land in Sprint 1 (S1-06).
// SPEC-004 — services/../../docs/specs/SPEC-004-digital-twin-ui.md
import React from "react";
import ReactDOM from "react-dom/client";

const App: React.FC = () => (
  <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
    <h1>OrbitOps Copilot</h1>
    <p>Sprint 0 skeleton. UI shell, satellite-pass viz, and Copilot panel land in Sprint 1.</p>
    <p>
      See{" "}
      <a href="https://orbitops.local/docs/specs/SPEC-004-digital-twin-ui.md">
        SPEC-004
      </a>
      .
    </p>
  </main>
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
