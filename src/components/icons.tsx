import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

const base = (props: P) => {
  const { size = 20, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
};

export const IconQr = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M18 18h3v3h-3z" />
  </svg>
);

export const IconDoc = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 2.5h8l4 4V21a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 21V2.5z" />
    <path d="M14 2.5V7h4.5" />
    <path d="M9 12h6M9 15.5h6M9 8.5h2.5" />
  </svg>
);

export const IconPhoto = (p: P) => (
  <svg {...base(p)}>
    <rect x="3" y="4" width="18" height="16" />
    <circle cx="8.6" cy="9.4" r="1.7" />
    <path d="M21 16.2 15.5 11l-6 9M3 18.5l4.5-4 3 3" />
  </svg>
);

export const IconDrops = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 3.5S4 7.2 4 9.6a3 3 0 0 0 6 0C10 7.2 7 3.5 7 3.5z" />
    <path d="M16.5 8.5s-2.6 3.2-2.6 5.3a2.6 2.6 0 0 0 5.2 0c0-2.1-2.6-5.3-2.6-5.3z" />
    <path d="M9 15.5s-2.2 2.7-2.2 4.4a2.2 2.2 0 0 0 4.4 0c0-1.7-2.2-4.4-2.2-4.4z" />
  </svg>
);

export const IconMonoDrop = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3.5S6.5 10 6.5 14a5.5 5.5 0 0 0 11 0c0-4-5.5-10.5-5.5-10.5z" />
    <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" opacity="0.55" />
  </svg>
);

export const IconFlip = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3v18" strokeDasharray="3 3" />
    <path d="M8.5 6.5H3v11h5.5a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z" />
    <path d="M15.5 6.5H21v11h-5.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" fill="currentColor" fillOpacity="0.16" />
  </svg>
);

export const IconSheet = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.5 2.5h8l3.5 3.5v15a.5.5 0 0 1-.5.5H6.5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" />
    <path d="M14.5 2.5V6H18" />
  </svg>
);

export const IconCopy = (p: P) => (
  <svg {...base(p)}>
    <rect x="8.5" y="8.5" width="12" height="12" />
    <path d="M15.5 8.5v-5h-12v12h5" />
  </svg>
);

export const IconRupee = (p: P) => (
  <svg {...base(p)}>
    <path d="M6.5 3.5h11M6.5 7.5h11" />
    <path d="M9.5 3.5c3.2 0 5 1.5 5 4s-1.8 4-5 4H7l7.5 9" />
  </svg>
);

export const IconPrinter = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 8V3.5h10V8" />
    <rect x="3.5" y="8" width="17" height="8.5" />
    <circle cx="17.5" cy="11" r="0.4" fill="currentColor" />
    <path d="M7 13.5h10v7H7z" fill="currentColor" fillOpacity="0.12" />
  </svg>
);

export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const IconArrowR = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 12h15M13 5.5 19.5 12 13 18.5" />
  </svg>
);

export const IconArrowL = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 12H5M11 5.5 4.5 12 11 18.5" />
  </svg>
);

export const IconTrash = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5 7.5 21h9l1-14.5" />
    <path d="M10 10.5v6.5M14 10.5v6.5" />
  </svg>
);

export const IconPlus = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconMinus = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h14" />
  </svg>
);

export const IconPhone = (p: P) => (
  <svg {...base(p)}>
    <rect x="7" y="2.5" width="10" height="19" />
    <path d="M10.5 18.5h3" />
  </svg>
);

export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 15V3.5M7 8l5-4.7L17 8" />
    <path d="M4 15.5v4A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-4" />
  </svg>
);

export const IconShield = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 2.5 4.5 5.5v6c0 4.6 3.2 8 7.5 9.9 4.3-1.9 7.5-5.3 7.5-9.9v-6L12 2.5z" />
    <path d="m8.8 11.6 2.3 2.3 4.3-4.6" />
  </svg>
);

export const IconReceipt = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 2.5h12V21l-2.4-1.6L13.2 21l-2.4-1.6L8.4 21 6 19.4V2.5z" />
    <path d="M9 7h6M9 10.5h6M9 14h3.5" />
  </svg>
);

export const IconReg = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" />
  </svg>
);

export const IconInk = (p: P) => (
  <svg {...base(p)}>
    <rect x="5" y="3.5" width="14" height="7" />
    <path d="M8 10.5v5a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5" />
    <path d="M5 6.5h14" />
  </svg>
);

/* ------- simplified UPI app glyphs (not exact brand assets) ------- */

export const GlyphGPay = (p: P) => {
  const { size = 22, ...rest } = p;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <path d="M21 12.2c0-.7-.06-1.4-.18-2H12v3.9h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3A9 9 0 0 0 21 12.2z" fill="#4285F4" />
      <path d="M12 21.5c2.4 0 4.5-.8 6-2.2l-3-2.3c-.8.6-1.9.9-3 .9a5.4 5.4 0 0 1-5.1-3.7H3.8v2.4A9 9 0 0 0 12 21.5z" fill="#34A853" />
      <path d="M6.9 14.2a5.4 5.4 0 0 1 0-3.5V8.3H3.8a9 9 0 0 0 0 8.3l3.1-2.4z" fill="#FBBC05" />
      <path d="M12 7.1c1.3 0 2.4.4 3.3 1.3l2.5-2.5A9 9 0 0 0 3.8 8.3l3.1 2.4A5.4 5.4 0 0 1 12 7.1z" fill="#EA4335" />
    </svg>
  );
};

export const GlyphPhonePe = (p: P) => {
  const { size = 22, ...rest } = p;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <circle cx="12" cy="12" r="10" fill="#5F259F" />
      <path d="M10 7.5 7 11l2 .1-.7 4.6c-.1.8.4 1.4 1.2 1.4h2.3c.7 0 1.2-.5 1.3-1.2l.6-5.4 1.8-.1V8.2l-2 .1.6-2.2H12z" fill="#FDFDF9" />
    </svg>
  );
};

export const GlyphPaytm = (p: P) => {
  const { size = 22, ...rest } = p;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <rect x="2" y="5" width="20" height="14" rx="2" fill="#00BAF2" />
      <path d="M7 9.5v3.2a1.6 1.6 0 0 0 1.6 1.6h.4V9.5h1.5v6.3h-2A3 3 0 0 1 5.5 13V9.5H7z" fill="#FDFDF9" />
      <path d="M11.5 9.5H15a2 2 0 0 1 2 2v2.3a2 2 0 0 1-2 2h-2v2H11.5V9.5zM13 11v2.8h1.8a.7.7 0 0 0 .7-.7v-1.4a.7.7 0 0 0-.7-.7H13z" fill="#053B75" />
      <path d="M17.5 9.5H19v6.3h-1.5z" fill="#FDFDF9" />
    </svg>
  );
};

export const GlyphUpi = (p: P) => {
  const { size = 22, ...rest } = p;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...rest}>
      <rect x="2" y="5" width="20" height="14" rx="2" fill="#15172B" />
      <path d="m8.5 8 -3 4 3 4M15.5 8l3 4-3 4" stroke="#34E2A2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.2 8.5 10.8 15.5" stroke="#FDFDF9" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
};
