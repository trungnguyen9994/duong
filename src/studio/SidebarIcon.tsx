import type { ReactNode } from "react";

const icons: Record<string, ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7h.01" />
    </>
  ),
  games: (
    <>
      {[3, 14].flatMap((x) =>
        [3, 14].map((y) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="1.5" />
        )),
      )}
    </>
  ),
  create: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 7v10M7 12h10" />
    </>
  ),
  library: (
    <>
      <rect x="3" y="4" width="7" height="16" rx="1" />
      <path d="M6 8h1m-1 8h1" />
      <path d="m13 5 5-1 3 15-5 1Z" />
    </>
  ),
  questions: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M10 12a2 2 0 1 1 3 1.7c-.7.4-1 1-1 1.8M12 18h.01" />
    </>
  ),
  media: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="m3 17 5-5 4 4 4-6 5 7" />
    </>
  ),
  exports: (
    <>
      <path d="M12 3v12m-4-4 4 4 4-4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </>
  ),
  help: (
    <>
      <path d="M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15" />
      <path d="M6 8h3M6 12h3m6-4h3m-3 4h3" />
    </>
  ),
  admin: (
    <>
      <path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
};
export function SidebarIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {icons[name]}
    </svg>
  );
}
