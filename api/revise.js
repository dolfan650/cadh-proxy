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
- No markdown.
- No extra text.
- Output must be an HTML fragment only.
- No <html>, <body>, or full document tags.
- Preserve valid HTML when possible.
- Make minimal changes unless accessibility requires more.
- Start headings at <h2>.
- Convert fake lists to real lists.
- Preserve meaning and structure.

MANDATORY ACCESSIBILITY FIXES

- Do not rely on color alone to convey meaning.
- Fix low contrast text.
- Remove font sizes below 14px.
- Replace vague links like "click here".
- Add alt text to images.
- Convert manual lists to semantic lists.

TABLE RULES (STRICT)

- Tables MUST include:
  - caption
  - thead
  - tbody
  - th with scope="col"

- DO NOT remove tables.
- DO NOT flatten tables.

- Preserve or improve readability:
  - borders
  - padding
  - header distinction

CAPTION RULES

- Keep captions short and readable on one line.
- Example: Week 4 schedule and point values

PRE-CHECK

Before returning:
- No color-only meaning
- No tiny fonts
- Tables are complete and readable

Revision Mode: ${mode}
Page Purpose: ${purpose}
Content Type: ${type}

Canvas HTML:
${inputHtml}

Return JSON:
{
  "html_output": "<h2>Example</h2><p>Example</p>",
  "changes_made": ["Change one"],
  "review_items": ["Review one"]
}
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": \`Bearer \${process.env.OPENAI_API_KEY}\`
      },
      body: JSON.stringify({
        model: "gpt-5.3",
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
