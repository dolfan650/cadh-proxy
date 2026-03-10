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
    const { html, revisionMode, pagePurpose, contentType } = req.body || {};

    const inputHtml = typeof html === "string" ? html.trim() : "";
    const mode = typeof revisionMode === "string" ? revisionMode.trim() : "Accessibility Cleanup";
    const purpose = typeof pagePurpose === "string" ? pagePurpose.trim() : "";
    const type = typeof contentType === "string" ? contentType.trim() : "Canvas page";

    if (!inputHtml) {
      return res.status(400).json({
        error: "Missing html input"
      });
    }

    const prompt = `
You are CADH, a Canvas Accessibility and Design Helper.

Revise the following Canvas HTML fragment for accessibility and instructional clarity.

Rules:
- Return HTML fragment only, not a full HTML document.
- Do not return <!DOCTYPE html>, <html>, <head>, <body>, <main>, or <title>.
- Preserve valid existing HTML whenever possible.
- Make the lightest effective revision.
- For Canvas content, start headings at <h2>, not <h1>.
- Convert fake lists into real semantic lists when needed.
- Do not add unnecessary ARIA, wrappers, ids, sections, or landmarks.
- Do not convert <strong> to <kbd>.
- Correct obvious grammar, punctuation, spelling, and mechanics issues when meaning is clear.
- Preserve instructor meaning and sequence.

Revision Mode: ${mode}
Page Purpose: ${purpose}
Content Type: ${type}

Canvas HTML:
${inputHtml}

Return your answer in exactly this structure:

HTML_OUTPUT:
[revised html]

CHANGES_MADE:
- item
- item

REVIEW_ITEMS:
- item
- item
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: "You are a careful accessibility and instructional design assistant for Canvas HTML."
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

    // More forgiving parsing
    let html_output = "";
    let changes_made = "";
    let review_items = "";

    const htmlStart = raw.indexOf("HTML_OUTPUT:");
    const changesStart = raw.indexOf("CHANGES_MADE:");
    const reviewStart = raw.indexOf("REVIEW_ITEMS:");

    if (htmlStart !== -1 && changesStart !== -1) {
      html_output = raw
        .substring(htmlStart + "HTML_OUTPUT:".length, changesStart)
        .trim();
    }

    if (changesStart !== -1 && reviewStart !== -1) {
      changes_made = raw
        .substring(changesStart + "CHANGES_MADE:".length, reviewStart)
        .trim();
    }

    if (reviewStart !== -1) {
      review_items = raw
        .substring(reviewStart + "REVIEW_ITEMS:".length)
        .trim();
    }

    // Cleanup code fences and forbidden wrappers
    html_output = cleanHtml(html_output);

    // Strong fallback behavior
    if (!html_output) {
      html_output = inputHtml;
    }
    if (!changes_made) {
      changes_made = "- Reviewed the HTML and preserved the original structure where possible.";
    }
    if (!review_items) {
      review_items = "- Review the output before publishing in Canvas.";
    }

    return res.status(200).json({
      html_output,
      changes_made,
      review_items,
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
function cleanHtml(html) {
  let cleaned = (html || "").trim();

  cleaned = cleaned.replace(/^```html/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  cleaned = cleaned.replace(/<!DOCTYPE html>/gi, "");
  cleaned = cleaned.replace(/<\/?html[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?head[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?body[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?main[^>]*>/gi, "");
  cleaned = cleaned.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");

  // Remove commas immediately after a closing HTML tag, like </p>, or </ol>,
  cleaned = cleaned.replace(/(>),(\s*)$/g, "$1");
  cleaned = cleaned.replace(/(<\/[a-z0-9]+>),/gi, "$1");

  // Remove a trailing comma at the very end, with or without whitespace
  cleaned = cleaned.replace(/,\s*$/g, "");

  return cleaned.trim();
}
