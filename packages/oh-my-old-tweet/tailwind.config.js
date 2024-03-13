/** @type {import('tailwindcss').Config} */

const colors = require('tailwindcss/colors')

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
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
  // what the fuck? if remove it, tailwind css will not working
  // try to figure out why
  // TODO: migrate all tailwind css to mui in next version
  safelist: [
    'tw-blue',
  ]
}

