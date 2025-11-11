import styles from "./FilterIconTrigger.module.css";
import FilterIconSvg from "../../icons/FilterIcon/FilterIcon";

export default function FilterIconTrigger() {
  return (
    <div className={styles.root}>
      <FilterIconSvg className={styles.svg} />
    </div>
  );
}
