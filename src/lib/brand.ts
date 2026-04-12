/**
 * Centralized branding configuration.
 * Change these values to rebrand the entire application.
 */

export const brand = {
  /** Application name shown in headers, titles, and meta tags */
  name: "Codera",

  /** Tagline shown on the login page */
  tagline: "Sign in to your account",

  /** Description for SEO / meta tags */
  description: "AI-powered code assistant for your repositories",

  /** Setup page subtitle */
  setupSubtitle: "Create your administrator account to get started.",

  /** Chat landing page */
  chatHeading: "Codera Chat",
  chatDescription:
    "Ask questions about your codebase. The AI can cross-reference files across your indexed repositories.",

  /** Path to logo file in /public (SVG recommended, PNG fallback) */
  logo: "/logo.svg",

  /** Logo dimensions (used for next/image width/height) */
  logoWidth: 384,
  logoHeight: 216,
} as const;
