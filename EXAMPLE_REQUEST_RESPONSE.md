# Cloudinary API - Example Request & Response

## Upload Image Example

### Request

**Endpoint**: `POST http://localhost:4577/api/images/upload`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6Imluc18yb...
```

**Body**:
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAH/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCqAB//2Q=="
}
```

### Success Response (200 OK)

```json
{
  "success": true,
  "publicId": "quicklist/42/xyz789abc123def456ghi789",
  "url": "https://res.cloudinary.com/dqmxmwfiv/image/upload/v1699876543/quicklist/42/xyz789abc123def456ghi789.jpg",
  "thumbnailUrl": "https://res.cloudinary.com/dqmxmwfiv/image/upload/c_fill,g_auto,h_300,q_auto:good,w_300/v1699876543/quicklist/42/xyz789abc123def456ghi789.jpg",
  "format": "jpg",
  "width": 1200,
  "height": 900,
  "bytes": 156784
}
```

### Response Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `true` for successful uploads |
| `publicId` | string | Cloudinary public ID (used for deletion) |
| `url` | string | Full-size optimized image URL |
| `thumbnailUrl` | string | 300x300px thumbnail URL with smart crop |
| `format` | string | Image format (jpg, png, webp, etc.) |
| `width` | number | Image width in pixels (max 1200px) |
| `height` | number | Image height in pixels |
| `bytes` | number | File size in bytes |

### Error Responses

**Missing Image Data (400)**:
```json
{
  "error": "Image data required"
}
```

**Invalid Format (400)**:
```json
{
  "error": "Invalid image format. Must be base64 encoded with data:image prefix"
}
```

**Image Too Large (400)**:
```json
{
  "error": "Image too large. Maximum size is 10MB"
}
```

**Not Authenticated (401)**:
```json
{
  "error": "Access token required"
}
```

**Service Unavailable (503)**:
```json
{
  "error": "Image upload service is not available"
}
```

**Server Error (500)**:
```json
{
  "error": "Failed to upload image",
  "details": "Invalid image data"
}
```

---

## Delete Image Example

### Request

**Endpoint**: `DELETE http://localhost:4577/api/images/quicklist%2F42%2Fxyz789abc123def456ghi789`

Note: The publicId from the upload response must be URL-encoded:
- Original: `quicklist/42/xyz789abc123def456ghi789`
- Encoded: `quicklist%2F42%2Fxyz789abc123def456ghi789`

**Headers**:
```
Authorization: Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6Imluc18yb...
```

**Body**: None

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

### Error Responses

**Missing Public ID (400)**:
```json
{
  "error": "Public ID required"
}
```

**Not Authenticated (401)**:
```json
{
  "error": "Access token required"
}
```

**Permission Denied (403)**:
```json
{
  "error": "You do not have permission to delete this image"
}
```

This error occurs when:
- Trying to delete another user's image
- The publicId doesn't start with `quicklist/{your_user_id}/`

**Image Not Found (404)**:
```json
{
  "error": "Image not found"
}
```

**Server Error (500)**:
```json
{
  "error": "Failed to delete image",
  "details": "Network error"
}
```

---

## Complete Flow Example

### 1. User uploads product photo

```javascript
// Frontend code
const fileInput = document.querySelector('#photoInput');
const file = fileInput.files[0];

// Convert to base64
const reader = new FileReader();
reader.onload = async (e) => {
  const base64Image = e.target.result;

  // Upload to Cloudinary
  const response = await fetch('http://localhost:4577/api/images/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ image: base64Image })
  });

  const result = await response.json();
  console.log('Upload successful!');
  console.log('Image URL:', result.url);
  console.log('Thumbnail:', result.thumbnailUrl);

  // Store in your app state
  uploadedImages.push({
    publicId: result.publicId,
    url: result.url,
    thumbnail: result.thumbnailUrl
  });
};
reader.readAsDataURL(file);
```

**Upload Response**:
```json
{
  "success": true,
  "publicId": "quicklist/42/xyz789abc123",
  "url": "https://res.cloudinary.com/.../xyz789abc123.jpg",
  "thumbnailUrl": "https://res.cloudinary.com/.../xyz789abc123.jpg",
  "format": "jpg",
  "width": 1200,
  "height": 900,
  "bytes": 156784
}
```

### 2. Display image in gallery

```html
<!-- Use thumbnail for gallery view -->
<img src="https://res.cloudinary.com/.../c_fill,h_300,w_300/xyz789abc123.jpg"
     alt="Product photo"
     class="thumbnail">

<!-- Use full URL for detail view -->
<img src="https://res.cloudinary.com/.../xyz789abc123.jpg"
     alt="Product photo"
     class="full-size">
```

### 3. User removes photo from listing

```javascript
// Frontend code
const publicId = 'quicklist/42/xyz789abc123';

const response = await fetch(
  `http://localhost:4577/api/images/${encodeURIComponent(publicId)}`,
  {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const result = await response.json();
console.log(result.message); // "Image deleted successfully"
```

**Delete Response**:
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

---

## Image URLs Explained

### Full Image URL
```
https://res.cloudinary.com/dqmxmwfiv/image/upload/v1699876543/quicklist/42/xyz789.jpg
```

Components:
- `res.cloudinary.com` - Cloudinary CDN domain
- `dqmxmwfiv` - Your cloud name
- `image/upload` - Upload resource type
- `v1699876543` - Version timestamp
- `quicklist/42` - User-specific folder
- `xyz789.jpg` - Unique ID + format

Transformations applied:
- Max width: 1200px (maintains aspect ratio)
- Quality: auto:good (optimized)
- Format: auto (WebP/AVIF if supported)

### Thumbnail URL
```
https://res.cloudinary.com/dqmxmwfiv/image/upload/c_fill,g_auto,h_300,q_auto:good,w_300/v1699876543/quicklist/42/xyz789.jpg
```

Additional transformations:
- `c_fill` - Crop to fill 300x300px
- `g_auto` - Smart crop focusing on main subject
- `h_300,w_300` - 300x300px size
- `q_auto:good` - Automatic quality optimization

### Custom Transformations

You can create custom sizes on-the-fly:

**Small preview (150x150)**:
```
https://res.cloudinary.com/dqmxmwfiv/image/upload/c_fill,h_150,w_150/v1699876543/quicklist/42/xyz789.jpg
```

**Large display (800px wide)**:
```
https://res.cloudinary.com/dqmxmwfiv/image/upload/c_limit,w_800/v1699876543/quicklist/42/xyz789.jpg
```

**Square thumbnail with border**:
```
https://res.cloudinary.com/dqmxmwfiv/image/upload/b_rgb:ffffff,bo_2px_solid_rgb:cccccc,c_fill,h_200,w_200/v1699876543/quicklist/42/xyz789.jpg
```

See [Cloudinary Transformations Docs](https://cloudinary.com/documentation/image_transformations) for more options.

---

## Testing with cURL

### Upload Test Image

```bash
# 1x1 red pixel PNG for testing
curl -X POST http://localhost:4577/api/images/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
  }'
```

**Expected Output**:
```json
{
  "success": true,
  "publicId": "quicklist/42/abc123def456",
  "url": "https://res.cloudinary.com/dqmxmwfiv/image/upload/v1699876543/quicklist/42/abc123def456.png",
  "thumbnailUrl": "https://res.cloudinary.com/dqmxmwfiv/image/upload/c_fill,g_auto,h_300,q_auto:good,w_300/v1699876543/quicklist/42/abc123def456.png",
  "format": "png",
  "width": 1,
  "height": 1,
  "bytes": 95
}
```

### Delete Test Image

```bash
# Use publicId from upload response
curl -X DELETE "http://localhost:4577/api/images/quicklist%2F42%2Fabc123def456" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Expected Output**:
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

---

## Performance Metrics

Based on a typical product photo (2000x1500px, 800KB JPEG):

| Metric | Base64 in DB | Cloudinary |
|--------|--------------|------------|
| Storage Size | 1.07 MB | ~200 KB |
| Database Impact | High (large TEXT) | Low (small TEXT) |
| Load Time | Slow (DB query) | Fast (CDN) |
| Thumbnail Gen | Server-side | On-demand |
| Format Conversion | Manual | Automatic |
| Global Delivery | No | Yes (CDN) |
| Backup Size | Large | Small |

### Example Load Times (typical 4G connection)

| Image | Base64 in DB | Cloudinary |
|-------|--------------|------------|
| Full Size | ~2.5s | ~0.8s |
| Thumbnail | ~1.5s | ~0.3s |
| Gallery (10 images) | ~15s | ~3s |

---

## Integration Checklist

- [x] Cloudinary SDK installed
- [x] Environment variables configured
- [x] Upload endpoint implemented
- [x] Delete endpoint implemented
- [x] Helper function created
- [x] Error handling implemented
- [x] Authentication/Authorization implemented
- [x] Documentation written
- [x] Test script created
- [ ] Rate limiting added
- [ ] Frontend integration
- [ ] Database migration
- [ ] Listing API updated
- [ ] Cascading delete implemented
- [ ] Monitoring/alerting setup

---

## Quick Reference

### Get Auth Token
```javascript
// In browser console after signing in
localStorage.getItem('quicklist-token')
```

### Upload Image
```bash
POST /api/images/upload
Body: { "image": "data:image/jpeg;base64,..." }
Header: Authorization: Bearer <token>
```

### Delete Image
```bash
DELETE /api/images/:publicId
Header: Authorization: Bearer <token>
Note: URL-encode the publicId
```

### publicId Format
```
quicklist/{userId}/{uniqueId}
Example: quicklist/42/xyz789abc123
Encoded: quicklist%2F42%2Fxyz789abc123
```

### Image Sizes
- **Upload**: Max 10MB
- **Output**: Max 1200px width
- **Thumbnail**: 300x300px
- **Storage**: Cloudinary free tier = 25GB
