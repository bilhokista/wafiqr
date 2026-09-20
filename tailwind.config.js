/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: '#FDFBF7', deep: '#F5F0E6', sunk: '#EDE5D6' },
        ink: { DEFAULT: '#1C1714', soft: '#4A403A', mute: '#8A7C71' },
        spice: { DEFAULT: '#A8451E', deep: '#7A2F13', glow: '#E0793F' },
        sage: { DEFAULT: '#5C6B57', deep: '#3E4A3A' },
        amber: { DEFAULT: '#C98A29' },
      },
      fontFamily: {
        display: ['"Fraunces"', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { squircle: '2rem', core: 'calc(2rem - 0.375rem)' },
      boxShadow: {
        ambient: '0 1px 2px rgba(28,23,20,0.04), 0 12px 32px -12px rgba(28,23,20,0.12)',
        lift: '0 2px 4px rgba(28,23,20,0.05), 0 28px 60px -20px rgba(28,23,20,0.22)',
        core: 'inset 0 1px 1px rgba(255,255,255,0.7)',
      },
      transitionTimingFunction: { fluid: 'cubic-bezier(0.32,0.72,0,1)' },
    },
  },
  plugins: [],
}
