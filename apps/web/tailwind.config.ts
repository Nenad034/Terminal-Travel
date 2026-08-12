import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0f4c81',
          dark: '#0a3660',
          light: '#e8f0f7',
        },
      },
    },
  },
  plugins: [],
};

export default config;
