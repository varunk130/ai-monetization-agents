import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { llmRoute } from './server/llm.ts';

export default defineConfig({
  plugins: [react(), llmRoute()],
  base: './',
});
