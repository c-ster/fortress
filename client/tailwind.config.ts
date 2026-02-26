import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fortress: {
          green: '#22c55e',
          yellow: '#eab308',
          red: '#ef4444',
          navy: '#1e3a5f',
          slate: '#334155',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
