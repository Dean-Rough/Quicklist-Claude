/**
 * QuickList AI - Vinted Auto-Fill Content Script
 * Automatically fills Vinted listing forms with QuickList data
 */

console.log('[QuickList] Vinted auto-fill script loaded');

// Show overlay notification
function showOverlay(message, type = 'info') {
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

  setTimeout(() => overlay.remove(), 5000);

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

  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));

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

// Click button/label by text content
function clickByText(selector, text) {
  const elements = Array.from(document.querySelectorAll(selector));
  const element = elements.find((el) => el.textContent.toLowerCase().includes(text.toLowerCase()));

  if (element) {
    element.click();
    return true;
  }

  return false;
}

// Auto-fill Vinted form
async function autofillVintedForm(listing, variation) {
  try {
    showOverlay('Auto-filling Vinted listing...', 'loading');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Title
    const titleInput =
      document.querySelector('input[name="title"]') ||
      document.querySelector('[data-testid="item-title"]') ||
      document.querySelector('input[placeholder*="Title"]');

    if (titleInput) {
      setInputValue(titleInput, variation.title || listing.title);
      console.log('[QuickList] Title filled');
    }

    // Description
    const descriptionTextarea =
      document.querySelector('textarea[name="description"]') ||
      document.querySelector('[data-testid="item-description"]') ||
      document.querySelector('textarea[placeholder*="Description"]');

    if (descriptionTextarea) {
      setTextareaValue(descriptionTextarea, variation.description || listing.description);
      console.log('[QuickList] Description filled');
    }

    // Price
    const priceInput =
      document.querySelector('input[name="price"]') ||
      document.querySelector('[data-testid="item-price"]') ||
      document.querySelector('input[placeholder*="Price"]');

    if (priceInput) {
      setInputValue(priceInput, listing.price.toString());
      console.log('[QuickList] Price filled');
    }

    // Category - Vinted uses a multi-step category selector
    if (variation.itemSpecifics?.Category) {
      const categoryBtn =
        document.querySelector('[data-testid="category-select"]') ||
        document.querySelector('button[aria-label*="Category"]');

      if (categoryBtn) {
        categoryBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        clickByText('.category-option', variation.itemSpecifics.Category);
        console.log('[QuickList] Category selected');
      }
    }

    // Condition
    if (listing.condition) {
      const conditionMap = {
        new: 'Brand new with tags',
        'like new': 'Brand new without tags',
        excellent: 'Very good condition',
        good: 'Good condition',
        fair: 'Satisfactory condition',
      };

      const vintedCondition = conditionMap[listing.condition.toLowerCase()] || 'Good condition';
      clickByText('[data-testid="condition-option"]', vintedCondition);
      console.log('[QuickList] Condition selected');
    }

    // Brand (from item specifics)
    if (variation.itemSpecifics?.Brand) {
      const brandInput =
        document.querySelector('input[name="brand"]') ||
        document.querySelector('[data-testid="brand-input"]');
      if (brandInput) {
        setInputValue(brandInput, variation.itemSpecifics.Brand);
        console.log('[QuickList] Brand filled');
      }
    }

    // Size (from item specifics)
    if (variation.itemSpecifics?.Size) {
      const sizeBtn = document.querySelector('[data-testid="size-select"]');
      if (sizeBtn) {
        sizeBtn.click();
        await new Promise((resolve) => setTimeout(resolve, 500));
        clickByText('.size-option', variation.itemSpecifics.Size);
        console.log('[QuickList] Size selected');
      }
    }

    // Color (from item specifics)
    if (variation.itemSpecifics?.Color) {
      const colorInput =
        document.querySelector('input[name="color"]') ||
        document.querySelector('[data-testid="color-input"]');
      if (colorInput) {
        setInputValue(colorInput, variation.itemSpecifics.Color);
        console.log('[QuickList] Color filled');
      }
    }

    showOverlay('✓ Vinted form auto-filled successfully!', 'success');

    chrome.runtime.sendMessage({
      action: 'autofill_complete',
      platform: 'vinted',
    });

    console.log('[QuickList] Vinted auto-fill complete');
  } catch (error) {
    console.error('[QuickList] Auto-fill error:', error);
    showOverlay('Auto-fill failed. Please fill manually.', 'error');

    chrome.runtime.sendMessage({
      action: 'autofill_error',
      platform: 'vinted',
      error: error.message,
    });
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autofill' && message.platform === 'vinted') {
    console.log('[QuickList] Received auto-fill request', message);
    autofillVintedForm(message.listing, message.variation);
    sendResponse({ success: true });
  }
});

// Show initial notification
setTimeout(() => {
  const overlay = showOverlay(
    'QuickList AI ready! Click the extension to auto-fill this form.',
    'info'
  );

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'quicklist-overlay-actions';
  actionsDiv.innerHTML = `
    <button class="quicklist-btn quicklist-btn-primary" id="quicklist-select-btn">
      Select Listing
    </button>
  `;
  overlay.querySelector('.quicklist-overlay-message').after(actionsDiv);

  document.getElementById('quicklist-select-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_popup' });
  });
}, 2000);

console.log('[QuickList] Vinted content script initialized');
