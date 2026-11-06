import { NextResponse, type NextRequest } from "next/server";
import { workpegConfig } from "@/lib/workpeg";
import { callbackUrl, oidc, workpegOidc } from "@/lib/workpeg-oidc";

const OIDC_COOKIE = "nx_wp_oidc";

// Starts "Sign in with Workpeg": authorization code flow with PKCE (S256).
export async function GET(request: NextRequest) {
  const cfg = workpegConfig();
  const login = new URL("/login", cfg.appUrl);
  if (!cfg.signInEnabled) {
    login.searchParams.set("error", "workpeg_not_configured");
    return NextResponse.redirect(login);
  }

  let config;
  try {
    config = await workpegOidc();
  } catch (err) {
    console.error("[workpeg] discovery failed", err);
    login.searchParams.set("error", "workpeg_unreachable");
    return NextResponse.redirect(login);
  }

  const verifier = oidc.randomPKCECodeVerifier();
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl(),
    scope: "openid profile email",
    code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
    code_challenge_method: "S256",
    state,
    nonce,
  });

  const next = request.nextUrl.searchParams.get("next") ?? "";
  const response = NextResponse.redirect(url);
  response.cookies.set(OIDC_COOKIE, JSON.stringify({ verifier, state, nonce, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth/workpeg",
    maxAge: 600,
  });
  return response;
}
