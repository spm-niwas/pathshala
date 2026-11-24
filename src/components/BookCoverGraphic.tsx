import React from 'react';

export interface BookCoverTheme {
  bgClass: string;
  accentHex: string;
  motif: 'english' | 'hindi' | 'maths' | 'evs' | 'social' | 'computer' | 'art' | 'general';
}

const FALLBACK_THEMES: BookCoverTheme[] = [
  { bgClass: 'bg-blue-700', accentHex: '#93C5FD', motif: 'general' },
  { bgClass: 'bg-emerald-700', accentHex: '#6EE7B7', motif: 'general' },
  { bgClass: 'bg-amber-700', accentHex: '#FCD34D', motif: 'general' },
  { bgClass: 'bg-teal-700', accentHex: '#5EEAD4', motif: 'general' },
  { bgClass: 'bg-indigo-700', accentHex: '#A5B4FC', motif: 'general' },
  { bgClass: 'bg-rose-700', accentHex: '#FDA4AF', motif: 'general' },
];

export function getBookCoverTheme(subject: string, title = ''): BookCoverTheme {
  const s = subject.trim().toLowerCase();

  if (s.includes('english') || s.includes('grammar') || s.includes('literature') || s.includes('reading')) {
    return { bgClass: 'bg-blue-700', accentHex: '#BFDBFE', motif: 'english' };
  }
  if (s.includes('hindi') || s.includes('हिन्दी') || s.includes('हिंदी') || s.includes('sanskrit')) {
    return { bgClass: 'bg-amber-700', accentHex: '#FDE68A', motif: 'hindi' };
  }
  if (s.includes('math') || s.includes('ganit') || s.includes('algebra') || s.includes('geometry')) {
    return { bgClass: 'bg-emerald-700', accentHex: '#A7F3D0', motif: 'maths' };
  }
  if (
    s.includes('evs') ||
    s.includes('environ') ||
    s.includes('science') ||
    s.includes('bio') ||
    s.includes('nature')
  ) {
    return { bgClass: 'bg-teal-700', accentHex: '#99F6E4', motif: 'evs' };
  }
  if (
    s.includes('social') ||
    s.includes('history') ||
    s.includes('geo') ||
    s.includes('civics') ||
    s.includes('gk') ||
    s.includes('general')
  ) {
    return { bgClass: 'bg-rose-700', accentHex: '#FECDD3', motif: 'social' };
  }
  if (s.includes('comp') || s.includes('coding') || s.includes('ict') || s.includes('tech')) {
    return { bgClass: 'bg-indigo-700', accentHex: '#C7D2FE', motif: 'computer' };
  }
  if (s.includes('art') || s.includes('draw') || s.includes('craft') || s.includes('music')) {
    return { bgClass: 'bg-purple-700', accentHex: '#E9D5FF', motif: 'art' };
  }

  const key = `${s}:${title.toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_THEMES[hash % FALLBACK_THEMES.length];
}

interface BookCoverGraphicProps {
  subject: string;
  title: string;
  topLabel: string;
}

export const BookCoverGraphic: React.FC<BookCoverGraphicProps> = ({
  subject,
  title,
  topLabel,
}) => {
  const theme = getBookCoverTheme(subject, title);

  return (
    <div
      className={`relative h-28 sm:h-32 w-full ${theme.bgClass} text-white overflow-hidden p-3 sm:p-3.5 flex flex-col justify-between select-none`}
    >
      {/* Subtle geometric book-cover vector artwork */}
      <svg
        aria-hidden="true"
        viewBox="0 0 180 120"
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMaxYMid slice"
      >
        <circle cx="152" cy="22" r="44" fill={theme.accentHex} fillOpacity="0.14" />
        <circle cx="164" cy="94" r="32" fill={theme.accentHex} fillOpacity="0.1" />

        {theme.motif === 'english' && (
          <g stroke={theme.accentHex} strokeOpacity="0.48" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M112 38c10-5 20-5 28 0v48c-8-4-18-4-28 0V38z" />
            <path d="M140 38c10-5 20-5 28 0v48c-8-4-18-4-28 0V38z" />
            <path d="M119 52h14M119 62h12M147 52h14M147 62h12" strokeOpacity="0.38" />
          </g>
        )}

        {theme.motif === 'hindi' && (
          <g stroke={theme.accentHex} strokeOpacity="0.48" strokeWidth="2.2" fill="none" strokeLinecap="round">
            <circle cx="142" cy="58" r="18" />
            <circle cx="142" cy="58" r="8" fill={theme.accentHex} fillOpacity="0.18" />
            <path d="M142 30v8M142 78v8M114 58h8M162 58h8M122 38l6 6M156 72l6 6M162 38l-6 6M128 72l-6 6" />
          </g>
        )}

        {theme.motif === 'maths' && (
          <g stroke={theme.accentHex} strokeOpacity="0.48" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="140,28 166,76 114,76" />
            <circle cx="152" cy="64" r="16" strokeOpacity="0.38" />
            <path d="M122 88h40M130 84v8M142 84v8M154 84v8" />
          </g>
        )}

        {theme.motif === 'evs' && (
          <g stroke={theme.accentHex} strokeOpacity="0.48" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M124 82c2-24 18-40 40-44-2 24-18 40-40 44z" fill={theme.accentHex} fillOpacity="0.15" />
            <path d="M120 86c10-12 22-24 38-38" />
            <circle cx="122" cy="40" r="9" strokeOpacity="0.36" />
          </g>
        )}

        {theme.motif === 'social' && (
          <g stroke={theme.accentHex} strokeOpacity="0.48" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="142" cy="58" r="24" />
            <ellipse cx="142" cy="58" rx="11" ry="24" />
            <path d="M118 58h48M122 46h40M122 70h40" strokeOpacity="0.35" />
          </g>
        )}

        {theme.motif === 'computer' && (
          <g stroke={theme.accentHex} strokeOpacity="0.48" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="116" y="36" width="48" height="34" rx="5" />
            <path d="M130 80h20M140 70v10" />
            <path d="M128 50l6 5-6 5M140 60h10" />
          </g>
        )}

        {theme.motif === 'art' && (
          <g stroke={theme.accentHex} strokeOpacity="0.48" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M142 32c16 0 26 11 26 24 0 11-8 16-14 16-4 0-6 2-6 5 0 4 3 7-4 7-15 0-26-11-26-26 0-15 11-26 24-26z" />
            <circle cx="132" cy="48" r="3" fill={theme.accentHex} />
            <circle cx="144" cy="44" r="3" fill={theme.accentHex} />
            <circle cx="154" cy="52" r="3" fill={theme.accentHex} />
          </g>
        )}

        {theme.motif === 'general' && (
          <g stroke={theme.accentHex} strokeOpacity="0.48" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="118" y="32" width="44" height="54" rx="4" />
            <path d="M128 32v54M135 46h18M135 56h14" />
          </g>
        )}
      </svg>

      {/* Top subtle textbook spine/board mark */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-wide text-white/90 truncate">
          {topLabel}
        </span>
      </div>

      {/* Bottom subject title on cover */}
      <div className="relative z-10">
        <span className="text-xs font-semibold text-white tracking-tight truncate block">
          {subject}
        </span>
      </div>
    </div>
  );
};
