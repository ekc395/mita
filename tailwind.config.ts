import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // Bound to the custom properties in app/globals.css, which flip under
  // prefers-color-scheme -- which is why `border-border` needs no `dark:` twin.
  theme: {
    extend: {
      // <alpha-value> is required for opacity modifiers: without it `bg-primary/50`
      // silently renders fully opaque, with no build error to say why.
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        accent: 'hsl(var(--accent) / <alpha-value>)',
        muted: 'hsl(var(--muted) / <alpha-value>)',
        'muted-foreground': 'hsl(var(--muted-foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        primary: 'hsl(var(--primary) / <alpha-value>)',
        'primary-foreground': 'hsl(var(--primary-foreground) / <alpha-value>)',
      },
    },
  },
  plugins: [],
} satisfies Config;
