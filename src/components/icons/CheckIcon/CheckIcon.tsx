interface CheckIconProps {
  active?: boolean;
  className?: string;
}

export default function CheckIcon({ active = false, className }: CheckIconProps) {
  return (
    <svg
      className={className}
      data-name="fi:check"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M16.3636 5.22727L7.61363 13.9773L3.63635 10"
        stroke={
          active ? "var(--color-icon-button-icon-active)" : "var(--color-icon-button-icon-default)"
        }
        stroke-width="1.59091"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
