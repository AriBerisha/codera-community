"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { brand } from "@/lib/brand";

export function LoginForm({ ssoEnabled }: { ssoEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  const ssoError = searchParams.get("error");
  const ssoErrorMessage =
    ssoError === "AccessDenied"
      ? "This Google account is not part of the allowed workspace domain."
      : ssoError
        ? "Sign-in failed. Please try again."
        : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      router.push("/chat");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setSsoLoading(true);
    await signIn("google", { callbackUrl: "/chat" });
  }

  return (
    <>
      {/* Animated grid background */}
      <div className="grid-bg">
        <div className="grid-orb grid-orb-1" />
        <div className="grid-orb grid-orb-2" />
        <div className="grid-bg-scanline" />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-[#30363d] bg-[#0d1117]/80 backdrop-blur-xl p-8 glow-ring">
            <div className="text-center mb-8">
              <img src={brand.logo} alt={brand.name} className="h-12 mx-auto mb-5 object-contain" />
              <p className="text-[13px] text-[#7d8590]">
                {brand.tagline}
              </p>
            </div>

            {ssoErrorMessage && (
              <div className="mb-4 flex items-center gap-2 bg-[#f85149]/10 border border-[#f85149]/20 text-[#f85149] p-3 rounded-lg text-[13px]">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                {ssoErrorMessage}
              </div>
            )}

            {ssoEnabled && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={ssoLoading || loading}
                  className="w-full flex items-center justify-center gap-2 border border-[#30363d] bg-[#0d1117] hover:bg-[#161b22] text-[#c9d1d9] py-2.5 px-4 rounded-lg text-[14px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {ssoLoading ? "Redirecting to Google..." : "Sign in with Google"}
                </button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#30363d]" />
                  </div>
                  <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
                    <span className="bg-[#0d1117] px-2 text-[#7d8590]">or</span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 bg-[#f85149]/10 border border-[#f85149]/20 text-[#f85149] p-3 rounded-lg text-[13px]">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-[13px] font-medium text-[#c9d1d9] mb-1.5"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] rounded-lg text-[14px] focus:outline-none focus:border-[#007acc] focus:ring-2 focus:ring-[#007acc]/20 placeholder:text-[#484f58] transition-all"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-[13px] font-medium text-[#c9d1d9] mb-1.5"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] rounded-lg text-[14px] focus:outline-none focus:border-[#007acc] focus:ring-2 focus:ring-[#007acc]/20 placeholder:text-[#484f58] transition-all"
                  placeholder="Your password"
                />
              </div>

              <button
                type="submit"
                disabled={loading || ssoLoading}
                className="w-full bg-[#007acc] text-white py-2.5 px-4 rounded-lg text-[14px] font-medium hover:bg-[#0587de] focus:outline-none focus:ring-2 focus:ring-[#007acc]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-[#484f58] mt-6">
            {brand.description}
          </p>
        </div>
      </div>
    </>
  );
}
