const paths = {
  music: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor" stroke="none" />,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none" /></>,
  previous: <><path d="M5 5v14M19 5 8 12l11 7V5Z" /></>,
  next: <><path d="M19 5v14M5 5l11 7-11 7V5Z" /></>,
  repeat: <><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></>,
  volume: <><path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12" /></>,
  muted: <><path d="M11 5 6 9H3v6h3l5 4V5ZM17 9l4 6M21 9l-4 6" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r=".7" fill="currentColor" /><circle cx="3.5" cy="12" r=".7" fill="currentColor" /><circle cx="3.5" cy="18" r=".7" fill="currentColor" /></>,
  grip: <><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <><path d="M12 20h9M3 17.5V21h3.5L19 8.5 15.5 5 3 17.5ZM14 6.5l3.5 3.5" /></>,
  close: <path d="M5 5 19 19M19 5 5 19" />,
  minus: <path d="M5 12h14" />,
  expand: <><path d="M14 4h6v6M20 4l-8 8M10 20H4v-6M4 20l8-8" /></>,
  maximize: <rect x="4" y="4" width="16" height="16" rx="2" />,
  restore: <><path d="M8 4h11a1 1 0 0 1 1 1v11" /><rect x="4" y="8" width="12" height="12" rx="1.5" /></>,
  screen: <><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8M12 18v3" /></>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
  bot: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 7V4m-2 0h4M8 14h.01M16 14h.01M9 18h6" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.07 0l2-2A5 5 0 0 0 12 3.93l-1.2 1.2" /><path d="M14 11a5 5 0 0 0-7.07 0l-2 2A5 5 0 0 0 12 20.07l1.2-1.2" /></>,
};

export default function Icon({ name, size = 18, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name]}</svg>;
}
