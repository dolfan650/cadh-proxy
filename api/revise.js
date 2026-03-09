export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { html, revisionMode, pagePurpose, contentType } = req.body;

  return res.status(200).json({
    message: "Proxy is working",
    received: {
      html,
      revisionMode,
      pagePurpose,
      contentType
    }
  });
}
