/**
 * QuickList AI - Depop Auto-Fill Content Script
 * Automatically fills Depop listing forms with QuickList data
 */

console.log('[QuickList] Depop auto-fill script loaded');

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

// Auto-fill Depop form
async function autofillDepopForm(listing, variation) {
  try {
    showOverlay('Auto-filling Depop listing...', 'loading');

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Title/Description - Depop combines these
    const descriptionTextarea =
      document.querySelector('textarea[name="description"]') ||
      document.querySelector('[data-testid="product-description"]') ||
      document.querySelector('textarea.description-input');

    if (descriptionTextarea) {
      const combinedText = `${variation.title || listing.title}\n\n${variation.description || listing.description}`;
      setTextareaValue(descriptionTextarea, combinedText);
      console.log('[QuickList] Description filled');
    }

    // Price
    const priceInput =
      document.querySelector('input[name="price"]') ||
      document.querySelector('[data-testid="product-price"]') ||
      document.querySelector('input[placeholder*="Price"]');

    if (priceInput) {
      setInputValue(priceInput, listing.price.toString());
      console.log('[QuickList] Price filled');
    }

    // Category - Depop uses a dropdown
    if (variation.itemSpecifics?.Category) {
      const categorySelect =
        document.querySelector('select[name="category"]') ||
        document.querySelector('[data-testid="category-select"]');

      if (categorySelect) {
        const categoryMap = {
          "women's clothing": 'Womenswear',
          "men's clothing": 'Menswear',
          accessories: 'Accessories',
          shoes: 'Footwear',
          bags: 'Bags',
          beauty: 'Beauty',
          home: 'Home',
        };

        const depopCategory =
          categoryMap[variation.itemSpecifics.Category.toLowerCase()] ||
          variation.itemSpecifics.Category;

        const option = Array.from(categorySelect.options).find((opt) =>
          opt.textContent.toLowerCase().includes(depopCategory.toLowerCase())
        );

        if (option) {
          categorySelect.value = option.value;
          categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[QuickList] Category selected');
        }
      }
    }

    // Condition
    if (listing.condition) {
      const conditionMap = {
        new: 'Brand new',
        'like new': 'Like new',
        excellent: 'Excellent',
        good: 'Good',
        fair: 'Fair',
      };

      const depopCondition = conditionMap[listing.condition.toLowerCase()] || 'Good';

      // Depop uses radio buttons or buttons for condition
      const conditionBtn = Array.from(
        document.querySelectorAll('[data-testid^="condition-"]') ||
          document.querySelectorAll('.condition-option')
      ).find((btn) => btn.textContent.toLowerCase().includes(depopCondition.toLowerCase()));

      if (conditionBtn) {
        conditionBtn.click();
        console.log('[QuickList] Condition selected');
      }
    }

    // Brand
    if (variation.itemSpecifics?.Brand) {
      const brandInput =
        document.querySelector('input[name="brand"]') ||
        document.querySelector('[data-testid="brand-input"]') ||
        document.querySelector('input[placeholder*="Brand"]');

      if (brandInput) {
        setInputValue(brandInput, variation.itemSpecifics.Brand);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Click first suggestion if dropdown appears
        const firstSuggestion =
          document.querySelector('.brand-suggestion:first-child') ||
          document.querySelector('.autocomplete-item:first-child');
        if (firstSuggestion) {
          firstSuggestion.click();
        }

        console.log('[QuickList] Brand filled');
      }
    }

    // Size
    if (variation.itemSpecifics?.Size) {
      const sizeSelect =
        document.querySelector('select[name="size"]') ||
        document.querySelector('[data-testid="size-select"]');

      if (sizeSelect) {
        const option = Array.from(sizeSelect.options).find(
          (opt) =>
            opt.textContent.toLowerCase() === variation.itemSpecifics.Size.toLowerCase() ||
            opt.value.toLowerCase() === variation.itemSpecifics.Size.toLowerCase()
        );

        if (option) {
          sizeSelect.value = option.value;
          sizeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('[QuickList] Size selected');
        }
      }
    }

    // Color
    if (variation.itemSpecifics?.Color) {
      // Depop uses color buttons
      const colorBtns =
        document.querySelectorAll('[data-testid^="color-"]') ||
        document.querySelectorAll('.color-option');

      const colorBtn = Array.from(colorBtns).find(
        (btn) =>
          btn
            .getAttribute('aria-label')
            ?.toLowerCase()
            .includes(variation.itemSpecifics.Color.toLowerCase()) ||
          btn.textContent.toLowerCase().includes(variation.itemSpecifics.Color.toLowerCase())
      );

      if (colorBtn) {
        colorBtn.click();
        console.log('[QuickList] Color selected');
      }
    }

    // Style/Tags - Depop allows multiple hashtags
    if (variation.itemSpecifics?.Style) {
      const tagsInput =
        document.querySelector('input[name="tags"]') ||
        document.querySelector('[data-testid="style-tags"]');

      if (tagsInput) {
        const tags = variation.itemSpecifics.Style.split(',')
          .map((t) => `#${t.trim()}`)
          .join(' ');
        setInputValue(tagsInput, tags);
        console.log('[QuickList] Style tags filled');
      }
    }

    showOverlay('✓ Depop form auto-filled successfully!', 'success');

    chrome.runtime.sendMessage({
      action: 'autofill_complete',
      platform: 'depop',
    });

    console.log('[QuickList] Depop auto-fill complete');
  } catch (error) {
    console.error('[QuickList] Auto-fill error:', error);
    showOverlay('Auto-fill failed. Please fill manually.', 'error');

    chrome.runtime.sendMessage({
      action: 'autofill_error',
      platform: 'depop',
      error: error.message,
    });
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'autofill' && message.platform === 'depop') {
    console.log('[QuickList] Received auto-fill request', message);
    autofillDepopForm(message.listing, message.variation);
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

console.log('[QuickList] Depop content script initialized');
