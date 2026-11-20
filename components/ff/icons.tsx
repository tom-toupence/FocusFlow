// Jeu d'icônes de la Clepsydre : SVG inline, trait 1.6 sur grille 24, bouts
// arrondis. Une seule famille de pictogrammes pour toute l'app (règle :
// jamais de lib d'icônes, jamais d'image).
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconPlay = (p: P) => <Svg {...p}><path d="M7.5 5.2v13.6L18.5 12z" fill="currentColor" stroke="none" /></Svg>;
export const IconPause = (p: P) => <Svg {...p}><path d="M8 5v14M16 5v14" strokeWidth={2.4} /></Svg>;
export const IconNext = (p: P) => <Svg {...p}><path d="M6 6l8 6-8 6z" fill="currentColor" stroke="none" /><path d="M18 6v12" strokeWidth={2} /></Svg>;
export const IconPrev = (p: P) => <Svg {...p}><path d="M18 6l-8 6 8 6z" fill="currentColor" stroke="none" /><path d="M6 6v12" strokeWidth={2} /></Svg>;
export const IconShuffle = (p: P) => <Svg {...p}><path d="M3 7h3.5c4 0 6 10 10 10H21M3 17h3.5c1.6 0 2.8-1.6 3.8-3.6M13.7 9.6C14.7 8 15.6 7 17 7h4M18 4l3 3-3 3M18 14l3 3-3 3" /></Svg>;
export const IconLoop = (p: P) => <Svg {...p}><path d="M4 11V9a3 3 0 0 1 3-3h12l-3-3M20 13v2a3 3 0 0 1-3 3H5l3 3" /></Svg>;
/** Prolonger : la boucle ouverte, l'eau continue (fin de file prolongée). */
export const IconExtend = (p: P) => <Svg {...p}><path d="M4 12h11M12 7l5 5-5 5" /><path d="M20 5v14" strokeDasharray="2 3" /></Svg>;
export const IconVolume = (p: P) => <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></Svg>;
export const IconMute = (p: P) => <Svg {...p}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" /><path d="M16 9.5l5 5M21 9.5l-5 5" /></Svg>;
export const IconClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IconStop = (p: P) => <Svg {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none" /></Svg>;
/** Distraction = un caillou jeté dans l'eau (onde concentrique). */
export const IconStone = (p: P) => <Svg {...p}><ellipse cx="12" cy="15" rx="8.5" ry="3" opacity={0.45} /><ellipse cx="12" cy="15" rx="4.5" ry="1.5" /><path d="M12 4v6" /><circle cx="12" cy="4" r="0.6" fill="currentColor" /></Svg>;
export const IconDrop = (p: P) => <Svg {...p}><path d="M12 3.5c3 4 5.5 7 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.5 9 7.5 12 3.5z" /></Svg>;
export const IconList = (p: P) => <Svg {...p}><path d="M9 7h11M9 12h11M9 17h11" /><path d="M4.5 7h.01M4.5 12h.01M4.5 17h.01" strokeWidth={2.6} /></Svg>;
export const IconPip = (p: P) => <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><rect x="12" y="11" width="7" height="6" rx="1" fill="currentColor" stroke="none" /></Svg>;
export const IconHelp = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9.7 9.4a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.5M12 16.4h.01" /></Svg>;
export const IconTasks = (p: P) => <Svg {...p}><path d="M5 7l1.5 1.5L9 6M5 13l1.5 1.5L9 12M5 19l1.5 1.5L9 18M12 7h7M12 13h7M12 19h7" /></Svg>;
export const IconNote = (p: P) => <Svg {...p}><path d="M5 4h14v11l-5 5H5z" /><path d="M14 20v-5h5" /></Svg>;
export const IconSearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></Svg>;
export const IconArrowLeft = (p: P) => <Svg {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const IconMore = (p: P) => <Svg {...p}><path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={2.8} /></Svg>;
export const IconSun = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Svg>;
export const IconMoon = (p: P) => <Svg {...p}><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" /></Svg>;
