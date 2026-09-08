/** Normaliza enlaces de Google Drive, Dropbox y OneDrive a descargas directas. */
export function normalizeVideoUrl(raw: string): { url: string; provider: string } {
  let url = raw.trim();
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    if (host.includes("drive.google.com") || host.includes("docs.google.com")) {
      const m = u.pathname.match(/\/file\/d\/([^/]+)/) || u.pathname.match(/\/d\/([^/]+)/);
      const id = m?.[1] || u.searchParams.get("id");
      if (id) return { url: `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, provider: "Google Drive" };
    }
    if (host.includes("dropbox.com")) {
      u.searchParams.set("dl", "1");
      return { url: u.toString(), provider: "Dropbox" };
    }
    if (host.includes("1drv.ms") || host.includes("onedrive.live.com")) {
      if (!u.searchParams.has("download")) u.searchParams.set("download", "1");
      return { url: u.toString(), provider: "OneDrive" };
    }
    return { url, provider: host };
  } catch {
    return { url, provider: "desconocido" };
  }
}

export function isDirectVideoUrl(url: string) {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}
