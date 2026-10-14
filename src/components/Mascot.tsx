import { useState } from "react";

export type Character = "explorer" | "star" | "dragon";
export function Mascot({
  character = "explorer",
  speaking = false,
  happy = false,
}: {
  character?: Character;
  speaking?: boolean;
  happy?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div
      className={`mascot mascot-${character} ${speaking ? "speaking" : ""} ${happy ? "happy" : ""}`}
      aria-hidden="true"
    >
      {character === "explorer" && !imageFailed ? (
        <img
          src="/art/explorer.png"
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <svg viewBox="0 0 220 260" className="mascot-vector">
          <ellipse
            cx="110"
            cy="248"
            rx="62"
            ry="8"
            fill="#234d4e"
            opacity=".16"
          />
          {character === "dragon" ? (
            <>
              <path
                d="M165 172Q212 190 204 133Q231 209 170 219"
                fill="#70cfa2"
                stroke="#287a67"
                strokeWidth="5"
              />
              <path
                d="M58 138L12 96 20 172 58 190M155 135L204 95 197 169 159 190"
                fill="#97dfb2"
                stroke="#287a67"
                strokeWidth="5"
              />
              <ellipse
                cx="107"
                cy="184"
                rx="61"
                ry="59"
                fill="#66c79d"
                stroke="#287a67"
                strokeWidth="5"
              />
              <ellipse cx="106" cy="193" rx="36" ry="40" fill="#fff1b8" />
              <path
                d="M63 66L59 23 87 51M128 47L157 23 154 73"
                fill="#f8c766"
                stroke="#287a67"
                strokeWidth="5"
              />
              <rect
                x="48"
                y="49"
                width="119"
                height="105"
                rx="48"
                fill="#7cdbac"
                stroke="#287a67"
                strokeWidth="5"
              />
              <ellipse cx="108" cy="129" rx="47" ry="25" fill="#acedd0" />
              <path
                d="M56 238L73 220M153 236L139 220"
                stroke="#287a67"
                strokeWidth="20"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M78 190L65 230M143 190L154 230"
                stroke="#cc8733"
                strokeWidth="13"
                strokeLinecap="round"
              />
              <path
                d="M55 126L21 115M168 125L197 98"
                stroke="#e1a036"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M110 20L140 75 200 86 161 135 169 201 110 174 50 201 58 135 19 86 80 75Z"
                fill="#ffcf57"
                stroke="#c2872f"
                strokeWidth="6"
                strokeLinejoin="round"
              />
              <path
                d="M105 38L127 82 173 90"
                fill="none"
                stroke="#ffe991"
                strokeWidth="9"
                strokeLinecap="round"
              />
            </>
          )}
          <g className="mascot-eyes" fill="#293a48">
            <ellipse cx="85" cy="105" rx="7" ry="11" />
            <ellipse cx="132" cy="105" rx="7" ry="11" />
          </g>
          <g fill="white">
            <circle cx="87" cy="102" r="2.5" />
            <circle cx="134" cy="102" r="2.5" />
          </g>
          <g fill="#ed8f83" opacity=".65">
            <ellipse cx="67" cy="124" rx="12" ry="6" />
            <ellipse cx="150" cy="124" rx="12" ry="6" />
          </g>
          <path
            className="mascot-mouth"
            d="M92 127Q108 151 125 127Z"
            fill="#864e3c"
          />
          <path d="M102 138Q111 132 119 138" fill="#ee8f91" />
        </svg>
      )}
    </div>
  );
}
