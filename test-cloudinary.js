/**
 * Cloudinary Integration Test Script
 *
 * This script demonstrates how to use the Cloudinary image upload endpoints.
 * Run with: node test-cloudinary.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const API_BASE_URL = 'http://localhost:4577/api';
const AUTH_TOKEN = 'YOUR_AUTH_TOKEN_HERE'; // Replace with a valid Clerk token

// Helper function to convert image file to base64
function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${base64Image}`;
}

// Helper function to create a test base64 image (1x1 red pixel PNG)
function createTestImage() {
  // This is a 1x1 red pixel PNG in base64
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
}

// Test 1: Upload an image
async function testUpload() {
  console.log('\n=== Test 1: Upload Image ===');

  try {
    const testImage = createTestImage();

    const response = await axios.post(
      `${API_BASE_URL}/images/upload`,
      { image: testImage },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );

    console.log('✓ Upload successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    return response.data.publicId;
  } catch (error) {
    console.error('✗ Upload failed:', error.response?.data || error.message);
    return null;
  }
}

// Test 2: Delete an image
async function testDelete(publicId) {
  console.log('\n=== Test 2: Delete Image ===');

  if (!publicId) {
    console.log('⊘ Skipping delete test (no publicId from upload)');
    return;
  }

  try {
    // Encode the publicId for URL (slashes need to be encoded)
    const encodedPublicId = encodeURIComponent(publicId);

    const response = await axios.delete(
      `${API_BASE_URL}/images/${encodedPublicId}`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );

    console.log('✓ Delete successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('✗ Delete failed:', error.response?.data || error.message);
  }
}

// Test 3: Error cases
async function testErrorCases() {
  console.log('\n=== Test 3: Error Cases ===');

  // Test 3a: Missing image data
  console.log('\nTest 3a: Missing image data');
  try {
    await axios.post(
      `${API_BASE_URL}/images/upload`,
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
  } catch (error) {
    console.log('✓ Expected error:', error.response?.data?.error);
  }

  // Test 3b: Invalid image format
  console.log('\nTest 3b: Invalid image format');
  try {
    await axios.post(
      `${API_BASE_URL}/images/upload`,
      { image: 'not-base64-data' },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
  } catch (error) {
    console.log('✓ Expected error:', error.response?.data?.error);
  }

  // Test 3c: Unauthorized delete
  console.log('\nTest 3c: Unauthorized delete (wrong user)');
  try {
    await axios.delete(
      `${API_BASE_URL}/images/quicklist%2F999%2Ftest`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
  } catch (error) {
    console.log('✓ Expected error:', error.response?.data?.error);
  }
}

// Main test runner
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Cloudinary Integration Test Suite                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  if (AUTH_TOKEN === 'YOUR_AUTH_TOKEN_HERE') {
    console.error('\n⚠️  Please set a valid AUTH_TOKEN in the script before running tests');
    console.log('\nTo get a token:');
    console.log('1. Start the server: npm run dev');
    console.log('2. Sign in to the app in your browser');
    console.log('3. Open browser console and run: localStorage.getItem("quicklist-token")');
    console.log('4. Copy the token value and set it in the script\n');
    process.exit(1);
  }

  const publicId = await testUpload();

  if (publicId) {
    console.log(`\n📝 Note: Image uploaded with publicId: ${publicId}`);
    console.log(`    View at: https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/${publicId}`);

    // Wait a bit before deleting
    await new Promise(resolve => setTimeout(resolve, 1000));
    await testDelete(publicId);
  }

  await testErrorCases();

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    Tests Complete!                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

// Run tests if executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testUpload, testDelete, testErrorCases };
