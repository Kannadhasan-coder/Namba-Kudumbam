/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#170F22',
        surface: '#241A33',
        surface2: '#2F2242',
        surface3: '#3A2A50',
        violet: {
          DEFAULT: '#8B5CF6',
          light: '#A78BFA',
          dark: '#6D28D9',
        },
        fox: {
          DEFAULT: '#F3993C',
          light: '#FBBF6E',
          dark: '#D97B1F',
        },
        ink: '#F3EEFF',
        muted: '#B3A3D1',
        line: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        display: ['"Fredoka"', 'sans-serif'],
        body: ['"Manrope"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px -8px rgba(139, 92, 246, 0.45)',
        foxglow: '0 0 30px -6px rgba(243, 153, 60, 0.5)',
        card: '0 20px 60px -20px rgba(0,0,0,0.6)',
      },
      keyframes: {
        drift: {
          '0%, 100%': { transform: 'translate(0,0)' },
          '50%': { transform: 'translate(20px,-16px)' },
        },
        tailcurl: {
          '0%': { transform: 'rotate(0deg)' },
          '30%': { transform: 'rotate(-10deg)' },
          '60%': { transform: 'rotate(6deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.035)' },
        },
        earwiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(-4deg)' },
        },
      },
      animation: {
        drift: 'drift 9s ease-in-out infinite',
        tailcurl: 'tailcurl 1.4s ease-in-out',
        breathe: 'breathe 4.5s ease-in-out infinite',
        earwiggle: 'earwiggle 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
