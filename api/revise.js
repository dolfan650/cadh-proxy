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

Your job is to revise pasted Canvas HTML fragments for accessibility and instructional clarity while preserving the instructor's original meaning, sequence, and tone.

Follow these rules strictly:

1. Return HTML FRAGMENT ONLY.
2. Do NOT return <!DOCTYPE html>, <html>, <head>, <body>, <main>, <title>, or full-page wrapper code.
3. Preserve valid existing HTML whenever possible.
4. Make the lightest effective revision.
5. If the input is already accessible and well structured, keep it very close to the original.
6. For Canvas content, start headings at <h2>, not <h1>.
7. Convert fake numbered or bulleted lines into proper semantic lists when appropriate.
8. Improve accessibility and semantics only where needed.
9. Do NOT add ARIA attributes unless clearly necessary for accessibility.
10. Do NOT add landmark regions, <section> wrappers, extra ids, aria-labelledby, or aria-describedby unless truly needed.
11. Do NOT convert <strong> to <kbd>.
12. Do NOT invent instructional content, summaries, objectives, or explanations that were not already implied by the content.
13. Do correct obvious grammar, punctuation, spelling, and mechanics errors when meaning is clear.
14. Preserve instructor intent and sequence.
15. Keep output suitable for direct pasting into a Canvas HTML editor.

Revision mode guidance:

- Accessibility Cleanup:
  Focus on accessibility-related structure while preserving the instructor's content and style. Make only necessary corrections.

- Accessibility + Learning Flow Improvements:
  Improve accessibility plus instructional flow and readability, but do not add substantial new instructional content.

- Full Enhancement:
  Improve accessibility, readability, and learning flow more actively, but still stay faithful to the instructor's intent and avoid unnecessary wrappers or overengineering.

Return your answer in exactly this format:

HTML_OUTPUT:
[revised HTML fragment only]

CHANGES_MADE:
- item 1
- item 2
- item 3

REVIEW_ITEMS:
- item 1
- item 2
- item 3

Revision Mode:
${mode}

Page Purpose:
${purpose}

Content Type:
${type}

Canvas HTML:
${inputHtml}
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

    const html_output = cleanHtmlOutput(extractSection(raw, "HTML_OUTPUT", "CHANGES_MADE"));
    const changes_made = cleanTextSection(extractSection(raw, "CHANGES_MADE", "REVIEW_ITEMS"));
    const review_items = cleanTextSection(extractSection(raw, "REVIEW_ITEMS", null));

    return res.status(200).json({
      html_output: html_output || inputHtml,
      changes_made: changes_made || "- No major changes detected.",
      review_items: review_items || "- Review the output before publishing in Canvas.",
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

function extractSection(text, startLabel, endLabel) {
  if (!text || !startLabel) return "";

  const escapedStart = escapeRegex(startLabel);
  const escapedEnd = endLabel ? escapeRegex(endLabel) : null;

  const pattern = escapedEnd
    ? new RegExp(`${escapedStart}:\\s*([\\s\\S]*?)\\s*${escapedEnd}:`, "i")
    : new RegExp(`${escapedStart}:\\s*([\\s\\S]*)`, "i");

  const match = text.match(pattern);
  return match ? match[1].trim() : "";
}

function cleanHtmlOutput(html) {
  if (!html) return "";

  let cleaned = html.trim();

  cleaned = cleaned.replace(/^```html\s*/i, "");
  cleaned = cleaned.replace(/^```\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");

  cleaned = cleaned.replace(/^HTML_OUTPUT:\s*/i, "");
  cleaned = cleaned.replace(/^CHANGES_MADE:\s*/i, "");
  cleaned = cleaned.replace(/^REVIEW_ITEMS:\s*/i, "");

  cleaned = cleaned.replace(/<!DOCTYPE html>/gi, "");
  cleaned = cleaned.replace(/<\/?html[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?head[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?body[^>]*>/gi, "");
  cleaned = cleaned.replace(/<\/?main[^>]*>/gi, "");
  cleaned = cleaned.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");

  return cleaned.trim();
}

function cleanTextSection(text) {
  if (!text) return "";

  let cleaned = text.trim();

  cleaned = cleaned.replace(/^```[\w-]*\s*/i, "");
  cleaned = cleaned.replace(/\s*```$/i, "");
  cleaned = cleaned.replace(/^\s*[-•]?\s*none\.?\s*$/i, "- None.");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
