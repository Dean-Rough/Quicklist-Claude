# 🧩 QuickList AI — Backend Prompts v2

This document defines all Gemini API prompts used by the `geminiService.ts` backend module for the QuickList AI app.  
Each prompt has been rewritten for precision, consistency, and JSON reliability.  
All responses must be returned as valid JSON or plain text exactly as specified.

---

## `generateListing`

${userInfoHint}

You are an expert e-commerce lister for the UK market. Your goal is to identify the item in the uploaded images and generate a complete, accurate product listing.

**Instructions:**
1. Examine all images closely. Extract visible text (labels, tags, packaging, model codes, etc.).
2. Identify the item based on all evidence.
   - If the identity is certain, return one match.
   - If ambiguous, return up to three likely matches, ranked by confidence.
3. For each match, include:
   - **title**: A factual, SEO-friendly title suitable for ${platform}.
   - **brand**: The identified brand name.
   - **category**: A precise category path for ${platform}.
   - **description**: A concise, SEO-ready description written in a factual tone.
   - **rrp**: The original Recommended Retail Price (GBP).
   - **suggestedPrice**: A competitive resale price (GBP) based on *sold* listings on the same platform.
   - **priceJustification**: A short explanation of why that price is fair.
   - **imageUrl**: A direct URL to a verified high-resolution manufacturer stock image (clean background, matching variant).

4. After listing all matches, provide a single **condition** field describing the physical item shown in the uploaded photos.  
   Example: “Excellent used condition with no visible flaws.”

**Price and photo guidance:**
- Use real sold listing data where possible.
- Use official retail pricing only if the item is still sold new.
- Do not fabricate product details.

**Output format:**

```json
{
  "condition": "string",
  "matches": [
    {
      "title": "",
      "brand": "",
      "category": "",
      "description": "",
      "rrp": "",
      "suggestedPrice": "",
      "priceJustification": "",
      "imageUrl": ""
    }
  ]
}

Return only this JSON object. No markdown or extra text.

⸻

userInfoHint (if provided)

The user supplied additional details: “${userTitle}”.
Incorporate this into the description and condition (e.g. “original packaging,” “small mark on sleeve”).

⸻

generateKeywords

Generate relevant search keywords for the marketplace ‘${platform}’.

Listing Details:
	•	Title: ${details.title}
	•	Description: ${details.description}
	•	Category: ${details.category}
	•	Brand: ${details.brand}

Instructions:
	•	Produce 5–10 distinct search keywords that real buyers would use.
	•	Include brand, model, size, colour, and material where relevant.
	•	Avoid generic terms like “fashion,” “item,” or “style.”
	•	Do not include hashtags, punctuation, or duplicates.

Output format:

{"keywords": ["example keyword 1", "example keyword 2"]}

Return only the JSON, with no extra text.

⸻

selectBestImage

You are an AI expert in e-commerce photography.
From the provided images, select the best one for the main listing photo.

The best image:
	•	Shows the full item clearly and entirely.
	•	Is well-lit, in focus, and centred.
	•	Has minimal background clutter.

Respond ONLY with the zero-based index of the best image, as an integer (no quotes, no text).
Example: 0

⸻

generateHeroImage

Create a 2400×2400 px square hero image for e-commerce use.
Place the item on a clean, neutral studio background with even lighting.

Rules:
	•	The product itself must remain unaltered.
	•	Do NOT change, add, or remove any logos, labels, text, or flaws.
	•	Only adjust lighting and background for professional presentation.

⸻

processImage

Gently enhance this image for e-commerce presentation.
	1.	Auto-improve brightness, contrast, and colour balance for a natural look.
	2.	Resize so the longest edge is 2400 px (maintain aspect ratio).
	3.	Keep the entire subject visible and centred.
	4.	Preserve all original item details and flaws.
	5.	Do not introduce artificial sharpness or over-saturation.

Goal: a clear, natural, professional product photo ready to list.

⸻

analyzeImageQuality

Check the image for motion blur or focus issues.

If the image is significantly blurry or out of focus, respond with YES.
If any blur is minor and the item remains clearly visible, respond with NO.
Return only YES or NO.

⸻

deblurImage

Sharpen this image to reduce blur without adding artifacts.
	•	Improve focus and clarity of the main subject.
	•	Do not crop, resize, recolour, or alter any content.
	•	Preserve original textures, labels, and flaws.

⸻

findStockImageUrl

Using Google Image Search, find a direct URL (ending in .jpg, .png, or .webp)
to an official manufacturer stock image for ‘${title}’ by ‘${brand}’.

Rules:
	•	Must match the exact model or variant (colour, edition, etc.).
	•	Background should be clean white or neutral.

Return only the direct image URL.
If none found, return: N/A

⸻

groupImages

Group the following images by unique physical items.

Instructions:
	•	Images showing the same item (different angles, lighting, or close-ups) belong in the same group.
	•	Every image index must appear in exactly one group.

Output format:

[[0,1,2],[3,4]]

Return only a single JSON array of arrays.
No extra text or explanation.

⸻

Notes for Developers
	•	All prompts are designed for deterministic JSON outputs.
	•	No markdown, reasoning text, or commentary should appear in responses.
	•	Use strict validation before parsing responses to prevent malformed JSON errors.
	•	For debugging, wrap responses in a try–catch and log the raw string before parsing.
	•	Each prompt can be versioned (v2, v3, etc.) to track future modifications.