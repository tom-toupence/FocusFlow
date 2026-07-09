"use client";

import { useReducedMotion } from "@/lib/useReducedMotion";

const DIGITS = Array.from({ length: 10 }, (_, i) => i);

/** Colonne 0-9 qui glisse verticalement (style odometer, CSS only). */
function DigitColumn({ digit }: { digit: number }) {
  return (
    <span className="inline-block overflow-hidden align-baseline" style={{ height: "1em" }}>
      <span
        className="flex flex-col"
        style={{
          transform: `translateY(-${digit}em)`,
          transition: "transform 300ms cubic-bezier(0.3, 0.7, 0.3, 1)",
        }}
      >
        {DIGITS.map((d) => (
          <span key={d} className="leading-none" style={{ height: "1em" }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

/**
 * Affichage du chrono avec bascule des chiffres en glissement vertical.
 * La logique du timer n'est pas touchée : le composant ne fait que rendre
 * la chaîne déjà formatée (ex. "24:59"). Reduced-motion : texte brut.
 */
export default function TimerDigits({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <span className={className}>{text}</span>;
  return (
    <span className={className} role="timer" aria-label={text}>
      {text.split("").map((ch, i) =>
        /\d/.test(ch) ? (
          <DigitColumn key={i} digit={parseInt(ch, 10)} />
        ) : (
          <span key={i} className="leading-none inline-block">{ch}</span>
        )
      )}
    </span>
  );
}
