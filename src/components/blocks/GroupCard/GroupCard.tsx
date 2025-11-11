import { useState } from "react";
import type { ChangelogGroup, TreatmentAction } from "../../../types/changelog.ts";
import { Dropdown } from "../../ui";
import styles from "./GroupCard.module.css";

type Props = {
  group: ChangelogGroup;
  onSelectionChange(group: ChangelogGroup, action: TreatmentAction, isSelected: boolean): void;
};

const ACTION_OPTIONS: { label: string; value: TreatmentAction }[] = [
  { label: "Replace", value: "replace" },
  { label: "Redact", value: "redact" },
  { label: "Skip", value: "skip" },
];

export default function GroupCard({ group, onSelectionChange }: Props) {
  const [selectedAction, setSelectedAction] = useState<TreatmentAction>("replace");

  const handleSelectionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const isSelected = event.target.checked;
    onSelectionChange(group, selectedAction, isSelected);
  };

  return (
    <div className={styles.root}>
      <label className={styles.title}>
        <input className={styles.checkbox} type="checkbox" onChange={handleSelectionChange} />
        <span>
          {group.value} [{group.items.length}]
        </span>
      </label>
      <div className={styles.treatment}>
        <Dropdown<TreatmentAction>
          options={ACTION_OPTIONS}
          value={selectedAction}
          onChange={setSelectedAction}
          gap={4}
        />
      </div>
    </div>
  );
}
