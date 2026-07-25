// DeepL requires specific regional variants for a couple of languages as
// the *target* (though a plain "EN"/"PT" is fine as a source). Everything
// else is just the base language subtag, uppercased.
const TARGET_OVERRIDES: Record<string, string> = {
  en: "EN-US",
  pt: "PT-PT",
};

export function toDeepLTargetLang(locale: string): string {
  const base = locale.split("-")[0]?.toLowerCase();
  if (base === "en") {
    const region = locale.split("-")[1]?.toLowerCase();
    return region === "gb" || region === "au" || region === "ie" ? "EN-GB" : "EN-US";
  }
  if (base === "pt") {
    const region = locale.split("-")[1]?.toLowerCase();
    return region === "br" ? "PT-BR" : "PT-PT";
  }
  return TARGET_OVERRIDES[base]?.toUpperCase() ?? base?.toUpperCase() ?? "EN-US";
}

export async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) throw new Error("not_configured");

  const host = key.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  const res = await fetch(`https://${host}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: texts, target_lang: targetLang }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("translate_failed");

  const data = await res.json();
  return (data.translations as { text: string }[]).map((t) => t.text);
}
