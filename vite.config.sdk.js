import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

const SDK_VERSION = 'v1.0.0';

export default defineConfig(({ mode }) => {
  const isStaging = mode === 'sdk-staging';
  const isProd = mode === 'sdk-prod';
  
  if (!isStaging && !isProd) {
    // Default development config (unchanged)
    return {
      server: {
        port: 8080,
        open: true,
      },
    };
  }

  // SDK Build Configuration
  const envFolder = isStaging ? 'staging' : 'prod';
  const outDir = `dist-sdk/${envFolder}/${SDK_VERSION}`;
  
  return {
    root: './',
    publicDir: 'public',
    define: {
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'staging'),
    },
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: isStaging, // Source maps only for staging
      minify: isProd ? 'esbuild' : false, // Full minification only for prod
      target: 'es2020',
      
      rollupOptions: {
        // Build the iframe content (main app)
        input: './iframe.html',
        
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js', 
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
    
    plugins: [
      // Custom plugin to copy and process the SDK wrapper
      {
        name: 'copy-sdk-wrapper',
        writeBundle() {
          // Copy the SDK wrapper file
          try {
            mkdirSync(`${outDir}`, { recursive: true });
            copyFileSync('sdk/VideoPreviewSDK.js', `${outDir}/video-preview-sdk.js`);
            console.log(`✅ Copied SDK wrapper to ${outDir}/video-preview-sdk.js`);
          } catch (error) {
            console.error('❌ Failed to copy SDK wrapper:', error);
          }
        }
      }
    ],
  };
});