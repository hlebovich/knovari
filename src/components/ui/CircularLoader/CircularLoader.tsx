import styles from "./CircularLoader.module.css";

type Props = {
  size?: number;
  variant?: "default" | "inverted";
};

export const CircularLoader = ({ size = 20, variant = "default" }: Props) => {
  const borderSize = Math.max(2, Math.ceil(size / 10));
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        border: `${borderSize}px solid transparent`,
      }}
      className={`${styles.root} ${styles[variant]}`}
    />
  );
};
