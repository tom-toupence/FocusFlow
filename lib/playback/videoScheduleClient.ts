"use client";
// « Calé sur la vidéo » côté client : rythme d'une vidéo YouTube. L'annotation
// du catalogue (data/videos.ts, champ `schedule`) passe avant les chapitres lus
// par la route serveur. Cache mémoire (une requête par vidéo et par onglet).
import { useEffect, useState } from "react";
import { defaultVideos } from "@/data/videos";
import { scheduleFromChapters, type Chapter, type VideoSchedule } from "@/lib/videoSchedule";

export interface ResolvedSchedule {
  schedule: VideoSchedule;
  /** Durée attendue de la vidéo (s), pour détecter une vidéo remontée ; null si inconnue. */
  durationSec: number | null;
  source: "catalogue" | "chapters";
}

const memo = new Map<string, Promise<ResolvedSchedule | null>>();

/** Annotation à la main : triée, et au moins un travail ET une pause. */
function fromCatalogue(youtubeId: string): ResolvedSchedule | null {
  const v = defaultVideos.find((x) => x.youtubeId === youtubeId && x.schedule?.length);
  if (!v?.schedule) return null;
  const schedule = [...v.schedule].filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  if (!schedule.some((s) => s.kind === "work") || !schedule.some((s) => s.kind === "break")) return null;
  return { schedule, durationSec: v.durationSec ?? null, source: "catalogue" };
}

async function fromChapters(youtubeId: string): Promise<ResolvedSchedule | null> {
  const res = await fetch(`/api/youtube/schedule?v=${encodeURIComponent(youtubeId)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { chapters?: Chapter[]; durationSec?: number };
  const durationSec = Number(data.durationSec) || 0;
  const schedule = scheduleFromChapters(Array.isArray(data.chapters) ? data.chapters : [], durationSec);
  return schedule ? { schedule, durationSec, source: "chapters" } : null;
}

export function resolveVideoSchedule(youtubeId: string): Promise<ResolvedSchedule | null> {
  const hit = memo.get(youtubeId);
  if (hit) return hit;
  const p = Promise.resolve(fromCatalogue(youtubeId))
    .then((c) => c ?? fromChapters(youtubeId))
    .catch(() => {
      memo.delete(youtubeId); // échec réseau : on retentera à la prochaine session
      return null;
    });
  memo.set(youtubeId, p);
  return p;
}

/** Rythme de la vidéo `youtubeId` : undefined tant que c'est en cours, null si aucun (ou pas de vidéo). */
export function useVideoSchedule(youtubeId: string | null): ResolvedSchedule | null | undefined {
  const [state, setState] = useState<{ id: string; value: ResolvedSchedule | null } | null>(null);
  useEffect(() => {
    if (!youtubeId) return;
    let cancelled = false;
    void resolveVideoSchedule(youtubeId).then((value) => { if (!cancelled) setState({ id: youtubeId, value }); });
    return () => { cancelled = true; };
  }, [youtubeId]);
  if (!youtubeId) return null;
  return state?.id === youtubeId ? state.value : undefined;
}
