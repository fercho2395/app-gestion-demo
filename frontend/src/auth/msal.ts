import { PublicClientApplication, type Configuration } from "@azure/msal-browser";
import { env } from "../config/env";

const msalConfig: Configuration = {
  auth: {
    clientId: env.azureClientId,
    authority: `https://login.microsoftonline.com/${env.azureTenantId || "common"}`,
    redirectUri: env.azureRedirectUri,
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

export const apiTokenRequest = {
  scopes: [env.azureApiScope || "User.Read"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
