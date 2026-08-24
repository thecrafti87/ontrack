/**
 * Schlanke Stroke-Icons für die "Mehr"-Seite — gleicher Stil wie die
 * Bottom-Nav-Icons in src/components/AppShell.tsx (viewBox 24, strokeWidth 2,
 * runde Linienenden, Farbe wird über die umgebende Klasse gesetzt).
 */

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "size-6 shrink-0",
};

export function StackIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 8h16M4 12h16M4 16h16" />
      <path d="M4 8v8M20 8v8" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg {...ICON_PROPS}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function BoxIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M3 7l9-4 9 4-9 4-9-4Z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}

export function MapPinIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

export function WrenchIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

export function TagIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M11 3H4a1 1 0 0 0-1 1v7l10 10 8-8L11 3Z" />
      <circle cx="7.5" cy="7.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DownloadIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 19h16" />
    </svg>
  );
}

export function PersonIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function GearIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function SpeechBubbleIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
