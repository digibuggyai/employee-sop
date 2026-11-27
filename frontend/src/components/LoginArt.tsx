const ink = "#00214a";
const pale = "#e6edfc";
const desk = "#c3d2f4";
const leaf = "#6d90e6";
const leafDark = "#4f74d4";
const accent = "#f4a24a";

const buildings = [
  [52, 150, 34], [90, 120, 26], [120, 165, 40], [164, 105, 30], [198, 140, 36],
  [238, 95, 28], [270, 150, 44], [318, 118, 30], [352, 160, 38], [394, 110, 32], [430, 145, 40],
];

export default function LoginArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 350" className={className} role="img" aria-label="An office desk with a computer showing a checked calendar">
      <rect x="36" y="18" width="448" height="262" rx="6" fill="#062a5a" />
      {buildings.map(([x, top, w]) => (
        <g key={x}>
          <rect x={x} y={top} width={w} height={280 - top} fill="#04244f" />
          {Array.from({ length: Math.floor((270 - top) / 22) }, (_, r) =>
            [0, 1].map((c) => (
              <rect key={`${r}-${c}`} x={x + 6 + c * (w / 2 - 2)} y={top + 10 + r * 22} width="5" height="7" rx="1" fill="#123a70" />
            )),
          )}
        </g>
      ))}
      <rect x="36" y="18" width="448" height="262" rx="6" fill="none" stroke="#15407c" strokeWidth="6" />
      <line x1="260" y1="18" x2="260" y2="280" stroke="#15407c" strokeWidth="5" />

      <ellipse cx="260" cy="318" rx="250" ry="22" fill="#052b5c" />

      <circle cx="452" cy="58" r="20" fill={pale} />
      <line x1="452" y1="58" x2="452" y2="45" stroke={ink} strokeWidth="3" strokeLinecap="round" />
      <line x1="452" y1="58" x2="462" y2="62" stroke={ink} strokeWidth="3" strokeLinecap="round" />

      <path d="M400 30 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4z" fill={accent} />

      <rect x="56" y="244" width="70" height="66" rx="4" fill={desk} />
      <line x1="56" y1="266" x2="126" y2="266" stroke="#a9bdeb" strokeWidth="2" />
      <line x1="56" y1="288" x2="126" y2="288" stroke="#a9bdeb" strokeWidth="2" />
      <rect x="84" y="254" width="14" height="3" rx="1.5" fill="#8ea8e3" />
      <rect x="84" y="276" width="14" height="3" rx="1.5" fill="#8ea8e3" />
      <rect x="72" y="222" width="38" height="24" rx="4" fill={pale} />
      <ellipse cx="78" cy="206" rx="9" ry="20" transform="rotate(-30 78 206)" fill={leaf} />
      <ellipse cx="102" cy="204" rx="9" ry="22" transform="rotate(28 102 204)" fill={leafDark} />
      <ellipse cx="91" cy="196" rx="8" ry="24" fill={leaf} />

      <rect x="150" y="228" width="236" height="10" rx="3" fill={desk} />
      <rect x="162" y="238" width="7" height="72" fill="#a9bdeb" />
      <rect x="368" y="238" width="7" height="72" fill="#a9bdeb" />

      <rect x="228" y="148" width="120" height="76" rx="6" fill="#8daaee" />
      <rect x="235" y="155" width="106" height="62" rx="3" fill={pale} />
      <rect x="244" y="163" width="88" height="8" rx="2" fill="#b7c8f1" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <rect key={`${r}${c}`} x={246 + c * 17} y={177 + r * 12} width="11" height="7" rx="1.5" fill={r === 1 && c === 3 ? accent : "#c9d6f5"} />
        )),
      )}
      <rect x="281" y="224" width="14" height="5" fill="#8daaee" />

      <rect x="180" y="212" width="17" height="16" rx="2" fill={accent} />
      <path d="M197 216 h4 a4 4 0 0 1 0 8 h-4" fill="none" stroke={accent} strokeWidth="2.5" />
      <path d="M185 206 q2 -5 0 -9 M191 206 q2 -5 0 -9" stroke="#8ea8e3" strokeWidth="1.8" fill="none" strokeLinecap="round" />

      <rect x="356" y="216" width="22" height="12" rx="2" fill={pale} />
      <rect x="352" y="224" width="30" height="4" rx="1" fill="#b7c8f1" />

      <rect x="250" y="246" width="56" height="10" rx="5" fill="#1c4888" />
      <rect x="258" y="196" width="40" height="52" rx="8" fill="#21549c" />
      <rect x="275" y="256" width="6" height="34" fill="#1c4888" />
      <path d="M256 296 h44" stroke="#1c4888" strokeWidth="5" strokeLinecap="round" />

      <rect x="420" y="300" width="44" height="40" rx="5" fill={pale} />
      <ellipse cx="428" cy="270" rx="11" ry="30" transform="rotate(-28 428 270)" fill={leafDark} />
      <ellipse cx="458" cy="268" rx="11" ry="32" transform="rotate(26 458 268)" fill={leaf} />
      <ellipse cx="443" cy="258" rx="10" ry="36" fill={leaf} />
      <ellipse cx="416" cy="290" rx="8" ry="20" transform="rotate(-62 416 290)" fill={leaf} />
      <ellipse cx="470" cy="290" rx="8" ry="20" transform="rotate(62 470 290)" fill={leafDark} />
    </svg>
  );
}
