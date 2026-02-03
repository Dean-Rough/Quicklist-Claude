const optimizationCache = new Map();

const toHashtags = (keywords = [], limit = 12) => {
  return keywords
    .map((kw) => String(kw || '').trim())
    .filter(Boolean)
    .map((kw) => `#${kw.replace(/\s+/g, '')}`)
    .slice(0, limit)
    .join(' ');
};

const normalizeListing = (listing = {}) => ({
  title: listing.title || '',
  description: listing.description || '',
  price: listing.price || '',
  rrp: listing.rrp || '',
  brand: listing.brand || '',
  category: listing.category || '',
  condition: listing.condition || '',
  keywords: Array.isArray(listing.keywords) ? listing.keywords : [],
  images: listing.images || [],
  location: listing.location || '',
});

const buildItemSpecifics = (listing) => {
  const specifics = [];
  if (listing.brand) specifics.push(`Brand: ${listing.brand}`);
  if (listing.condition) specifics.push(`Condition: ${listing.condition}`);
  if (listing.category) specifics.push(`Category: ${listing.category}`);
  if (!specifics.length) return '';
  return `\n\nITEM SPECIFICS:\n${specifics.map((line) => `• ${line}`).join('\n')}`;
};

const withPlatform = (listing, platform, overrides) => ({
  ...listing,
  platform,
  ...overrides,
});

async function optimizeForEbay(rawListing) {
  const listing = normalizeListing(rawListing);
  const title = listing.title.trim().slice(0, 80);
  const description = `${listing.description.trim()}${buildItemSpecifics(listing)}`.trim();
  return withPlatform(listing, 'ebay', { title, description });
}

async function optimizeForVinted(rawListing) {
  const listing = normalizeListing(rawListing);
  const title = listing.title.trim().slice(0, 100);
  const hashtags = toHashtags(listing.keywords, 15);
  const description = [listing.description.trim(), hashtags].filter(Boolean).join('\n\n');
  return withPlatform(listing, 'vinted', { title, description });
}

async function optimizeForDepop(rawListing) {
  const listing = normalizeListing(rawListing);
  const title = listing.title.trim().toUpperCase().slice(0, 100);
  const hashtags = toHashtags(listing.keywords, 15);
  const meta = [
    listing.condition ? `condition: ${listing.condition.toLowerCase()}` : '',
    listing.price ? `price: ${listing.price}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const description = [listing.description.trim(), meta, hashtags].filter(Boolean).join('\n\n');
  return withPlatform(listing, 'depop', { title, description });
}

async function optimizeForFacebook(rawListing) {
  const listing = normalizeListing(rawListing);
  const title = listing.title.trim().slice(0, 100);
  const hashtags = toHashtags(listing.keywords, 10);
  const meta = [
    listing.price ? `Price: ${listing.price}` : '',
    listing.condition ? `Condition: ${listing.condition}` : '',
    listing.brand ? `Brand: ${listing.brand}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const description = [title, meta, listing.description.trim(), hashtags]
    .filter(Boolean)
    .join('\n\n');
  return withPlatform(listing, 'facebook', { title, description });
}

async function getCachedOptimization(listingId, platform) {
  const key = `${listingId}:${platform}`;
  return optimizationCache.get(key) || null;
}

async function cacheOptimization(listingId, platform, data) {
  const key = `${listingId}:${platform}`;
  optimizationCache.set(key, data);
  return true;
}

module.exports = {
  optimizeForEbay,
  optimizeForVinted,
  optimizeForDepop,
  optimizeForFacebook,
  getCachedOptimization,
  cacheOptimization,
};
