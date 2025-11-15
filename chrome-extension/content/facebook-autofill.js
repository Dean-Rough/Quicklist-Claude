/**
 * QuickList AI - Facebook Marketplace Auto-Fill Content Script
 * Automatically fills Facebook Marketplace listing forms with QuickList data
 */

console.log('[QuickList] Facebook Marketplace auto-fill script loaded');

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

// Set input value and trigger React events
function setInputValue(input, value) {
  if (!input || !value) return false;

  // Facebook uses React, need to trigger native setter
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  ).set;

  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  ).set;

  const setter = input.tagName === 'TEXTAREA' ? nativeTextAreaValueSetter : nativeInputValueSetter;

  setter.call(input, value);

  // Trigger React events
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));

  input.classList.add('quicklist-autofilled');

  return true;
}

// Click element with React handling
function clickElement(element) {
  if (!element) return false;

  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  return true;
}

// Find and click option by text
function clickOptionByText(text, wait = 500) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const options = Array.from(
        document.querySelectorAll('[role="option"]') ||
          document.querySelectorAll('[role="menuitem"]') ||
          document.querySelectorAll('.marketplace-composer-option')
      );

      const option = options.find((opt) =>
        opt.textContent.toLowerCase().includes(text.toLowerCase())
      );

      if (option) {
        clickElement(option);
        resolve(true);
      } else {
        resolve(false);
      }
    }, wait);
  });
}

// Auto-fill Facebook Marketplace form
async function autofillFacebookForm(listing, variation) {
  try {
    showOverlay('Auto-filling Facebook Marketplace listing...', 'loading');

    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Title
    const titleInput =
      document.querySelector('input[placeholder*="What are you selling"]') ||
      document.querySelector('input[aria-label*="Title"]') ||
      document.querySelector('[name="title"]');

    if (titleInput) {
      setInputValue(titleInput, variation.title || listing.title);
      console.log('[QuickList] Title filled');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Price
    const priceInput =
      document.querySelector('input[placeholder*="Price"]') ||
      document.querySelector('input[aria-label*="Price"]') ||
      document.querySelector('input[type="number"]');

    if (priceInput) {
      setInputValue(priceInput, listing.price.toString());
      console.log('[QuickList] Price filled');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Category - Facebook uses a dropdown
    if (variation.itemSpecifics?.Category) {
      const categoryBtn =
        document.querySelector('[aria-label*="Category"]') ||
        Array.from(document.querySelectorAll('span')).find((span) =>
          span.textContent.includes('Category')
        )?.nextElementSibling;

      if (categoryBtn) {
        clickElement(categoryBtn);
        await clickOptionByText(variation.itemSpecifics.Category);
        console.log('[QuickList] Category selected');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Condition
    if (listing.condition) {
      const conditionMap = {
        new: 'New',
        'like new': 'Like New',
        excellent: 'Good',
        good: 'Fair',
        fair: 'Poor',
      };

      const fbCondition = conditionMap[listing.condition.toLowerCase()] || 'Good';

      const conditionBtn =
        document.querySelector('[aria-label*="Condition"]') ||
        Array.from(document.querySelectorAll('span')).find(
          (s) => s.textContent.trim() === 'Condition'
        )?.nextElementSibling;

      if (conditionBtn) {
        clickElement(conditionBtn);
        await clickOptionByText(fbCondition);
        console.log('[QuickList] Condition selected');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // Description
    const descriptionTextarea =
      document.querySelector('textarea[placeholder*="Describe"]') ||
      document.querySelector('textarea[aria-label*="Description"]') ||
      document.querySelector('[contenteditable="true"][role="textbox"]');

    if (descriptionTextarea) {
      if (descriptionTextarea.hasAttribute('contenteditable')) {
        // Facebook sometimes uses contenteditable div
        descriptionTextarea.textContent = variation.description || listing.description;
        descriptionTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        setInputValue(descriptionTextarea, variation.description || listing.description);
      }
      console.log('[QuickList] Description filled');
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Brand (if applicable)
    if (variation.itemSpecifics?.Brand) {
      const brandInput =
        document.querySelector('input[placeholder*="Brand"]') ||
        document.querySelector('input[aria-label*="Brand"]');

      if (brandInput) {
        setInputValue(brandInput, variation.itemSpecifics.Brand);
        console.log('[QuickList] Brand filled');
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Location - auto-fill with default or detect
    const locationInput =
      document.querySelector('input[placeholder*="Location"]') ||
      document.querySelector('input[aria-label*="Location"]');

    if (locationInput && !locationInput.value) {
      // Facebook usually auto-fills this, but we can set a default
      console.log('[QuickList] Location detected or skipped');
    }

    // Tags/Keywords (if Facebook supports)
    if (variation.itemSpecifics?.Style) {
      const tagsInput =
        document.querySelector('input[placeholder*="Tags"]') ||
        document.querySelector('input[aria-label*="Tags"]');

      if (tagsInput) {
        setInputValue(tagsInput, variation.itemSpecifics.Style);
        console.log('[QuickList] Tags filled');
      }
    }

    showOverlay('✓ Facebook Marketplace form auto-filled successfully!', 'success');

    chrome.runtime.sendMessage({
      action: 'autofill_complete',
      platform: 'facebook',
    });

    console.log('[QuickList] Facebook Marketplace auto-fill complete');
  } catch (error) {
    console.error('[QuickList] Auto-fill error:', error);
    showOverlay('Auto-fill failed. Please fill manually.', 'error');

    chrome.runtime.sendMessage({
      action: 'autofill_error',
      platform: 'facebook',
      error: error.message,
    });
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autofill' && message.platform === 'facebook') {
    console.log('[QuickList] Received auto-fill request', message);
    autofillFacebookForm(message.listing, message.variation);
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

console.log('[QuickList] Facebook Marketplace content script initialized');
