/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        lora: ['Lora', 'serif'],
        merriweather: ['Merriweather', 'serif'],
        handwritten: ['Caveat', 'cursive'],
        kalam: ['Kalam', 'cursive'],
        patrick: ['Patrick Hand', 'cursive'],
        roboto: ['Roboto', 'sans-serif'],
        opensans: ['Open Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
