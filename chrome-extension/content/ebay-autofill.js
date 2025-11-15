/**
 * QuickList AI - eBay Auto-Fill Content Script
 * Automatically fills eBay listing forms with QuickList data
 */

console.log('[QuickList] eBay auto-fill script loaded');

// Show overlay notification
function showOverlay(message, type = 'info') {
  // Remove existing overlay
  const existing = document.querySelector('.quicklist-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = `quicklist-overlay ${type}`;
  overlay.innerHTML = `
    <button class="quicklist-close-btn">×</button>
    <div class="quicklist-overlay-header">
      <span class="quicklist-overlay-icon">⚡</span>
      <span class="quicklist-overlay-title">QuickList AI</span>
    </div>
    <div class="quicklist-overlay-message">${message}</div>
  `;

  document.body.appendChild(overlay);

  // Auto-remove after 5 seconds
  setTimeout(() => overlay.remove(), 5000);

  // Close button
  overlay.querySelector('.quicklist-close-btn').addEventListener('click', () => {
    overlay.remove();
  });

  return overlay;
}

// Wait for element to appear
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// Set input value and trigger events
function setInputValue(input, value) {
  if (!input || !value) return false;

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  nativeInputValueSetter.call(input, value);

  // Trigger events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));

  // Add highlight effect
  input.classList.add('quicklist-autofilled');

  return true;
}

// Set textarea value
function setTextareaValue(textarea, value) {
  if (!textarea || !value) return false;

  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
  textarea.classList.add('quicklist-autofilled');

  return true;
}

// Select dropdown option
function selectDropdownOption(select, value) {
  if (!select || !value) return false;

  // Find option by value or text
  const option = Array.from(select.options).find(
    (opt) =>
      opt.value.toLowerCase() === value.toLowerCase() ||
      opt.textContent.toLowerCase().includes(value.toLowerCase())
  );

  if (option) {
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    select.classList.add('quicklist-autofilled');
    return true;
  }

  return false;
}

// Auto-fill eBay form
async function autofillEbayForm(listing, variation) {
  try {
    showOverlay('Auto-filling eBay listing...', 'loading');

    // Wait for form to load
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Title
    const titleInput =
      document.querySelector('input[name="title"]') ||
      document.querySelector('#listing-title') ||
      document.querySelector('[data-testid="listing-title"]');

    if (titleInput) {
      setInputValue(titleInput, variation.title || listing.title);
      console.log('[QuickList] Title filled');
    }

    // Description
    const descriptionTextarea =
      document.querySelector('textarea[name="description"]') ||
      document.querySelector('#description') ||
      document.querySelector('[data-testid="description"]');

    if (descriptionTextarea) {
      setTextareaValue(descriptionTextarea, variation.description || listing.description);
      console.log('[QuickList] Description filled');
    }

    // Price
    const priceInput =
      document.querySelector('input[name="price"]') ||
      document.querySelector('#price') ||
      document.querySelector('[data-testid="price"]');

    if (priceInput) {
      setInputValue(priceInput, listing.price.toString());
      console.log('[QuickList] Price filled');
    }

    // Condition
    const conditionSelect =
      document.querySelector('select[name="condition"]') || document.querySelector('#condition');

    if (conditionSelect) {
      selectDropdownOption(conditionSelect, listing.condition);
      console.log('[QuickList] Condition selected');
    }

    // Brand (from item specifics)
    if (variation.itemSpecifics?.Brand) {
      const brandInput =
        document.querySelector('input[name="brand"]') ||
        document.querySelector('[data-testid="brand"]');
      if (brandInput) {
        setInputValue(brandInput, variation.itemSpecifics.Brand);
        console.log('[QuickList] Brand filled');
      }
    }

    // Show success
    showOverlay('✓ eBay form auto-filled successfully!', 'success');

    // Notify popup
    chrome.runtime.sendMessage({
      action: 'autofill_complete',
      platform: 'ebay',
    });

    console.log('[QuickList] eBay auto-fill complete');
  } catch (error) {
    console.error('[QuickList] Auto-fill error:', error);
    showOverlay('Auto-fill failed. Please fill manually.', 'error');

    chrome.runtime.sendMessage({
      action: 'autofill_error',
      platform: 'ebay',
      error: error.message,
    });
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autofill' && message.platform === 'ebay') {
    console.log('[QuickList] Received auto-fill request', message);
    autofillEbayForm(message.listing, message.variation);
    sendResponse({ success: true });
  }
});

// Show initial notification
setTimeout(() => {
  const overlay = showOverlay(
    'QuickList AI ready! Click the extension to auto-fill this form.',
    'info'
  );

  // Add "Select Listing" button
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'quicklist-overlay-actions';
  actionsDiv.innerHTML = `
    <button class="quicklist-btn quicklist-btn-primary" id="quicklist-select-btn">
      Select Listing
    </button>
  `;
  overlay.querySelector('.quicklist-overlay-message').after(actionsDiv);

  // Button click handler
  document.getElementById('quicklist-select-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_popup' });
  });
}, 2000);

console.log('[QuickList] eBay content script initialized');
