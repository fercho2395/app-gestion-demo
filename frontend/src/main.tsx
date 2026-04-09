import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MsalProvider } from "@azure/msal-react";
import "./index.css";
import App from "./App.tsx";
import { msalInstance } from "./auth/msal";

async function bootstrapApp() {
  await msalInstance.initialize();

  try {
    await msalInstance.handleRedirectPromise();
  } finally {
    if (window.location.hash.includes("code=") || window.location.hash.includes("id_token=")) {
      window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
    }
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </StrictMode>,
  );
}

void bootstrapApp();
