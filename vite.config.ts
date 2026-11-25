import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { llmRoute } from './server/llm';

export default defineConfig({
  plugins: [react(), llmRoute()],
  base: './',
});
