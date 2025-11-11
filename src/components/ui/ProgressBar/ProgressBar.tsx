import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  percent: number;
}

export default function ProgressBar({ percent }: ProgressBarProps) {
  // Clamp percent between 0 and 100
  const clampedPercent = Math.max(0, Math.min(100, percent));

  return (
    <div className={styles.root} data-name="Progress Indicators">
      <div className={styles.fill} style={{ width: `${clampedPercent}%` }} data-name="Line" />
      <div className={styles.track} data-name="Line" />
    </div>
  );
}
