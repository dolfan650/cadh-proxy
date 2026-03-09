export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { html, revisionMode, pagePurpose, contentType } = req.body;

    const prompt = `
You are an accessibility and instructional design assistant.

Revise the following Canvas HTML according to the selected revision mode.

Important rules:
- Return HTML FRAGMENT ONLY.
- Do NOT return <!DOCTYPE html>.
- Do NOT return <html>, <head>, <body>, <main>, or <title> tags.
- Preserve the instructor's meaning and sequence.
- Use accessible semantic HTML.
- For Canvas content, start headings at <h2>, not <h1>.
- Convert fake numbered or bulleted lines into proper HTML lists when appropriate.
- Do not add explanations outside the required format.

Revision Mode:
${revisionMode || ""}

Page Purpose:
${pagePurpose || ""}

Content Type:
${contentType || ""}

Canvas HTML:
${html || ""}

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
            content: "You revise Canvas HTML for accessibility and instructional clarity."
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

    const raw = data.choices?.[0]?.message?.content || "";

    const htmlMatch = raw.match(/HTML_OUTPUT:\s*([\s\S]*?)\s*CHANGES_MADE:/i);
    const changesMatch = raw.match(/CHANGES_MADE:\s*([\s\S]*?)\s*REVIEW_ITEMS:/i);
    const reviewMatch = raw.match(/REVIEW_ITEMS:\s*([\s\S]*)/i);

    const html_output = htmlMatch ? htmlMatch[1].trim() : "";
    const changes_made = changesMatch ? changesMatch[1].trim() : "";
    const review_items = reviewMatch ? reviewMatch[1].trim() : "";

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
