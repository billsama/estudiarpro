// Descarga y extrae el texto de una norma publicada en un sitio oficial (solo dominios del Estado peruano).
const pdf = require("pdf-parse/lib/pdf-parse.js");
const OK = [/(^|\.)gob\.pe$/i, /(^|\.)elperuano\.pe$/i];
const permitido = (h) => OK.some((r) => r.test(h));
module.exports = async (req, res) => {
  try {
    const u = new URL(String(req.query.url || ""));
    if (u.protocol !== "https:" || !permitido(u.hostname))
      return res.status(400).json({ error: "Solo se permiten fuentes oficiales (gob.pe y elperuano.pe)." });
    const r = await fetch(u, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0", Accept: "*/*" }, signal: AbortSignal.timeout(25000) });
    if (!permitido(new URL(r.url).hostname)) return res.status(400).json({ error: "El enlace redirige fuera de los sitios oficiales." });
    if (!r.ok) return res.status(502).json({ error: "La fuente respondió con error " + r.status + ". Prueba otra copia oficial." });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 25e6) return res.status(413).json({ error: "El archivo es demasiado grande (máx. 25 MB)." });
    const ct = r.headers.get("content-type") || "";
    let text;
    if (/pdf/i.test(ct) || buf.slice(0, 4).toString() === "%PDF") text = (await pdf(buf)).text;
    else text = buf.toString("utf8").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    if (text.length < 200) return res.status(422).json({ error: "No pude extraer texto (¿PDF escaneado?). Busca otra copia oficial o sube el archivo." });
    res.setHeader("Cache-Control", "s-maxage=86400");
    res.json({ text: text.slice(0, 1500000), chars: text.length, url: r.url });
  } catch (e) {
    res.status(500).json({ error: "No se pudo leer la fuente: " + (e && e.message ? e.message : "error") });
  }
};
