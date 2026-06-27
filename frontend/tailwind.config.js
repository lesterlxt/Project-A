/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          light: "hsl(var(--primary-light))",
          subtle: "hsl(var(--primary-subtle))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          subtle: "hsl(var(--success-subtle))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          subtle: "hsl(var(--warning-subtle))",
        },
        danger: {
          DEFAULT: "hsl(var(--danger))",
          foreground: "hsl(var(--danger-foreground))",
          subtle: "hsl(var(--danger-subtle))",
        },
        gold: {
          DEFAULT: "hsl(var(--accent-gold))",
          foreground: "hsl(var(--accent-gold-foreground))",
          subtle: "hsl(var(--accent-gold-subtle))",
        },
        "market-up": "hsl(var(--market-up))",
        "market-up-subtle": "hsl(var(--market-up-subtle))",
        "market-down": "hsl(var(--market-down))",
        "market-down-subtle": "hsl(var(--market-down-subtle))",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        xs: "0 1px 2px rgba(15, 23, 42, 0.04)",
        sm: "0 1px 3px rgba(15, 23, 42, 0.06)",
        md: "0 4px 12px rgba(15, 23, 42, 0.08)",
        lg: "0 8px 24px rgba(15, 23, 42, 0.10)",
        xl: "0 12px 36px rgba(15, 23, 42, 0.12)",
        glow: "0 0 0 3px hsl(215 70% 28% / 0.12)",
        "card-hover": "0 4px 12px rgba(15, 23, 42, 0.08)",
      },
      fontSize: {
        hero: ["1.75rem", { lineHeight: "2.25rem", fontWeight: "600" }],
        h1: ["1.375rem", { lineHeight: "1.875rem", fontWeight: "600" }],
        h2: ["1.0625rem", { lineHeight: "1.5rem", fontWeight: "600" }],
        h3: ["0.9375rem", { lineHeight: "1.375rem", fontWeight: "500" }],
        body: ["0.875rem", { lineHeight: "1.6" }],
        caption: ["0.8125rem", { lineHeight: "1.5" }],
        micro: ["0.6875rem", { lineHeight: "1.25", fontWeight: "500" }],
        data: ["1.5rem", { lineHeight: "2rem", fontWeight: "600", letterSpacing: "-0.02em" }],
      },
      spacing: {
        "4.5": "1.125rem",
        "18": "4.5rem",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out both",
        "fade-in-up": "fadeInUp 0.4s ease-out both",
        "slide-in-right": "slideInRight 0.3s ease-out both",
        "scale-in": "scaleIn 0.2s ease-out both",
        shimmer: "shimmer 1.5s ease-in-out infinite",
        "pulse-ring": "pulse-ring 1.5s ease-out infinite",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
