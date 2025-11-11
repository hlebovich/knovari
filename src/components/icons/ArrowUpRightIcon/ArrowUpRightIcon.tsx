import type { JSX } from "react";

export interface ArrowUpRightIconProps {
  className?: string;
}

export default function ArrowUpRightIcon({ className }: ArrowUpRightIconProps): JSX.Element {
  return (
    <svg 
      className={className}
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none"
    >
      <path 
        d="M7 17L17 7" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <path 
        d="M7 7H17V17" 
        stroke="currentColor" 
        strokeWidth="1.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
    </svg>
  );
}