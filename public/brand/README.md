# QuickList Brand Assets

## Color Palette

| Name | HEX | RGB | Usage |
|------|-----|-----|-------|
| Cream | #EAE4DA | 234, 228, 218 | Primary text, logos on dark bg |
| Yellow | #EAC119 | 234, 193, 25 | Primary accent, CTAs |
| Pink | #EAA7C8 | 234, 167, 200 | Accent highlight |
| White | #FFFFFF | 255, 255, 255 | - |
| Lavender | #808BC5 | 128, 139, 197 | Secondary accent |
| Teal | #9ED6DF | 158, 214, 223 | Success states |
| Dark | #1D1D1B | 29, 29, 27 | Background, dark text |
| Green | #245E55 | 36, 94, 85 | - |
| Red | #C63F3E | 198, 63, 62 | Error states |

## Logo Files

### QuickList Logo
- `logo-quicklist.svg` - Main wordmark with Q icon (uses currentColor)
- `logo-quicklist-cream.svg` - Cream colored version (#EAE4DA)
- `logo-quicklist-dark.svg` - Dark version (#1D1D1B)

### Marketplace Logos
- `logo-ebay.svg` - eBay wordmark
- `logo-vinted.svg` - Vinted V icon
- `logo-depop.svg` - Depop wordmark
- `logo-gumtree.svg` - Gumtree tree icon

All marketplace logos use `currentColor` for easy theming.

## Usage

### In HTML
```html
<img src="/brand/logo-quicklist.svg" alt="QuickList" class="logo-svg">
```

### In CSS
Logos use `currentColor`, so set the color on the parent:
```css
.logo-svg {
  color: var(--cream); /* #EAE4DA */
}
```

## Typography

| Element | Font | Weight |
|---------|------|--------|
| H tags + Menu | Manrope | Bold (700) |
| Paragraphs | Manrope | Regular (400) |
| Buttons | Manrope | Regular (400) |
| Misc/Tags | IBM Plex Mono | Regular (400) |
