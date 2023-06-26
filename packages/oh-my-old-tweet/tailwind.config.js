/** @type {import('tailwindcss').Config} */

const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {},
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      'tw-blue': '#1DA1F2',
      'white': '#ffffff',
      'black': '#000000',
      'gray': colors.gray,
      'blue': colors.blue
    }
  },
  plugins: [],
}

