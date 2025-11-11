interface XIconProps {
  active?: boolean;
  className?: string;
}

export default function XIcon({ active = false, className }: XIconProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M14.8138 5.18632L5.1864 14.8137"
        stroke={
          active ? "var(--color-icon-button-icon-active)" : "var(--color-icon-button-icon-default)"
        }
        stroke-width="1.63636"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M5.1864 5.18632L14.8138 14.8137"
        stroke={
          active ? "var(--color-icon-button-icon-active)" : "var(--color-icon-button-icon-default)"
        }
        stroke-width="1.63636"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
