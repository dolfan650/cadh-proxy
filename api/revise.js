export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { html, revisionMode, pagePurpose, contentType } = req.body;

  return res.status(200).json({
    html_output: html,
    revision_mode: revisionMode,
    page_purpose: pagePurpose,
    content_type: contentType
  });
}
