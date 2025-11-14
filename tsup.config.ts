import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: !!options.watch,
  clean: true,
  minify: !options.watch,
  external: ["zod", "next"],
}));
