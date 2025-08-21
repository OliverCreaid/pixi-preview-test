#!/usr/bin/env node

/**
 * Simple test script for the video rendering API
 * Run with: node test-render-api.js
 */

import fs from 'fs';

const API_BASE = 'http://localhost:3002/api';

async function testRenderAPI() {
  console.log('🧪 Testing Video Render API...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${API_BASE}/health`);
    const health = await healthResponse.json();
    console.log('   ✅ Health:', health);

    // Test 2: Load test project data
    console.log('\n2. Loading test project data...');
    const projectResponse = await fetch('http://localhost:8080/test-project.json');
    if (!projectResponse.ok) {
      throw new Error('Cannot load test project. Make sure dev server is running on port 8080');
    }
    const projectData = await projectResponse.json();
    console.log('   ✅ Project loaded:', Object.keys(projectData).join(', '));

    // Test 3: Start render job
    console.log('\n3. Starting render job...');
    const renderResponse = await fetch(`${API_BASE}/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectData })
    });
    
    if (!renderResponse.ok) {
      const error = await renderResponse.text();
      throw new Error(`Render request failed: ${error}`);
    }

    const { jobId } = await renderResponse.json();
    console.log('   ✅ Render started:', jobId);

    // Test 4: Poll status
    console.log('\n4. Monitoring render progress...');
    let status = 'processing';
    let attempts = 0;
    const maxAttempts = 120; // 4 minutes max

    while (status === 'processing' || status === 'queued') {
      if (attempts >= maxAttempts) {
        throw new Error('Render timeout after 4 minutes');
      }

      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      
      const statusResponse = await fetch(`${API_BASE}/render/${jobId}/status`);
      const statusData = await statusResponse.json();
      
      status = statusData.status;
      const progress = statusData.progress || 0;
      
      console.log(`   ⏳ Status: ${status} (${Math.round(progress)}%)`);
      attempts++;
    }

    // Test 5: Check result
    if (status === 'completed') {
      console.log('\n5. ✅ Render completed successfully!');
      console.log(`   📁 Download: ${API_BASE}/render/${jobId}/download`);
      
      // Try to download and save locally
      console.log('\n6. Testing download...');
      const downloadResponse = await fetch(`${API_BASE}/render/${jobId}/download`);
      if (downloadResponse.ok) {
        const buffer = await downloadResponse.arrayBuffer();
        const filename = `test-render-${jobId.substring(0, 8)}.webm`;
        fs.writeFileSync(filename, new Uint8Array(buffer));
        console.log(`   ✅ Video saved as: ${filename} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
      } else {
        console.log('   ❌ Download failed');
      }

    } else if (status === 'failed') {
      console.log('\n5. ❌ Render failed');
      const statusResponse = await fetch(`${API_BASE}/render/${jobId}/status`);
      const statusData = await statusResponse.json();
      console.log('   Error:', statusData.error);
    }

    console.log('\n🎉 API Test Complete!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Make sure both servers are running:');
    console.log('     - npm run dev (port 8080)');
    console.log('     - npm run dev:server (port 3002)');
    console.log('   • Check console logs for errors');
    process.exit(1);
  }
}

// Run the test
testRenderAPI();