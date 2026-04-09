type RuntimeConfig = {
  VITE_API_URL?: string;
  VITE_AZURE_TENANT_ID?: string;
  VITE_AZURE_CLIENT_ID?: string;
  VITE_AZURE_REDIRECT_URI?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

const fallbackApiUrl = import.meta.env.DEV ? "http://localhost:4000" : "";
const runtimeConfig = window.__APP_CONFIG__ || {};

export const env = {
  apiUrl: runtimeConfig.VITE_API_URL || import.meta.env.VITE_API_URL || fallbackApiUrl,
  azureTenantId: runtimeConfig.VITE_AZURE_TENANT_ID || import.meta.env.VITE_AZURE_TENANT_ID || "",
  azureClientId: runtimeConfig.VITE_AZURE_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID || "",
  azureRedirectUri:
    runtimeConfig.VITE_AZURE_REDIRECT_URI || import.meta.env.VITE_AZURE_REDIRECT_URI || window.location.origin,
};
