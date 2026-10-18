export default {
  optimizeDeps: { exclude: ['maplibre-gl'] },
  build: { target: 'esnext', rollupOptions: { external: ['maplibre-gl'], output: { paths: { 'maplibre-gl': './maplibre-gl.mjs' } } } },
};
