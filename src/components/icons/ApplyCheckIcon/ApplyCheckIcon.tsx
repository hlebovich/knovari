interface ApplyCheckIconProps {
  className?: string;
}

export default function ApplyCheckIcon({ className }: ApplyCheckIconProps) {
  return (
    <svg
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 20 20"
      className={className}
      data-name="fi:check"
    >
      <g id="fi:check">
        <path
          d="M16.6667 5L7.5 14.1667L3.33333 10"
          id="Vector"
          stroke="var(--color-apply-button-text)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.66667"
        />
      </g>
    </svg>
  );
}
