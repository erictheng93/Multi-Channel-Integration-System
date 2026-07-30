export default {
  plugins: {
    // tailwindcss v4 ships its PostCSS plugin as a separate package and does
    // vendor prefixing internally via lightningcss, so autoprefixer is gone.
    '@tailwindcss/postcss': {},
  },
}
