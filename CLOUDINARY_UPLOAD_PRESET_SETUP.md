# Cloudinary Upload Preset Setup Guide

## 🎯 Purpose

Create an unsigned upload preset to enable direct browser-to-Cloudinary uploads, bypassing Vercel's 4.5MB request body limit.

## 📋 Prerequisites

- Access to your Cloudinary dashboard
- Cloud name: `dqmxmwfiv`

## 🚀 Step-by-Step Instructions

### 1. Access Cloudinary Dashboard

1. Go to https://cloudinary.com/console
2. Log in to your account
3. Navigate to **Settings** (gear icon) → **Upload**

### 2. Create Upload Preset

1. Scroll to **Upload presets** section
2. Click **Add upload preset** button
3. Configure the following:

#### Basic Settings

- **Preset name**: `quicklist_unsigned`
- **Signing mode**: **Unsigned** ⚠️ CRITICAL - Must be unsigned for browser uploads
- **Use filename**: Optional (can leave as default)
- **Unique filename**: ✅ Recommended (prevents overwrites)

#### Upload Manipulations - Incoming Transformation

This is KEY for saving storage space! Configure automatic resizing:

1. Click **Edit** next to "Incoming Transformation"
2. Add transformation:
   ```
   Width: 1200
   Crop: limit (only downscale if larger, don't upscale)
   Quality: auto
   Format: auto (WebP/AVIF when supported)
   ```

This will automatically resize all uploaded images to max 1200px width, saving ~70% storage!

Example result:

- Original: 3MB @ 4000x3000px
- After incoming transformation: ~300KB @ 1200x900px

#### Folder Settings

- **Folder**: Leave empty (we set dynamically: `quicklist/{userId}`)
- **Allow user to specify**: ✅ Checked

#### Security & Limits (Optional but Recommended)

- **Allowed formats**: jpg, jpeg, png, webp, gif
- **Max file size**: 10MB (prevents abuse)
- **Max image width**: 4000px (reasonable limit)
- **Max image height**: 4000px

### 3. Save Preset

1. Click **Save** at the bottom
2. ✅ Verify preset appears in the list
3. Note the preset name: `quicklist_unsigned`

## 🔒 Security Considerations

### What Unsigned Uploads Allow:

✅ Direct browser uploads (no server involvement)
✅ Specify folder, tags, context
✅ Apply preset transformations

### What They Prevent:

❌ Overwriting existing assets (always false)
❌ Modifying certain sensitive parameters
❌ Accessing other users' folders (enforced by folder structure)

### Best Practices:

1. **Monitor uploads**: Check your Cloudinary dashboard regularly
2. **Rotate preset names**: Every few months, create a new preset name to prevent unauthorized use
3. **Set limits**: Use max file size and dimension limits in preset
4. **Organize by user**: We use `quicklist/{userId}/` folder structure

## 📊 Storage Savings

### Without Incoming Transformation:

- User uploads 10 photos @ 3MB each = 30MB stored
- Monthly: 300 users × 10 photos = 90GB

### With Incoming Transformation (1200px limit):

- Each photo resized to ~300KB = 3MB total
- Monthly: 300 users × 10 photos = 9GB
- **Savings: 90% less storage!** 🎉

## 🧪 Testing

After creating the preset, test with:

```javascript
// Test in browser console
const formData = new FormData();
formData.append('file', yourImageBlob);
formData.append('upload_preset', 'quicklist_unsigned');
formData.append('folder', 'quicklist/test');

fetch('https://api.cloudinary.com/v1_1/dqmxmwfiv/image/upload', {
  method: 'POST',
  body: formData,
})
  .then((r) => r.json())
  .then(console.log);
```

Expected response:

```json
{
  "asset_id": "...",
  "public_id": "quicklist/test/abc123",
  "secure_url": "https://res.cloudinary.com/...",
  "width": 1200,
  "height": 900,
  "format": "jpg",
  "bytes": 305123
}
```

## ⚠️ Troubleshooting

### Error: "Upload preset must be specified"

- ✅ Check preset name is exactly: `quicklist_unsigned`
- ✅ Verify preset is marked as **Unsigned**

### Error: "Upload preset not found"

- ✅ Preset hasn't been saved yet
- ✅ Typo in preset name

### Error: "Invalid credentials"

- ✅ Cloud name is wrong (should be: `dqmxmwfiv`)
- ✅ Trying to use signed upload (we need unsigned)

### Images not being resized:

- ✅ Check "Incoming Transformation" is configured (not "Eager")
- ✅ Verify transformation parameters are correct

## 📝 Summary

Once this preset is created:

1. ✅ Browser uploads directly to Cloudinary
2. ✅ Bypasses Vercel's 4.5MB limit
3. ✅ Automatically resizes images
4. ✅ Saves 70-90% storage space
5. ✅ Faster uploads (no server roundtrip)

**Action Required**: Create the `quicklist_unsigned` preset in your Cloudinary dashboard now!
