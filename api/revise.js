export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error: "Missing OPENAI_API_KEY environment variable"
    });
  }

  try {
    const {
      html,
      html_b64,
      revisionMode,
      pagePurpose,
      contentType
    } = req.body || {};

    let inputHtml = "";

    if (typeof html_b64 === "string" && html_b64.trim()) {
      inputHtml = Buffer.from(html_b64, "base64").toString("utf-8").trim();
    } else if (typeof html === "string") {
      inputHtml = html.trim();
    }

    const mode =
      typeof revisionMode === "string" && revisionMode.trim()
        ? revisionMode.trim()
        : "Accessibility Cleanup";

    const purpose =
      typeof pagePurpose === "string" ? pagePurpose.trim() : "";

    const type =
      typeof contentType === "string" && contentType.trim()
        ? contentType.trim()
        : "Canvas page";

    if (!inputHtml) {
      return res.status(400).json({
        error: "Missing html input"
      });
    }

    const prompt = `
You are CHAD, a Canvas Accessibility and Design Helper.

Revise the following Canvas HTML fragment for accessibility and instructional clarity.

Rules:
- Return ONLY valid JSON.
- Do not include markdown fences.
- Do not include explanatory text before or after the JSON.
- The "html_output" value must be an HTML fragment only.
- Do not return <!DOCTYPE html>, <html>, <head>, <body>, <main>, or <title>.
- Preserve valid existing HTML whenever possible.
- Make the lightest effective revision UNLESS accessibility issues require stronger changes.
- For Canvas content, start headings at <h2>, not <h1>.
- Convert fake lists into real semantic lists when needed.
- Do not add unnecessary ARIA, wrappers, ids, sections, or landmarks.
- Preserve iframe embeds unless clearly invalid or unsafe.
- Preserve instructor meaning, sequence, emphasis, and embedded content.

MANDATORY ACCESSIBILITY FIXES (MUST BE APPLIED)

- Do not rely on color alone to convey meaning.
- Fix low contrast text.
- Normalize font sizes (remove sizes below 14px).
- Replace vague links like "click here".
- Add alt text to images.
- Convert manual lists into semantic lists.

TABLE RULES (STRICT)

- All data tables MUST include:
  - <caption>
  - <thead> and <tbody>
  - <th scope="col">

- DO NOT remove existing table structure.

- Preserve or improve table styling for readability:
  - Keep or add borders
  - Maintain cell padding
  - Maintain header distinction (background or emphasis)

- DO NOT flatten or strip tables into plain text.

CAPTION RULES

- Captions must be short, clear, and readable on one line.
- Do not introduce awkward line breaks.
- Example: "Week 4 schedule and point values"

PRE-OUTPUT CHECK (REQUIRED)

Before returning HTML, confirm:

- No color-only meaning remains
- No tiny font remains
- Tables include caption + headers
- Table formatting is preserved or improved (not removed)

If any issue exists, fix it before returning output.

Revision Mode: ${mode}
Page Purpose: ${purpose}
Content Type: ${type}

Canvas HTML:
${inputHtml}

Return exactly this JSON shape:
{
  "html_output": "<h2>Example</h2><p>Example</p>",
  "changes_made": [
    "Change one"
  ],
  "review_items": [
    "Review one"
  ]
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a strict accessibility and Canvas design assistant. You must enforce all accessibility and table formatting rules before returning JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", data);
      return res.status(500).json({
        error: "OpenAI request failed",
        details: data
      });
    }

    const raw = data?.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      parsed = extractJsonObject(raw);
    } catch (parseError) {
      console.error("JSON parse error:", parseError, raw);
      return res.status(500).json({
        error: "Model returned invalid JSON",
        raw_response: raw
      });
    }

    let html_output =
      typeof parsed.html_output === "string" ? parsed.html_output.trim() : "";

    let changes_made = Array.isArray(parsed.changes_made)
      ? parsed.changes_made.map(String).join("\\n")
      : "";

    let review_items = Array.isArray(parsed.review_items)
      ? parsed.review_items.map(String).join("\\n")
      : "";

    html_output = cleanHtml(html_output);

    return res.status(200).json({
      html_output,
      changes_made: toBullets(changes_made),
      review_items: toBullets(review_items),
      raw_response: raw
    });
  } catch (error) {
    console.error("Function error:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
}
