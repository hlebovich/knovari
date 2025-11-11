import { ApplyCheckIcon } from "../../icons";
import styles from "./AppliedBadge.module.css";

export default function AppliedBadge() {
  return (
    <div className={`${styles.root} ${styles.active}`}>
      <div className={styles.content}>
        <div className={styles.label}>
          <p className={styles.labelText}>Applied</p>
        </div>
        <div className={styles.iconContainer}>
          <ApplyCheckIcon className={styles.iconSvg} />
        </div>
      </div>
    </div>
  );
}
