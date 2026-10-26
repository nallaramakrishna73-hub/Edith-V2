import React from 'react';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error' | 'offline';

interface AIOrbProps {
  state?: OrbState;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  showStatusLabel?: boolean;
}

export const AIOrb: React.FC<AIOrbProps> = ({
  state = 'idle',
  size = 'hero',
  className = '',
  showStatusLabel = false,
}) => {
  const sizeMap = {
    sm: 'w-12 h-12',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
    hero: 'w-60 h-60 md:w-68 md:h-68',
  };

  const colorScheme = {
    idle: {
      primary: '#00E5FF',
      secondary: '#2F6BFF',
      core: '#A5F3FC',
      glowClass: 'drop-shadow-[0_0_25px_rgba(0,229,255,0.35)]',
      pulseSpeed: 'animate-[pulse_4s_ease-in-out_infinite]',
      ringRotate: 'animate-[spin_24s_linear_infinite]',
      counterRotate: 'animate-[spin_32s_linear_infinite_reverse]',
      label: 'STANDBY / IDLE',
      labelColor: 'text-[#00E5FF]',
    },
    listening: {
      primary: '#00E5FF',
      secondary: '#38BDF8',
      core: '#FFFFFF',
      glowClass: 'drop-shadow-[0_0_35px_rgba(0,229,255,0.7)]',
      pulseSpeed: 'animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]',
      ringRotate: 'animate-[spin_10s_linear_infinite]',
      counterRotate: 'animate-[spin_12s_linear_infinite_reverse]',
      label: 'LISTENING ...',
      labelColor: 'text-[#00E5FF]',
    },
    thinking: {
      primary: '#00E5FF',
      secondary: '#60A5FA',
      core: '#FFFFFF',
      glowClass: 'drop-shadow-[0_0_35px_rgba(0,229,255,0.6)]',
      pulseSpeed: 'animate-[pulse_1.2s_ease-in-out_infinite]',
      ringRotate: 'animate-[spin_5s_linear_infinite]',
      counterRotate: 'animate-[spin_7s_linear_infinite_reverse]',
      label: 'SYNTHESIZING ...',
      labelColor: 'text-[#60A5FA]',
    },
    speaking: {
      primary: '#22D3A0',
      secondary: '#00E5FF',
      core: '#E6F1FF',
      glowClass: 'drop-shadow-[0_0_30px_rgba(34,211,160,0.6)]',
      pulseSpeed: 'animate-[pulse_0.8s_ease-in-out_infinite]',
      ringRotate: 'animate-[spin_14s_linear_infinite]',
      counterRotate: 'animate-[spin_16s_linear_infinite_reverse]',
      label: 'VOCALIZING RESPONSE',
      labelColor: 'text-[#22D3A0]',
    },
    error: {
      primary: '#FF4D6A',
      secondary: '#F43F5E',
      core: '#FECDD3',
      glowClass: 'drop-shadow-[0_0_25px_rgba(255,77,106,0.45)]',
      pulseSpeed: 'animate-[pulse_2s_ease-in-out_infinite]',
      ringRotate: 'animate-[spin_40s_linear_infinite]',
      counterRotate: 'animate-[spin_40s_linear_infinite_reverse]',
      label: 'ANOMALY DETECTED',
      labelColor: 'text-[#FF4D6A]',
    },
    offline: {
      primary: '#64748B',
      secondary: '#475569',
      core: '#94A3B8',
      glowClass: 'drop-shadow-[0_0_10px_rgba(100,116,139,0.2)]',
      pulseSpeed: '',
      ringRotate: '',
      counterRotate: '',
      label: 'DISCONNECTED',
      labelColor: 'text-[#8FA3BF]',
    },
  }[state];

  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      {/* Background radial atmosphere */}
      <div
        className={`absolute rounded-full transition-all duration-700 pointer-events-none ${
          state === 'listening'
            ? 'w-80 h-80 bg-[#00E5FF]/25 blur-3xl scale-110'
            : state === 'speaking'
            ? 'w-80 h-80 bg-[#22D3A0]/20 blur-3xl'
            : state === 'thinking'
            ? 'w-76 h-76 bg-[#00E5FF]/20 blur-3xl'
            : state === 'error'
            ? 'w-72 h-72 bg-[#FF4D6A]/15 blur-3xl'
            : 'w-64 h-64 bg-[#00E5FF]/10 blur-3xl'
        }`}
      />

      {/* SVG AI HUD Orb */}
      <div className={`relative ${sizeMap[size]} ${colorScheme.glowClass} transition-transform duration-500`}>
        <svg
          viewBox="0 0 512 512"
          className="w-full h-full overflow-visible"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id={`orbGrad-${state}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={colorScheme.primary} stopOpacity="0.25" />
              <stop offset="60%" stopColor="#0A1128" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#05080F" stopOpacity="0" />
            </radialGradient>

            <filter id={`neonGlow-${state}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Atmospheric background disc */}
          <circle cx="256" cy="256" r="210" fill={`url(#orbGrad-${state})`} />

          {/* 4 Cardinal Crosshairs */}
          <g
            stroke={colorScheme.primary}
            strokeWidth="3.5"
            strokeLinecap="round"
            opacity={state === 'offline' ? 0.3 : 0.85}
          >
            <line x1="256" y1="52" x2="256" y2="76" />
            <line x1="256" y1="436" x2="256" y2="460" />
            <line x1="52" y1="256" x2="76" y2="256" />
            <line x1="436" y1="256" x2="460" y2="256" />
          </g>

          {/* Rotating Outer Dial with Tick Marks */}
          <g
            className={`origin-center ${colorScheme.ringRotate}`}
            stroke={colorScheme.primary}
            strokeWidth="2"
            opacity={state === 'offline' ? 0.2 : 0.6}
          >
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = i * 10;
              const isMajor = i % 3 === 0;
              return (
                <line
                  key={i}
                  x1="256"
                  y1="82"
                  x2="256"
                  y2={isMajor ? '94' : '88'}
                  strokeOpacity={isMajor ? 0.9 : 0.4}
                  strokeWidth={isMajor ? 2.5 : 1.5}
                  transform={`rotate(${angle} 256 256)`}
                />
              );
            })}
          </g>

          {/* Outer Precision Ring */}
          <circle
            cx="256"
            cy="256"
            r="164"
            fill="none"
            stroke={colorScheme.primary}
            strokeWidth="3.5"
            strokeOpacity={state === 'offline' ? 0.3 : 0.9}
            filter={state !== 'offline' ? `url(#neonGlow-${state})` : undefined}
          />

          {/* Dynamic Audio Waves if speaking or listening */}
          {(state === 'speaking' || state === 'listening') && (
            <g className="origin-center animate-[spin_6s_linear_infinite]" opacity="0.7">
              <circle cx="256" cy="256" r="176" fill="none" stroke={colorScheme.primary} strokeWidth="1.5" strokeDasharray="6 12" />
              <circle cx="256" cy="256" r="186" fill="none" stroke={colorScheme.secondary} strokeWidth="1" strokeDasharray="3 9" />
            </g>
          )}

          {/* Counter-rotating Dashed Orbit with Data Nodes */}
          <g className={`origin-center ${colorScheme.counterRotate}`}>
            <circle
              cx="256"
              cy="256"
              r="146"
              fill="none"
              stroke={colorScheme.secondary}
              strokeWidth="2.5"
              strokeDasharray="4 8"
              strokeOpacity={state === 'offline' ? 0.25 : 0.75}
            />
            <circle cx="359" cy="153" r="5" fill={colorScheme.primary} />
            <circle cx="153" cy="359" r="5" fill={colorScheme.secondary} />
            <circle cx="380" cy="256" r="3.5" fill={colorScheme.primary} />
            <circle cx="132" cy="256" r="3.5" fill={colorScheme.secondary} />
          </g>

          {/* Tactical High-Tech Arc Segments */}
          <g className={`origin-center ${colorScheme.pulseSpeed}`}>
            {/* Left Arc */}
            <path
              d="M 148 318 A 125 125 0 0 1 148 194"
              fill="none"
              stroke={colorScheme.secondary}
              strokeWidth="7"
              strokeLinecap="round"
              strokeOpacity={state === 'offline' ? 0.3 : 0.9}
            />
            <circle cx="124" cy="310" r="6" fill={colorScheme.secondary} />
            <circle cx="124" cy="310" r="2.5" fill="#05080F" />

            {/* Top-Right Arc */}
            <path
              d="M 238 132 A 125 125 0 0 1 368 220"
              fill="none"
              stroke={colorScheme.primary}
              strokeWidth="8"
              strokeLinecap="round"
              strokeOpacity={state === 'offline' ? 0.3 : 1}
              filter={state !== 'offline' ? `url(#neonGlow-${state})` : undefined}
            />
            <circle cx="368" cy="168" r="8" fill={colorScheme.primary} />
            <circle cx="368" cy="168" r="3.5" fill="#05080F" />

            {/* Bottom-Right Arc */}
            <path
              d="M 370 292 A 125 125 0 0 1 230 376"
              fill="none"
              stroke={colorScheme.primary}
              strokeWidth="6"
              strokeLinecap="round"
              strokeOpacity={state === 'offline' ? 0.3 : 0.85}
            />
            <circle cx="352" cy="360" r="6" fill={colorScheme.primary} />
            <circle cx="352" cy="360" r="2.5" fill="#05080F" />
          </g>

          {/* Deep Navy Inner Core */}
          <circle
            cx="256"
            cy="256"
            r="92"
            fill="#0A1128"
            stroke={colorScheme.primary}
            strokeWidth="3"
            strokeOpacity={state === 'offline' ? 0.2 : 0.6}
          />
          <circle
            cx="256"
            cy="256"
            r="78"
            fill="#060C1B"
            stroke={colorScheme.primary}
            strokeWidth="1.5"
            strokeOpacity={0.3}
          />
          <circle
            cx="256"
            cy="256"
            r="64"
            fill="#05080F"
            stroke={colorScheme.secondary}
            strokeWidth="1"
            strokeDasharray="2 4"
            strokeOpacity={0.5}
          />

          {/* Central Geometric 'E' Emblem */}
          <g
            transform="translate(256 256)"
            className={colorScheme.pulseSpeed}
            filter={state !== 'offline' ? `url(#neonGlow-${state})` : undefined}
          >
            <path
              d="M 24 -40 L -20 -40 C -26 -40 -30 -36 -30 -30 L -30 30 C -30 36 -26 40 -20 40 L 24 40 C 27 40 29 37 29 34 L 29 26 C 29 23 27 21 24 21 L -10 21 L -10 9 L 18 9 C 21 9 23 7 23 4 L 23 -4 C 23 -7 21 -9 18 -9 L -10 -9 L -10 -21 L 24 -21 C 27 -21 29 -23 29 -26 L 29 -34 C 29 -37 27 -40 24 -40 Z"
              fill={colorScheme.primary}
              opacity={state === 'offline' ? 0.3 : 0.6}
            />
            <path
              d="M 24 -40 L -20 -40 C -26 -40 -30 -36 -30 -30 L -30 30 C -30 36 -26 40 -20 40 L 24 40 C 27 40 29 37 29 34 L 29 26 C 29 23 27 21 24 21 L -10 21 L -10 9 L 18 9 C 21 9 23 7 23 4 L 23 -4 C 23 -7 21 -9 18 -9 L -10 -9 L -10 -21 L 24 -21 C 27 -21 29 -23 29 -26 L 29 -34 C 29 -37 27 -40 24 -40 Z"
              fill={colorScheme.core}
              opacity={state === 'offline' ? 0.4 : 1}
            />
          </g>
        </svg>
      </div>

      {showStatusLabel && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              state === 'listening'
                ? 'bg-[#00E5FF] animate-ping'
                : state === 'speaking'
                ? 'bg-[#22D3A0] shadow-[0_0_8px_#22D3A0]'
                : state === 'idle'
                ? 'bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]'
                : state === 'thinking'
                ? 'bg-[#60A5FA] animate-bounce'
                : state === 'error'
                ? 'bg-[#FF4D6A] shadow-[0_0_8px_#FF4D6A]'
                : 'bg-slate-500'
            }`}
          />
          <span className={`text-[11px] font-mono tracking-widest uppercase font-semibold ${colorScheme.labelColor}`}>
            {colorScheme.label}
          </span>
        </div>
      )}
    </div>
  );
};
