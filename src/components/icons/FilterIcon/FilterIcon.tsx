interface FilterIconProps {
  className?: string;
}

export default function FilterIcon({ className }: FilterIconProps) {
  return (
    <svg
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      viewBox="0 0 34 34"
      className={className}
      data-name="filter"
    >
      <g id="Filter">
        <rect fill="var(--color-icon-filter-bg-default)" height="34" rx="16.8889" width="33.7778" />
        <path
          d="M25.7778 9H8L15.1111 17.4089V23.2222L18.6667 25V17.4089L25.7778 9Z"
          id="Vector"
          stroke="var(--color-icon-button-icon-active)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.77778"
        />
      </g>
    </svg>
  );
}
