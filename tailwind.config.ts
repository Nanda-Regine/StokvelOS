import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // StokvelOS brand palette — deep African earth + gold
        forest: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        earth: {
          50:  '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
        deep: {
          900: '#0a2412',
          800: '#0f3d1e',
          700: '#145228',
          600: '#1a6632',
        },
        cream: {
          50:  '#fffdf5',
          100: '#fef9e8',
          200: '#fdf0c4',
        },
        // Semantic
        brand: '#0f3d1e',
        gold:  '#ca8a04',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body:    ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(15,61,30,0.08), 0 4px 16px rgba(15,61,30,0.06)',
        'card-hover': '0 4px 12px rgba(15,61,30,0.12), 0 12px 32px rgba(15,61,30,0.08)',
        'gold': '0 4px 20px rgba(202,138,4,0.25)',
        'inner-sm': 'inset 0 1px 2px rgba(0,0,0,0.05)',
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease forwards',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'slide-in':   'slideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        'pulse-slow': 'pulse 3s infinite',
        'shimmer':    'shimmer 1.5s infinite',
        'bounce-sm':  'bounceSm 0.6s ease',
        'count-up':   'countUp 0.6s ease forwards',
      },
      keyframes: {
        fadeUp:   { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' }},
        fadeIn:   { '0%': { opacity: '0' }, '100%': { opacity: '1' }},
        slideIn:  { '0%': { opacity: '0', transform: 'translateX(-8px)' }, '100%': { opacity: '1', transform: 'translateX(0)' }},
        shimmer:  { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' }},
        bounceSm: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' }},
        countUp:  { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' }},
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0a2412 0%, #0f3d1e 50%, #145228 100%)',
        'gold-gradient':  'linear-gradient(135deg, #ca8a04 0%, #eab308 100%)',
        'card-gradient':  'linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)',
        'shimmer-gradient': 'linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.5) 50%, transparent 75%)',
        'hero-mesh':      'radial-gradient(at 27% 37%, hsla(142,70%,12%,1) 0px, transparent 0%), radial-gradient(at 97% 21%, hsla(45,90%,40%,0.15) 0px, transparent 50%), radial-gradient(at 52% 99%, hsla(142,70%,8%,1) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
}

export default config
