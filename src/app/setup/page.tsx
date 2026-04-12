"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/brand";

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }

      router.push("/login");
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
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
                {brand.setupSubtitle}
              </p>
            </div>

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
                <label htmlFor="name" className="block text-[13px] font-medium text-[#c9d1d9] mb-1.5">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] rounded-lg text-[14px] focus:outline-none focus:border-[#007acc] focus:ring-2 focus:ring-[#007acc]/20 placeholder:text-[#484f58] transition-all"
                  placeholder="Admin User"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-[13px] font-medium text-[#c9d1d9] mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] rounded-lg text-[14px] focus:outline-none focus:border-[#007acc] focus:ring-2 focus:ring-[#007acc]/20 placeholder:text-[#484f58] transition-all"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-[13px] font-medium text-[#c9d1d9] mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2.5 border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] rounded-lg text-[14px] focus:outline-none focus:border-[#007acc] focus:ring-2 focus:ring-[#007acc]/20 placeholder:text-[#484f58] transition-all"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-[13px] font-medium text-[#c9d1d9] mb-1.5">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] rounded-lg text-[14px] focus:outline-none focus:border-[#007acc] focus:ring-2 focus:ring-[#007acc]/20 placeholder:text-[#484f58] transition-all"
                  placeholder="Repeat password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#007acc] text-white py-2.5 px-4 rounded-lg text-[14px] font-medium hover:bg-[#0587de] focus:outline-none focus:ring-2 focus:ring-[#007acc]/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  "Create Admin Account"
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
