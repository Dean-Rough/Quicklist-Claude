# Backend Prompts for QuickList AI

This file documents all the prompts sent to the Gemini API from the `geminiService.ts` backend module.

## `generateListing`

This prompt is used to generate a full product listing from a set of images. It can be modified with a `userTitle` hint.

```
${userInfoHint}
You are an expert e-commerce lister for the UK market. Your primary goal is to accurately identify the item in the images.
- **Examine all images thoroughly.** Pay extremely close attention to details like labels, tags, and packaging.
- **Extract all text.** Look for brand names, product names, model numbers, product codes (SKUs), and material composition. This text is crucial for correct identification.

Based on your analysis, identify the item.
- If you are highly confident about the item's identity, provide one single match.
- If there is ambiguity (e.g., similar models, unclear tags), provide up to 3 of the most likely matches.

For EACH potential match, provide the following details:
1.  **Title:** A factual, SEO-friendly title.
2.  **Brand:** The identified brand.
3.  **Category:** A precise category path for the '${platform}' platform.
4.  **Description:** A compelling, SEO-friendly marketing description for this specific item.
5.  **RRP:** The original Recommended Retail Price (RRP) in GBP (£).
6.  **Suggested Listing Price:** A competitive listing price in GBP (£) based on recently sold listings.
7.  **Price Justification:** A brief justification for the suggested price.
8.  **Image URL:** A direct URL to a high-resolution, official manufacturer's stock product image for this specific item. This is for user confirmation.

In addition to the per-match details, provide a single, overall condition analysis based on the user's uploaded photos. This should apply to all matches as it describes the physical item shown.
- **Condition:** Scrutinize the images for any permanent damage. Describe any findings clearly. If none, state 'Excellent used condition with no visible flaws.'.

Your entire response MUST be a single, valid JSON object. Do not include any text before or after the JSON. The JSON object should have a single key "matches", which is an array of objects. Each object in the array represents a potential match and must contain the keys: "title", "brand", "category", "description", "rrp", "suggestedPrice", "priceJustification", "condition", and "imageUrl".
```

**`userInfoHint` (if provided):**

```
The user has provided extra information about the item and its condition: "${userTitle}". You MUST incorporate this information into your generated description and condition report where relevant. For example, if they mention 'original packaging', ensure it's in the description. If they mention a specific flaw, detail it in the condition section. This information is a direct instruction.
```

---

## `generateKeywordsAndHashtags`

This prompt generates keywords and hashtags based on existing listing details.

```
Based on the following product listing for the marketplace '${platform}', generate relevant keywords and hashtags to maximize visibility and searchability.

  **Listing Details:**
  - **Title:** ${details.title}
  - **Description:** ${details.description}
  - **Category:** ${details.category}
  - **Brand:** ${details.brand}

  **Instructions:**
  - Generate 5-10 highly relevant keywords. These should be search terms potential buyers would use.
  - Generate 5-10 relevant hashtags. For platforms like Vinted, these are crucial for discovery.
  - The keywords and hashtags should be distinct and not just variations of each other.

  Your response MUST be a single, valid JSON object. Do not include any text before or after the JSON. The JSON object must have two keys: "keywords" (an array of strings) and "hashtags" (an array of strings, without the '#' symbol).
  Example: {"keywords": ["men's jacket", "windbreaker", "size large"], "hashtags": ["nikevintage", "90sfashion", "streetwear"]}
```

---

## `selectBestImage`

This prompt selects the best image from a set to be used as the primary photo.

```
You are an AI expert in e-commerce photography. Your task is to select the best primary photo from a set of images for a product listing. Analyze the following images and determine which one provides the clearest, most comprehensive view of the entire item. The ideal image should be well-lit, in focus, and show the product in its entirety.

Respond with ONLY the zero-based index of the best image. For example, if the first image is the best, respond with "0". Do not provide any other text, explanation, or formatting.
```

---

## `generateHeroImage`

This prompt generates a professional "hero" image with a clean background.

```
Create a professional e-commerce hero image from the provided photo. Place the item on a clean, neutral studio backdrop with professional studio lighting. The final image should be a square (1:1 aspect ratio) 2400x2400px professional product photo. **CRITICAL:** The item itself must be an exact, unaltered replica from the original photo. Do not add, remove, or modify any text, logos, labels, patterns, textures, or small details. All original characteristics, including any wear and tear or flaws, must be perfectly preserved. The only permitted changes are the background and lighting.
```

---

## `processImage`

This prompt enhances and/or resizes an image. The prompt is constructed dynamically.

**Base parts:**

- **Enhance:** `Gently auto-improve this image. Adjust brightness, contrast, and color balance for a more natural and clear look.`
- **Resize:** `Resize the image so its longest edge is 2400 pixels while maintaining the original aspect ratio. Do not crop the image. The main subject should be fully visible and centered.`
- **Suffix:** `Preserve all original details and flaws of the item itself. The goal is a professional, ready-to-list e-commerce photo.`

**Example combined prompt:**

```
Gently auto-improve this image. Adjust brightness, contrast, and color balance for a more natural and clear look. Resize the image so its longest edge is 2400 pixels while maintaining the original aspect ratio. Do not crop the image. The main subject should be fully visible and centered. Preserve all original details and flaws of the item itself. The goal is a professional, ready-to-list e-commerce photo.
```

---

## `analyzeImageQuality`

This prompt checks if an image is blurry.

```
Analyze the provided image for quality issues, specifically focusing on motion blur or being out of focus. Is the image significantly blurry? Respond with only 'YES' or 'NO'.
```

---

## `deblurImage`

This prompt attempts to deblur a blurry image.

```
Deblur this image to make it sharper and clearer for an e-commerce listing. Focus on improving the clarity of the main subject without creating unnatural artifacts. Preserve all original details and flaws of the item itself.
```

---

## `findStockImageUrl`

This prompt uses Google Search to find a stock image URL for a product.

```
Using Google Search, find a direct URL to a single, high-resolution, official manufacturer's stock product image for '${title}' by '${brand}'.
The image should have a clean, white, or neutral background, suitable for an e-commerce listing.
Return ONLY the direct image URL (e.g., ending in .jpg, .png, .webp).
If a suitable, direct image URL cannot be found, return the exact text 'N/A'. Do not provide any other explanation or text.
```

---

## `groupImages`

This prompt groups a set of images based on the distinct physical items shown.

```
You are an expert at sorting product photos. Your task is to group a set of images based on the distinct physical item shown in each.

- Examine all images carefully.
- Identify the unique items. Photos showing the same item from different angles, in different lighting, or with different close-ups belong in the same group.
- Group the images by providing the zero-based indices of all the photos that belong to each unique item.
- Every image index from the input must appear in exactly one group.
```
