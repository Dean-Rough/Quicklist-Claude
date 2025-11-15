# QuickList AI Chrome Extension

Auto-fill marketplace listings with AI-generated product data across eBay, Vinted, Depop, and Facebook Marketplace.

## 🚀 Quick Start

### Load Extension in Chrome (Development Mode)

1. **Open Chrome Extensions Page:**

   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode:**
   - Toggle the "Developer mode" switch in the top right

3. **Load Unpacked Extension:**
   - Click "Load unpacked"
   - Navigate to: `/Users/deannewton/Projects/QLC/Quicklist-Claude/chrome-extension`
   - Click "Select"

4. **Verify Installation:**
   - Extension should appear in extensions list
   - Pin the extension to toolbar for easy access

### Using the Extension

1. **Sign In:**
   - Click the QuickList extension icon
   - Click "Sign in with QuickList"
   - Complete authentication at quicklist.it.com

2. **Create Listings in QuickList:**
   - Go to https://quicklist.it.com
   - Upload product images
   - Generate AI listing

3. **Auto-Fill Marketplace Forms:**
   - Navigate to a supported marketplace:
     - eBay: Sell form
     - Vinted: Create listing
     - Depop: Add product
     - Facebook: Marketplace create listing
   - Extension will show "QuickList AI ready!" overlay
   - Click extension icon
   - Select a listing from the grid
   - Form auto-fills instantly! ⚡

## 🎯 Supported Marketplaces

| Platform     | URL Pattern                       | Fields Auto-Filled                                                      |
| ------------ | --------------------------------- | ----------------------------------------------------------------------- |
| **eBay**     | `ebay.com/sl/sell`                | Title, Description, Price, Condition, Brand                             |
| **Vinted**   | `vinted.co.uk/items/new`          | Title, Description, Price, Brand, Category, Condition, Size, Color      |
| **Depop**    | `depop.com/products/create`       | Title+Description, Price, Category, Condition, Brand, Size, Color, Tags |
| **Facebook** | `facebook.com/marketplace/create` | Title, Price, Category, Condition, Description, Brand, Tags             |

## 🔧 Features

- ✅ One-click auto-fill across 4 major marketplaces
- ✅ Listing sync from QuickList API (5-min intervals)
- ✅ Offline access to cached listings
- ✅ Platform-specific field mapping
- ✅ Visual feedback (overlays, badges)
- ✅ Search/filter saved listings
- ✅ Marketplace auto-detection

## 📁 File Structure

```
chrome-extension/
├── manifest.json           # Extension config (Manifest v3)
├── background/
│   └── service-worker.js   # Background script
├── popup/
│   ├── popup.html          # Extension popup UI
│   ├── popup.js            # Popup logic
│   └── popup.css           # Popup styling
├── content/
│   ├── ebay-autofill.js    # eBay auto-fill script
│   ├── vinted-autofill.js  # Vinted auto-fill script
│   ├── depop-autofill.js   # Depop auto-fill script
│   ├── facebook-autofill.js # Facebook auto-fill script
│   └── quicklist-overlay.css # Shared overlay styles
└── icons/
    ├── icon-16.png         # Toolbar icon (16x16)
    ├── icon-32.png         # Toolbar icon retina (32x32)
    ├── icon-48.png         # Extension management (48x48)
    ├── icon-128.png        # Chrome Web Store (128x128)
    └── icon.svg            # Source SVG template
```

## 🐛 Debugging

### View Console Logs

**Background Script:**

```
chrome://extensions/ → QuickList AI → "service worker" link
```

**Content Scripts:**

```
F12 Developer Tools → Console (on marketplace page)
```

**Popup:**

```
Right-click extension icon → "Inspect popup"
```

### Common Issues

**Extension doesn't load:**

- Check for errors on `chrome://extensions/`
- Verify all required files exist
- Check manifest.json syntax

**Auto-fill not working:**

- Check console for content script errors
- Verify you're on the correct marketplace URL
- Ensure listing data has required fields

**Authentication fails:**

- Clear extension storage: `chrome.storage.local.clear()`
- Sign in again via popup

## 🔐 Permissions Explained

| Permission                   | Reason                              |
| ---------------------------- | ----------------------------------- |
| `storage`                    | Save auth token and cached listings |
| `activeTab`                  | Detect current marketplace          |
| `scripting`                  | Inject auto-fill scripts            |
| `ebay.com/*`                 | Auto-fill eBay listings             |
| `vinted.co.uk/*`             | Auto-fill Vinted listings           |
| `depop.com/*`                | Auto-fill Depop listings            |
| `facebook.com/marketplace/*` | Auto-fill Facebook Marketplace      |
| `quicklist.it.com/*`         | API authentication and data sync    |

## 📦 Publishing to Chrome Web Store

### Before Publishing:

1. **Create Production Icons:**
   - Replace placeholder PNGs with high-quality icons
   - Recommended: Use SVG → PNG converter at 16, 48, 128px

2. **Update manifest.json:**
   - Increment version number
   - Add detailed description
   - Add promotional images (1280x800, 640x400, 440x280)

3. **Test Thoroughly:**
   - Test on all 4 marketplaces
   - Test authentication flow
   - Test offline mode
   - Test error handling

4. **Prepare Web Store Listing:**
   - Screenshots (1280x800 or 640x400)
   - Detailed description
   - Privacy policy URL
   - Support email

### Publishing Steps:

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Pay one-time $5 developer fee (if first extension)
3. Click "New Item"
4. Upload ZIP of `chrome-extension/` folder
5. Fill in store listing details
6. Submit for review (typically 1-3 days)

## 🔄 Development Workflow

1. **Make changes to extension files**
2. **Reload extension:**
   - Go to `chrome://extensions/`
   - Click reload icon on QuickList AI card
3. **Test changes:**
   - Navigate to marketplace
   - Open extension popup
   - Verify auto-fill works

## 📊 Analytics & Monitoring

Currently, the extension logs events to console. For production:

- Consider adding Google Analytics for Extensions
- Track auto-fill success/failure rates
- Monitor API response times
- Log marketplace detection accuracy

## 🚧 Known Limitations

1. **Marketplace UI Changes:** If eBay/Vinted/etc update their UI, selectors may break
2. **No Image Upload:** Extension doesn't upload product images (user must do manually)
3. **Single Listing per Form:** Can't batch-fill multiple listings
4. **No Cross-Platform Sync:** Listings only sync from QuickList API, not between devices

## 🛠 Future Enhancements

- [ ] Add image upload support
- [ ] Support more marketplaces (Mercari, Poshmark, OfferUp)
- [ ] Batch listing creation
- [ ] Chrome Web Store publication
- [ ] Analytics dashboard
- [ ] Error recovery & retry logic
- [ ] Accessibility improvements (ARIA labels)
- [ ] Localization (i18n)

## 📝 Version History

### v1.0.0 (Current)

- Initial release
- Support for eBay, Vinted, Depop, Facebook Marketplace
- Basic auto-fill functionality
- QuickList API integration

---

**Support:** For issues or questions, visit https://quicklist.it.com/support
