interface ChevronDownIconProps {
  className?: string;
}

export default function ChevronDownIcon({ className }: ChevronDownIconProps) {
  return (
    <svg
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 24 24"
      className={className}
      data-name="fi:chevron-down"
    >
      <g id="fi:chevron-down">
        <path
          d="M6 9L12 15L18 9"
          id="Vector"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </g>
    </svg>
  );
}
