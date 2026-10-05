export default {
  plugins: {
    // Tailwind CSS v4 moved the PostCSS plugin into its own package; the
    // `tailwindcss` package itself is no longer a PostCSS plugin.
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
