#!/usr/bin/env node
/* global AbortController */

const fs = require('fs');
const path = require('path');

const SAMPLE_DIR = process.env.SAMPLE_DIR || path.resolve(__dirname, '..', '..', 'Sample Images');
const BASE_URL = process.env.BASE_URL || 'http://localhost:4577';
const GROUP_GAP = Number(process.env.GROUP_GAP || 5);
const MAX_IMAGES = Number(process.env.MAX_IMAGES || 10);
const PLATFORM = process.env.PLATFORM || 'vinted';
const MAX_PAYLOAD_MB = Number(process.env.MAX_PAYLOAD_MB || 45);
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 90000);

const isImage = (file) => /IMG_\d+\.JPG$/i.test(file);
const extractNumber = (file) => parseInt(file.match(/\d+/)?.[0] || '0', 10);

const toDataUri = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
};

const groupImages = (files, gap) => {
  const sorted = files.sort((a, b) => extractNumber(a) - extractNumber(b));
  if (!sorted.length) return [];

  const groups = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const diff = extractNumber(sorted[i]) - extractNumber(sorted[i - 1]);
    if (diff > gap) {
      groups.push(current);
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }

  groups.push(current);
  return groups;
};

const chunkGroup = (group, size) => {
  const chunks = [];
  for (let i = 0; i < group.length; i += size) {
    chunks.push(group.slice(i, i + size));
  }
  return chunks;
};

const validateListing = (listing, platform) => {
  const errors = [];
  const warnings = [];

  if (!listing.title) errors.push('Missing title');
  if (!listing.description) errors.push('Missing description');
  if (!listing.price) warnings.push('Missing price');
  if (!listing.rrp) warnings.push('Missing rrp');
  if (!listing.condition) warnings.push('Missing condition');
  if (!Array.isArray(listing.keywords) || listing.keywords.length === 0) {
    warnings.push('Missing keywords');
  }
  if (!Array.isArray(listing.sources)) warnings.push('Missing sources');

  if (platform === 'ebay' && listing.title?.length > 80) {
    errors.push(`Title length ${listing.title.length} exceeds 80 chars for eBay`);
  }
  if (platform !== 'ebay' && listing.title?.length > 140) {
    errors.push(`Title length ${listing.title.length} exceeds 140 chars`);
  }

  const footer = 'Listing generated from photos by AI, free at www.quicklist.it.com';
  if (listing.description && !listing.description.includes(footer)) {
    warnings.push('Missing attribution footer');
  }

  if (Array.isArray(listing.keywords) && listing.keywords.length > 0) {
    const last = listing.keywords[listing.keywords.length - 1];
    if (String(last).toLowerCase() !== '#quicklist') {
      warnings.push('Missing #quicklist as last keyword');
    }
  }

  return { errors, warnings };
};

const run = async () => {
  if (!fs.existsSync(SAMPLE_DIR)) {
    console.error(`Sample directory not found: ${SAMPLE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(SAMPLE_DIR).filter(isImage);
  if (!files.length) {
    console.error('No sample images found.');
    process.exit(1);
  }

  const groups = groupImages(files, GROUP_GAP);
  const chunks = groups.flatMap((group) =>
    chunkGroup(group, MAX_IMAGES).map((chunk, idx) => ({
      name: `${group[0]}..${group[group.length - 1]}#${idx + 1}`,
      files: chunk,
    }))
  );

  console.log(`Found ${files.length} images in ${SAMPLE_DIR}`);
  console.log(`Grouped into ${groups.length} sets, ${chunks.length} test cases`);
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Platform: ${PLATFORM}`);

  for (const testCase of chunks) {
    const images = [];
    let estimatedMb = 0;

    for (const file of testCase.files) {
      const filePath = path.join(SAMPLE_DIR, file);
      const bytes = fs.statSync(filePath).size;
      const estimatedBase64Mb = (bytes * 4) / 3 / 1024 / 1024;
      if (estimatedMb + estimatedBase64Mb > MAX_PAYLOAD_MB) {
        console.log(`Skipping ${file} to stay under ${MAX_PAYLOAD_MB}MB payload limit`);
        continue;
      }
      images.push(toDataUri(filePath));
      estimatedMb += estimatedBase64Mb;
    }

    if (!images.length) {
      console.log('No images selected for this test case after payload limit check. Skipping.');
      continue;
    }

    const payload = {
      images,
      platform: PLATFORM,
      hint: '',
      itemModel: '',
      conditionInfo: '',
    };

    console.log(`\n=== Test Case: ${testCase.name} (${testCase.files.length} images) ===`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      const listing = data.listing || {};
      const { errors, warnings } = validateListing(listing, PLATFORM);

      console.log(`Title: ${listing.title || '—'}`);
      console.log(`Category: ${listing.category || '—'}`);
      console.log(`Condition: ${listing.condition || '—'}`);
      console.log(`Price: ${listing.price || '—'}`);
      console.log(`Keywords: ${Array.isArray(listing.keywords) ? listing.keywords.length : 0}`);
      console.log(`Sources: ${Array.isArray(listing.sources) ? listing.sources.length : 0}`);
      console.log(`Confidence: ${listing.confidence || data.confidence || '—'}`);
      console.log(`Requires Selection: ${data.requiresUserSelection ? 'yes' : 'no'}`);

      if (errors.length) {
        console.log('Errors:');
        errors.forEach((e) => console.log(`- ${e}`));
      }
      if (warnings.length) {
        console.log('Warnings:');
        warnings.forEach((w) => console.log(`- ${w}`));
      }

      if (!errors.length && !warnings.length) {
        console.log('Result: PASS');
      }
    } catch (error) {
      console.error('Test error:', error.message);
    }
  }
};

run();
