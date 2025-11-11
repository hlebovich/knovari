import { SanitizeProgress } from "../../blocks/SanitizeProgress";
import styles from "./LoderScreen.module.css";

export default function LoaderScreen() {
  return (
    <div className={styles.root}>
      <SanitizeProgress />
    </div>
  );
}
