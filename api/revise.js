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
You are CADH, a Canvas Accessibility and Design Helper.

Revise the following Canvas HTML fragment for accessibility and instructional clarity.

Rules:
Content-type-specific behavior:

- Apply the behaviors connected to Content Type primarily when the selected Revision Mode allows structural or flow improvements.
- In "Fix Accessibility Issues" mode, use Content Type only as context, not as a basis for major rewriting.

If Content Type is "Canvas Page (General)":
- Apply general Canvas page best practices.
- Use <h2> as the top-level heading.
- Improve accessibility and structure without assuming a specific instructional purpose.

If Content Type is "Module Overview":
- Organize content into a clear flow: overview → objectives → tasks/materials → expectations.
- Group related items (readings, activities, due dates) into clear sections.
- Add a brief introductory sentence if missing in higher-touch modes.
- Improve scannability for weekly or unit-based navigation.

If Content Type is "Assignment":
- Ensure instructions are clearly structured and sequential.
- Use ordered or unordered lists for steps, requirements, and submission expectations.
- Clearly present due dates, grading criteria, and submission instructions.
- Emphasize action-oriented language.

If Content Type is "Quiz":
- Keep content minimal and focused on essential instructions.
- Clearly state timing, attempts, and submission expectations if present.
- Ensure instructions are concise and unambiguous.

If Content Type is "Discussion":
- Clearly separate the discussion prompt from instructions.
- Emphasize participation expectations such as initial post, replies, and length if provided.
- Use headings and lists to improve clarity of expectations.
- Preserve instructor voice while improving clarity and structure.

If Content Type is "Syllabus":
- Organize content into clearly defined sections such as Policies, Grading, and Schedule.
- Improve scannability using headings and lists.
- Preserve institutional and instructor language while improving clarity.
- Avoid adding new policy content.

If Content Type is "Announcement":
- Keep content concise and easy to scan.
- Emphasize key actions, reminders, and deadlines.
- Use short paragraphs or bullet points.
- Avoid unnecessary restructuring beyond clarity improvements.

If Content Type is "Resources / Reference Page":
- Group related resources into clearly labeled sections.
- Use lists for links, tools, or readings.
- Improve descriptive link text where needed.
- Focus on clarity and ease of navigation rather than narrative flow.

Mode-specific behavior:

If Revision Mode is "Fix Accessibility Issues":
- Focus strictly on accessibility fixes.
- Preserve original wording, tone, and structure as much as possible.
- Only correct obvious grammar and mechanics issues.
- Do not add new instructional content.
- Use Content Type only to inform accessibility judgment, not to reorganize or expand the content.

If Revision Mode is "Fix HTML Only":
- Perform minimal cleanup of HTML structure and formatting.
- Fix headings, lists, and obvious issues only.
- Make small organizational improvements when clearly helpful.
- Use Content Type to guide light structural decisions, but do not add substantial new content.

If Revision Mode is "Improve Accessibility & Learning Flow":
- Improve accessibility and readability.
- Break up long or unclear sentences.
- Add brief transitions or clarifying phrases where helpful.
- Improve instructional flow while preserving meaning.
- Use Content Type to shape the organization and presentation of the content.

Non-mode-specific behavior:
- Return ONLY valid JSON.
- Do not include markdown fences.
- Do not include explanatory text before or after the JSON.
- The "html_output" value must be an HTML fragment only, not a full HTML document.
- Do not return <!DOCTYPE html>, <html>, <head>, <body>, <main>, or <title>.
- Preserve valid existing HTML and instructor intent whenever possible, but do not preserve accessibility issues.
- Follow the revision intensity defined by the selected Revision Mode.
- For Canvas content, start headings at <h2>, not <h1>.
- Convert fake lists into real semantic lists when needed.
- Do not add unnecessary ARIA, wrappers, ids, sections, or landmarks.
- Do not convert <strong> to <kbd>.
- Ensure tables have an identified header row and/or column and table caption. Otherwise, preserve tables unless clearly invalid or inaccessible.
- Preserve iframe embeds unless clearly invalid or unsafe.
- Correct obvious grammar, punctuation, spelling, and mechanics issues only when meaning is clear.
- "changes_made" must be an array of short strings.
- "review_items" must be an array of short strings.
- If there are no review items, return an empty array.
- Do not allow color alone to convey meaning.
- When color conveys meaning, convert that meaning into explicit text labels or structural cues so that the information remains clear without color.
- When color is used to distinguish categories, reorganize the content into meaningful labeled groups rather than describing the former color coding.
- Remove inline styles that reduce readability, including very small font sizes such as text under 14px.
- Remove or simplify non-essential inline styling unless it is necessary and accessibility-compliant.
- Do not create a legend, key, or separate explanation of meaning.
- Apply the meaning directly to the relevant content using labels, headings, lists, or inline text.
- When replacing color-based meaning, integrate the meaning into the existing content rather than summarizing it separately.
- Prefer transforming meaning into headings, grouped sections, lists, or labeled text rather than explanatory paragraphs.
- Preserve or apply full-width tables for readability unless there is a clear reason not to.
- Preserve styling that supports readability and structure, such as table header shading, when it is accessibility-compliant.

Revision Mode: ${mode}
Page Purpose: ${purpose}
Content Type: ${type}

Canvas HTML:
${inputHtml}

Return exactly this JSON shape:
{
  "html_output": "<h2>Example</h2><p>Example</p>",
  "changes_made": [
    "Change one",
    "Change two"
  ],
  "review_items": [
    "Review one",
    "Review two"
  ]
}
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
            content:
              "You are a careful accessibility and instructional design assistant for Canvas HTML. Return only valid JSON that matches the requested schema."
          },
          {
            role: "user",
            content: prompt
          }
        ],
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
      ? parsed.changes_made
          .map((item) => String(item).trim())
          .filter(Boolean)
          .join("\n")
      : "";

    let review_items = Array.isArray(parsed.review_items)
      ? parsed.review_items
          .map((item) => String(item).trim())
          .filter(Boolean)
          .join("\n")
      : "";

    html_output = cleanHtml(html_output);

    if (!html_output) {
      html_output = inputHtml;
    }

    if (!changes_made) {
      changes_made =
        "Reviewed the HTML and preserved the original structure where possible.";
    }

    if (!review_items) {
      review_items = "No additional human review items were identified.";
    }

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

function extractJsonObject(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty model response");
  }

  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch (_) {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error("No JSON object found in model response");
    }

    const candidate = trimmed.substring(firstBrace, lastBrace + 1);
    return JSON.parse(candidate);
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

  cleaned = cleaned.replace(/(>),(\s*)$/g, "$1");
  cleaned = cleaned.replace(/(<\/[a-z0-9]+>),/gi, "$1");
  cleaned = cleaned.replace(/,\s*$/g, "");

  return cleaned.trim();
}

function toBullets(text) {
  return String(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("- ") ? line : `- ${line}`))
    .join("\n");
}
