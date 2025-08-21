# Video Rendering Test Guide

This guide will walk you through testing the complete server-side video rendering system.

## 🎯 Test Environment Setup

### Prerequisites
- Node.js (v18+ recommended)
- Chrome browser installed (for Puppeteer)
- All dependencies installed: `npm install`

### Required Terminals
You need **2 terminal windows** running simultaneously:

**Terminal 1: Preview Application**
```bash
npm run dev
# Starts Vite dev server on http://localhost:8080
```

**Terminal 2: Render Server**
```bash
npm run dev:server
# Starts Express render server on http://localhost:3002
```

## 🚀 Quick Start Testing

### Automated API Test
For a quick end-to-end API test, run:
```bash
node test-render-api.js
```
This script will automatically test the complete render pipeline and save a test video file.

### Manual UI Test
1. Open http://localhost:8080 in your browser
2. Wait for the preview to load completely
3. Click the "🎬 Export Video" button
4. Watch the console for progress updates
5. Video should download automatically when complete

---

## 🧪 Test Scenarios

### Test 1: Basic UI Integration

1. **Open the preview**: http://localhost:8080
2. **Wait for loading**: Project should load with timeline controls
3. **Locate export button**: Look for "🎬 Export Video" button in timeline
4. **Verify styling**: Button should have gradient background and hover effects

**Expected Result**: Timeline shows play button + progress bar + time display + export button

---

### Test 2: Complete Render Workflow

1. **Start render**: Click "🎬 Export Video" button
2. **Monitor console**: Should show render job creation
3. **Watch progress**: Console logs should show status updates every 2 seconds
4. **Completion**: Browser should automatically open download link

**Expected Console Output**:
```
🎬 Starting render request...
🎬 Render job created: 12345678-abcd-efgh-ijkl-123456789012
🎬 Render status: processing (25%)
🎬 Render status: processing (50%)
🎬 Render status: processing (75%)
🎬 Render status: completed (100%)
🎉 Render completed! Opening download...
```

**Expected Result**: 
- WebM video file downloads automatically
- Video duration matches preview timeline (~30-60 seconds)
- Audio and video are synchronized
- Video resolution is 1280x720

---

### Test 3: Server API Testing

Test the API endpoints directly:

**3a. Health Check**
```bash
curl http://localhost:3002/api/health
```
Expected: `{"status":"ok","timestamp":"...","activeJobs":0}`

**3b. Manual Render Request**
```bash
curl -X POST http://localhost:3002/api/render \
  -H "Content-Type: application/json" \
  -d '{"projectData":{}}'
```
Expected: `{"jobId":"...","status":"queued","message":"..."}`

**3c. Status Check** (using jobId from step 3b)
```bash
curl http://localhost:3002/api/render/[YOUR_JOB_ID]/status
```
Expected: `{"jobId":"...","status":"processing","progress":...}`

---

### Test 4: Error Handling

**4a. Server Not Running**
1. Stop render server (Ctrl+C in Terminal 2)
2. Click export button in browser
3. Check for error alert

**Expected**: Error message about failed connection

**4b. Invalid Project Data**
```bash
curl -X POST http://localhost:3002/api/render \
  -H "Content-Type: application/json" \
  -d '{"invalidData":true}'
```
**Expected**: 400 error about missing project data

---

### Test 5: File System Verification

**Check render output directory**:
```bash
ls -la renders/
```
**Expected**: WebM files with UUID names like `12345678-abcd-efgh-ijkl-123456789012.webm`

**Check server logs**:
Look for Puppeteer browser launch messages and rendering progress in Terminal 2.

---

## 🔍 Troubleshooting

### Common Issues

**"Port 3002 already in use"**
- Kill existing process: `lsof -ti:3002 | xargs kill -9`
- Or change port in `src/server/render-server.ts`

**"Render timeout"**
- Check Chrome installation
- Increase timeout in VideoRenderer.ts
- Check system resources

**"No video/audio in output"**
- Verify Web Audio API support
- Check browser console for MediaRecorder errors
- Test with different audio settings

**"Download doesn't start"**
- Check popup blocker settings
- Verify file exists in `renders/` directory
- Test download endpoint directly

### Debug Mode

**Enable verbose logging in main.ts**:
Uncomment console.log statements for detailed debugging

**Monitor Puppeteer browser**:
Set `headless: false` in VideoRenderer.ts to see rendering process

**Check server logs**:
Terminal 2 shows detailed server-side logging

---

## 📊 Performance Expectations

### Typical Render Times
- **30-second video**: ~45-60 seconds total
- **Breakdown**:
  - Setup: ~5-10 seconds
  - Recording: ~30+ seconds (real-time)
  - Processing: ~5-10 seconds

### System Requirements
- **RAM**: 4GB+ available (Chrome + video processing)
- **CPU**: Modern multi-core processor
- **Disk**: ~100MB per rendered video

### Quality Specifications
- **Resolution**: 1280x720 (720p HD)
- **Frame Rate**: 30fps
- **Audio**: Web Audio API quality
- **Format**: WebM container with VP8/Opus codecs

---

## ✅ Success Criteria

A successful test should demonstrate:

1. **✅ UI Integration**: Export button appears and functions
2. **✅ Server Communication**: API calls succeed with valid responses
3. **✅ Video Generation**: WebM file created with correct specifications
4. **✅ Audio Sync**: Background music and voice-over properly synchronized
5. **✅ File Download**: Completed render downloads automatically
6. **✅ Error Handling**: Graceful failure modes with user feedback

## 🚀 Next Steps

Once basic testing passes:

1. **Performance Testing**: Try longer/more complex projects
2. **Concurrent Renders**: Test multiple simultaneous render jobs
3. **Production Setup**: Configure for deployment environment
4. **FFmpeg Integration**: Upgrade to FFmpeg for better quality/formats
5. **Queue Persistence**: Add database storage for job management

---

**Happy Testing! 🎬**

If you encounter any issues, check the console logs in both terminals and refer to the troubleshooting section above.