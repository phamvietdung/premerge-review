const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/webview/App.tsx'],
  bundle: true,
  outfile: 'media/main.js',
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  minify: true,
}).catch(() => process.exit(1));
