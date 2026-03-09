import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { html, revisionMode, pagePurpose, contentType } = req.body;

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const prompt = `
You are an accessibility and instructional design assistant.

Task:
Revise the following Canvas HTML according to the selected revision mode.

Revision Mode:
${revisionMode}

Page Purpose:
${pagePurpose}

Content Type:
${contentType}

Canvas HTML:
${html}

Return ONLY revised HTML.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: "You revise Canvas HTML for accessibility and instructional clarity." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2
    });

    const revised_html = completion.choices[0].message.content;

    res.status(200).json({
      html_output: revised_html
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "OpenAI request failed" });
  }
}
