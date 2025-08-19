# Video Preview SDK - Build Output

This directory contains the built SDK files ready for deployment to your hosting provider.

## Directory Structure

```
dist-sdk/
├── staging/v1.0.0/          # Staging build (with source maps)
│   ├── video-preview-sdk.js # Main SDK script
│   ├── iframe.html          # Iframe content
│   ├── style.css           # Styles
│   └── assets/             # All bundled resources
└── prod/v1.0.0/            # Production build (minified)
    ├── video-preview-sdk.js # Main SDK script  
    ├── iframe.html          # Iframe content
    ├── style.css           # Styles
    └── assets/             # All bundled resources
```

## Deployment

### 1. Upload to your hosting provider (Azure)
Upload the entire contents of either `staging/v1.0.0/` or `prod/v1.0.0/` to your web server.

### 2. Example deployment paths:
```
https://yourdomain.com/video-preview-sdk/staging/v1.0.0/video-preview-sdk.js
https://yourdomain.com/video-preview-sdk/prod/v1.0.0/video-preview-sdk.js
```

## Usage in your PHP application

```html
<!-- Include the SDK -->
<script src="https://yourdomain.com/video-preview-sdk/staging/v1.0.0/video-preview-sdk.js"></script>

<!-- Create container -->
<div id="preview-container" style="width: 800px;"></div>

<!-- Initialize -->
<script>
const preview = new VideoPreviewSDK({
  container: '#preview-container'
});

// Your project data from PHP
const projectData = <?php echo json_encode($yourProjectData); ?>;
preview.loadProject(projectData);

// Cleanup when done
// preview.destroy();
</script>
```

## Build Commands

- `npm run build:sdk:staging` - Build staging version (with source maps)
- `npm run build:sdk:prod` - Build production version (minified)
- `npm run build:sdk:all` - Build both versions

## File Sizes

### Staging (with source maps):
- Total bundle: ~932KB (gzipped: ~207KB)
- SDK wrapper: ~8KB

### Production (minified):
- Total bundle: ~336KB (gzipped: ~102KB) 
- SDK wrapper: ~8KB

The SDK automatically detects development vs production environments and loads the iframe content accordingly.