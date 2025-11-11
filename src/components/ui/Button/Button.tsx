import React from "react";
import { CircularLoader } from "../CircularLoader/CircularLoader.tsx";
import styles from "./Button.module.css";

interface ButtonProps {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
}

export default function Button({
  children,
  disabled = false,
  loading = false,
  onClick,
  variant = "primary",
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`${styles.root} ${styles[variant]} ${className}`}
      aria-busy={loading}
      disabled={disabled || loading}
      onClick={onClick}
    >
      <div className={styles.content}>
        <div className={styles.labelWrapper}>
          {loading && <CircularLoader variant={variant === "primary" ? "inverted" : "default"} />}
          <div className={styles.label}>{children}</div>
        </div>
      </div>
    </button>
  );
}
