import type { ReactNode } from "react";
import { CircularLoader } from "../CircularLoader/CircularLoader.tsx";
import styles from "./IconButton.module.css";

interface IconButtonProps {
  icon: ReactNode;
  color: "default" | "success" | "warning";
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function IconButton({ icon, color, loading, disabled, onClick }: IconButtonProps) {
  const rootClassName = `${styles.root} ${styles[color]} ${disabled || loading ? styles.disabled : ""}`;

  return (
    <button
      disabled={disabled || loading}
      type="button"
      className={rootClassName}
      onClick={onClick}
      data-name="IconButton"
    >
      {loading ? (
        <CircularLoader variant={color === "default" ? "default" : "inverted"} size={24} />
      ) : (
        <div className={styles.icon}>{icon}</div>
      )}
    </button>
  );
}
