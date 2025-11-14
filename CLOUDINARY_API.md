# Cloudinary Image Upload API Documentation

## Overview

The Cloudinary integration provides cloud-based image storage to solve database scalability issues. Images are stored on Cloudinary's CDN instead of as base64 in the PostgreSQL database.

## Benefits

1. **Reduced Database Size**: Images stored externally instead of base64 in database
2. **Better Performance**: CDN-hosted images load faster globally
3. **Automatic Optimization**: Automatic format conversion (WebP/AVIF) and quality optimization
4. **Image Transformations**: On-the-fly resizing and thumbnail generation
5. **Scalability**: No database size limits for images

## Configuration

Cloudinary credentials are configured in `.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Endpoints

### 1. Upload Image

Upload an image to Cloudinary with automatic optimization and transformations.

**Endpoint**: `POST /api/images/upload`

**Authentication**: Required (Bearer token)

**Request Body**:

```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA..."
}
```

**Request Headers**:

```
Content-Type: application/json
Authorization: Bearer <your_clerk_token>
```

**Success Response** (200 OK):

```json
{
  "success": true,
  "publicId": "quicklist/123/abc123def456",
  "url": "https://res.cloudinary.com/quicklist/image/upload/v1234567890/quicklist/123/abc123def456.jpg",
  "thumbnailUrl": "https://res.cloudinary.com/quicklist/image/upload/c_fill,g_auto,h_300,q_auto:good,w_300/quicklist/123/abc123def456.jpg",
  "format": "jpg",
  "width": 1200,
  "height": 900,
  "bytes": 245678
}
```

**Error Responses**:

- **400 Bad Request** - Missing or invalid image data:

  ```json
  {
    "error": "Image data required"
  }
  ```

- **400 Bad Request** - Invalid image format:

  ```json
  {
    "error": "Invalid image format. Must be base64 encoded with data:image prefix"
  }
  ```

- **400 Bad Request** - Image too large:

  ```json
  {
    "error": "Image too large. Maximum size is 10MB"
  }
  ```

- **401 Unauthorized** - Missing or invalid token:

  ```json
  {
    "error": "Access token required"
  }
  ```

- **503 Service Unavailable** - Cloudinary not configured:

  ```json
  {
    "error": "Image upload service is not available"
  }
  ```

- **500 Internal Server Error** - Upload failed:
  ```json
  {
    "error": "Failed to upload image",
    "details": "Error message details"
  }
  ```

**Image Transformations Applied**:

- **Main Image**:
  - Max width: 1200px (maintains aspect ratio)
  - Quality: auto:good (automatic optimization)
  - Format: auto (serves WebP/AVIF if browser supports)
  - Crop: limit (no upscaling)

- **Thumbnail**:
  - Size: 300x300px
  - Crop: fill (covers entire area)
  - Gravity: auto (smart crop focusing on main subject)
  - Quality: auto:good
  - Format: auto

**Folder Organization**:
Images are organized by user: `quicklist/{userId}/{unique_id}`

### 2. Delete Image

Delete an image from Cloudinary. Only the owner can delete their images.

**Endpoint**: `DELETE /api/images/:publicId`

**Authentication**: Required (Bearer token)

**URL Parameters**:

- `publicId` (required): The Cloudinary public ID (must be URL-encoded)

**Request Headers**:

```
Authorization: Bearer <your_clerk_token>
```

**Example Request**:

```bash
DELETE /api/images/quicklist%2F123%2Fabc123def456
```

Note: The publicId contains slashes, so it must be URL-encoded:

- Raw: `quicklist/123/abc123def456`
- Encoded: `quicklist%2F123%2Fabc123def456`

**Success Response** (200 OK):

```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

**Error Responses**:

- **400 Bad Request** - Missing public ID:

  ```json
  {
    "error": "Public ID required"
  }
  ```

- **401 Unauthorized** - Missing or invalid token:

  ```json
  {
    "error": "Access token required"
  }
  ```

- **403 Forbidden** - User doesn't own the image:

  ```json
  {
    "error": "You do not have permission to delete this image"
  }
  ```

- **404 Not Found** - Image doesn't exist:

  ```json
  {
    "error": "Image not found"
  }
  ```

- **500 Internal Server Error** - Delete failed:
  ```json
  {
    "error": "Failed to delete image",
    "details": "Error message details"
  }
  ```

**Security**:

- Only images in the user's folder (`quicklist/{userId}/`) can be deleted
- Folder path is validated against the authenticated user's ID

## Usage Examples

### JavaScript (Fetch API)

**Upload an image**:

```javascript
// Convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Upload image
async function uploadImage(file, token) {
  const base64Image = await fileToBase64(file);

  const response = await fetch('http://localhost:4577/api/images/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ image: base64Image }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
}

// Usage
const fileInput = document.querySelector('input[type="file"]');
const token = localStorage.getItem('quicklist-token');

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  try {
    const result = await uploadImage(file, token);
    console.log('Upload successful:', result);
    console.log('Image URL:', result.url);
    console.log('Thumbnail URL:', result.thumbnailUrl);
  } catch (error) {
    console.error('Upload failed:', error.message);
  }
});
```

**Delete an image**:

```javascript
async function deleteImage(publicId, token) {
  // URL-encode the publicId
  const encodedPublicId = encodeURIComponent(publicId);

  const response = await fetch(`http://localhost:4577/api/images/${encodedPublicId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }

  return await response.json();
}

// Usage
const publicId = 'quicklist/123/abc123def456';
const token = localStorage.getItem('quicklist-token');

try {
  const result = await deleteImage(publicId, token);
  console.log('Delete successful:', result.message);
} catch (error) {
  console.error('Delete failed:', error.message);
}
```

### cURL Examples

**Upload an image**:

```bash
# Using a small test image (1x1 red pixel PNG)
curl -X POST http://localhost:4577/api/images/upload \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
  }'
```

**Delete an image**:

```bash
curl -X DELETE "http://localhost:4577/api/images/quicklist%2F123%2Fabc123def456" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Node.js (Axios)

**Upload an image**:

```javascript
const axios = require('axios');
const fs = require('fs');

// Read image file and convert to base64
function imageToBase64(filePath) {
  const image = fs.readFileSync(filePath);
  const base64Image = image.toString('base64');
  const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${base64Image}`;
}

async function uploadImage(imagePath, token) {
  const base64Image = imageToBase64(imagePath);

  const response = await axios.post(
    'http://localhost:4577/api/images/upload',
    { image: base64Image },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
}

// Usage
const token = 'your_clerk_token';
uploadImage('./photo.jpg', token)
  .then((result) => {
    console.log('Upload successful:', result);
  })
  .catch((error) => {
    console.error('Upload failed:', error.response?.data || error.message);
  });
```

**Delete an image**:

```javascript
async function deleteImage(publicId, token) {
  const encodedPublicId = encodeURIComponent(publicId);

  const response = await axios.delete(`http://localhost:4577/api/images/${encodedPublicId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
}

// Usage
const token = 'your_clerk_token';
const publicId = 'quicklist/123/abc123def456';

deleteImage(publicId, token)
  .then((result) => {
    console.log('Delete successful:', result);
  })
  .catch((error) => {
    console.error('Delete failed:', error.response?.data || error.message);
  });
```

## Helper Function

The `uploadToCloudinary()` helper function is available for use in other server-side code:

```javascript
/**
 * Upload an image to Cloudinary
 * @param {string} base64Data - Base64 encoded image with data:image prefix
 * @param {string} userId - User ID for folder organization
 * @returns {Promise<Object>} Upload result with URLs
 */
async function uploadToCloudinary(base64Data, userId) {
  // Returns:
  // {
  //   success: true,
  //   publicId: "quicklist/123/abc123def456",
  //   url: "https://...",
  //   thumbnailUrl: "https://...",
  //   format: "jpg",
  //   width: 1200,
  //   height: 900,
  //   bytes: 245678
  // }
}

// Usage in other endpoints
const result = await uploadToCloudinary(imageData, userId);
console.log('Uploaded to:', result.url);
```

## Integration with Existing Listings

To integrate Cloudinary with the existing listings system:

1. **Option A: Store URLs in database**
   - Add `image_url` column to `images` table
   - Store Cloudinary URLs instead of base64 data
   - Keep `image_data` column for backward compatibility

2. **Option B: Gradual migration**
   - Keep base64 storage for existing images
   - Use Cloudinary for new images
   - Migrate old images in background

3. **Recommended approach**:

   ```sql
   -- Add new columns to images table
   ALTER TABLE images ADD COLUMN cloudinary_public_id TEXT;
   ALTER TABLE images ADD COLUMN cloudinary_url TEXT;
   ALTER TABLE images ADD COLUMN cloudinary_thumbnail_url TEXT;

   -- Make image_data nullable for Cloudinary images
   ALTER TABLE images ALTER COLUMN image_data DROP NOT NULL;
   ```

   Then in code:

   ```javascript
   // When creating a listing with images
   const uploadedImages = await Promise.all(images.map((img) => uploadToCloudinary(img, userId)));

   // Store in database
   for (const img of uploadedImages) {
     await pool.query(
       `INSERT INTO images (listing_id, cloudinary_public_id, cloudinary_url, cloudinary_thumbnail_url, image_order)
        VALUES ($1, $2, $3, $4, $5)`,
       [listingId, img.publicId, img.url, img.thumbnailUrl, order]
     );
   }
   ```

## Rate Limits and Quotas

**Cloudinary Free Tier**:

- 25 GB storage
- 25 GB bandwidth/month
- 25,000 transformations/month

**Recommendations**:

- Monitor usage in Cloudinary dashboard
- Implement image size limits (currently 10MB)
- Consider compression before upload
- Use Cloudinary's automatic optimization

## Testing

A test script is provided at `test-cloudinary.js`:

```bash
# 1. Get an auth token by signing in to the app
# 2. Update AUTH_TOKEN in test-cloudinary.js
# 3. Run tests
node test-cloudinary.js
```

## Troubleshooting

**"Image upload service is not available"**

- Check that Cloudinary credentials are set in `.env`
- Verify credentials are correct in Cloudinary dashboard

**"Failed to upload image"**

- Check image size (max 10MB)
- Verify image is valid base64 with data:image prefix
- Check Cloudinary dashboard for errors

**"You do not have permission to delete this image"**

- Verify the publicId starts with `quicklist/{your_user_id}/`
- Check that you're authenticated as the correct user

**Images not loading**

- Verify Cloudinary URLs are accessible
- Check CORS settings in Cloudinary dashboard
- Ensure images haven't been deleted

## Security Considerations

1. **Authentication**: All endpoints require valid Clerk authentication
2. **Authorization**: Users can only delete their own images (folder-based)
3. **Input Validation**: Image size, format, and structure are validated
4. **Rate Limiting**: Consider adding rate limits for upload endpoint
5. **Signed URLs**: For sensitive images, consider using Cloudinary signed URLs

## Next Steps

To complete the migration:

1. Update the `/api/listings` POST endpoint to use Cloudinary
2. Update the `/api/listings/:id` PUT endpoint to handle Cloudinary URLs
3. Add database migrations for new columns
4. Update frontend to use Cloudinary URLs instead of base64
5. Implement image deletion when listings are deleted
6. Add background job to migrate existing base64 images

## References

- [Cloudinary Node.js SDK Documentation](https://cloudinary.com/documentation/node_integration)
- [Cloudinary Image Transformations](https://cloudinary.com/documentation/image_transformations)
- [Cloudinary Upload API](https://cloudinary.com/documentation/image_upload_api_reference)
