"use client";

// Export / import de toutes les données locales (stores Zustand persistés en
// localStorage sous les clés `focusflow-*`). Permet de transférer ses données
// d'un navigateur ou d'un appareil à l'autre — y compris ce qui n'est pas
// synchronisé Supabase (sprint, routines, journal, XP, stats locales…).

const KEY_PREFIX = "focusflow-";

interface BackupFile {
  app: "focusflow";
  version: 1;
  exportedAt: string;
  data: Record<string, string>;
}

export function exportBackup(): void {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(KEY_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }

  const backup: BackupFile = {
    app: "focusflow",
    version: 1,
    exportedAt: new Date().toISOString(),
    data,
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `focusflow-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Restaure une sauvegarde. Retourne le nombre de stores restaurés, ou lève une
 * erreur si le fichier n'est pas une sauvegarde FocusFlow valide.
 * Recharger la page ensuite pour que les stores relisent le localStorage.
 */
export function importBackup(jsonText: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("Fichier illisible (JSON invalide).");
  }

  const backup = parsed as Partial<BackupFile>;
  if (backup.app !== "focusflow" || typeof backup.data !== "object" || backup.data === null) {
    throw new Error("Ce fichier n'est pas une sauvegarde FocusFlow.");
  }

  let count = 0;
  for (const [key, value] of Object.entries(backup.data)) {
    if (!key.startsWith(KEY_PREFIX) || typeof value !== "string") continue;
    // Vérifie que la valeur est bien du JSON avant d'écraser
    try { JSON.parse(value); } catch { continue; }
    localStorage.setItem(key, value);
    count++;
  }

  if (count === 0) throw new Error("Aucune donnée FocusFlow dans ce fichier.");
  return count;
}
