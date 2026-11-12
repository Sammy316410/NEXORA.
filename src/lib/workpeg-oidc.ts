import "server-only";
import * as oidc from "openid-client";
import { workpegConfig } from "./workpeg";

// Sign in with Workpeg = standard OpenID Connect (authorization code + PKCE S256).
// Discovery: https://api.workpeg.com/.well-known/openid-configuration
// Note: Workpeg issues no refresh tokens. NEXORA only uses the ID token once, to
// identify the person, and then runs its own Supabase Auth session.

let configPromise: Promise<oidc.Configuration> | null = null;

export function workpegOidc(): Promise<oidc.Configuration> {
  const cfg = workpegConfig();
  if (!cfg.clientId) return Promise.reject(new Error("WORKPEG_CLIENT_ID is not set"));
  if (!configPromise) {
    configPromise = oidc
      .discovery(new URL(cfg.issuer), cfg.clientId, cfg.clientSecret ?? undefined)
      .catch((err) => {
        configPromise = null; // retry discovery next time
        throw err;
      });
  }
  return configPromise;
}

export function callbackUrl(): string {
  return `${workpegConfig().appUrl}/auth/workpeg/callback`;
}

export { oidc };
