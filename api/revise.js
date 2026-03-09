export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { html, revisionMode, pagePurpose, contentType } = req.body;

    const prompt = `
You are an accessibility and instructional design assistant.

Task:
Revise the following Canvas HTML according to the selected revision mode.

Revision Mode:
${revisionMode || ""}

Page Purpose:
${pagePurpose || ""}

Content Type:
${contentType || ""}

Canvas HTML:
${html || ""}

Return ONLY revised HTML.
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
        ],
        temperature: 0.2
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

    const revised_html = data.choices?.[0]?.message?.content || "";

    return res.status(200).json({
      html_output: revised_html
    });
  } catch (error) {
    console.error("Function error:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message
    });
  }
}
