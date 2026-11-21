#!/usr/bin/env python3
"""Codemod de la refonte « Clepsydre de nuit » (phase 6, docs/redesign).

Passe mécanique sur les composants du site connecté, avant la reprise
manuelle écran par écran. Idempotent. Usage : python3 scripts/codemods/clepsydre.py

1. Encre : text-foreground/N -> text-ink / text-ink-2 / text-ink-3 (paliers AA).
2. Micro-labels « font-mono uppercase tracking-[0.14em] » : la mono est
   réservée aux mesures. Le libellé devient une légende sans, 13 px, ink-3.
3. Couleurs décoratives (emerald, sky, violet, amber…) -> sodium / encre /
   danger. Les couleurs de marque et choisies par l'utilisateur sont en hex
   et ne sont pas touchées.
4. Verre (backdrop-blur) retiré hors des surfaces posées sur une vidéo.
5. Boutons « bg-white text-black » -> encre.
6. Em-dashes dans le texte visible -> virgule (les commentaires sont ignorés).
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SKIP = {
    "components/LandingPage.tsx", "components/SplashIntro.tsx", "components/WaterScene.tsx",
    "components/WrappedShareCard.tsx", "components/SpotifyPlayer.tsx", "components/TwitchPlayer.tsx",
    "app/session/page.tsx",
}
SKIP_DIRS = ("components/ff/", "app/%5Fdesign/", "components/ui/")
# Surfaces posées sur une vidéo : on garde leur flou de lisibilité.
KEEP_BLUR = {"components/StickyNote.tsx", "components/PipTimer.tsx", "components/TodoList.tsx"}

SODIUM = "emerald|green|teal|lime|cyan|amber|yellow|orange"
INKY = "sky|blue|indigo|violet|purple|slate|zinc|gray|neutral|stone"
DANGER = "red|rose|pink"
UTIL = "text|bg|border|from|to|via|ring|fill|stroke|accent|outline|decoration|divide|placeholder|caret|shadow"


def ink(m: re.Match) -> str:
    n = int(m.group(1))
    if n >= 80:
        return "text-ink"
    if n >= 55:
        return "text-ink-2"
    return "text-ink-3"


def color(m: re.Match) -> str:
    util, fam, op = m.group(1), m.group(2), m.group(4) or ""
    if re.fullmatch(SODIUM, fam):
        if util == "text":
            return "text-sodium-text"
        return f"{util}-sodium{op}"
    if re.fullmatch(DANGER, fam):
        return f"{util}-danger{op}"
    # bleus / violets / gris colorés : niveaux d'encre
    if util == "text":
        return "text-ink-2"
    if util in ("border", "divide", "ring", "outline"):
        return f"{util}-line-strong{op}"
    return f"{util}-ink{op or '/10'}"


def micro_label(cls: str) -> str:
    if "uppercase" not in cls or "tracking-[0.14em]" not in cls:
        return cls
    toks = cls.split()
    out = []
    for t in toks:
        if t in ("font-mono", "uppercase", "tracking-[0.14em]", "tracking-widest"):
            continue
        if re.fullmatch(r"text-\[(9|10|11)px\]|text-xs", t):
            t = "text-[13px]"
        out.append(t)
    if not any(re.fullmatch(r"text-\[\d+px\]|text-(xs|sm|base|lg)", t) for t in out):
        out.append("text-[13px]")
    return " ".join(out)


def is_comment(line: str) -> bool:
    s = line.strip()
    return s.startswith("//") or s.startswith("*") or s.startswith("/*") or s.startswith("{/*")


def transform(rel: str, src: str) -> str:
    s = re.sub(r"(?<![\w-])text-foreground/(\d+)", ink, src)
    s = re.sub(r'"([^"\n]*uppercase[^"\n]*tracking-\[0\.14em\][^"\n]*)"', lambda m: '"' + micro_label(m.group(1)) + '"', s)
    s = re.sub(r"`([^`\n]*uppercase[^`\n]*tracking-\[0\.14em\][^`\n]*)`", lambda m: "`" + micro_label(m.group(1)) + "`", s)
    s = re.sub(rf"(?<![\w-])({UTIL})-({SODIUM}|{INKY}|{DANGER})-(\d{{3}})(/\d+|/\[[\d.]+\])?", color, s)
    if rel not in KEEP_BLUR:
        s = re.sub(r"\s?(?<![\w-])(?:md:|sm:)?backdrop-blur(?:-[\w\[\]]+)?", "", s)
    s = s.replace("bg-white text-black", "bg-ink text-on-ink").replace("bg-foreground text-background", "bg-ink text-on-ink")
    lines = s.split("\n")
    for i, ln in enumerate(lines):
        if "—" in ln and not is_comment(ln):
            code, sep, tail = ln.partition("//")
            if sep and ("'" in tail or '"' in tail):
                code, sep, tail = ln, "", ""
            code = re.sub(r"\s*—\s*", ", ", code)
            lines[i] = code + sep + tail
    return "\n".join(lines)


def main() -> None:
    changed = 0
    for path in sorted(list(ROOT.glob("app/**/*.tsx")) + list(ROOT.glob("components/**/*.tsx"))):
        rel = path.relative_to(ROOT).as_posix()
        if rel in SKIP or rel.startswith(SKIP_DIRS):
            continue
        src = path.read_text()
        out = transform(rel, src)
        if out != src:
            path.write_text(out)
            changed += 1
            print("modifié", rel)
    print(f"{changed} fichiers")


if __name__ == "__main__":
    main()
