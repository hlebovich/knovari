import React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDownIcon } from "../../icons";
import styles from "./Dropdown.module.css";

export interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

export interface DropdownProps<T extends string> {
  options: DropdownOption<T>[];
  value: string;
  onChange: (value: T) => void;
  trigger?: React.ReactNode;
  anchor?:
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "top start"
    | "top end"
    | "bottom start"
    | "bottom end"
    | "left start"
    | "left end"
    | "right start"
    | "right end";
  gap?: number;
  disabled?: boolean;
}

function parseAnchor(anchor: string) {
  const parts = anchor.split(" ");
  const side = parts[0] as "top" | "bottom" | "left" | "right";
  const align = parts[1] as "start" | "center" | "end" | undefined;

  return {
    side: side || "bottom",
    align: align || "start",
  };
}

const Dropdown = <T extends string>({
  options,
  value,
  onChange,
  trigger,
  anchor = "bottom start",
  gap = 12,
  disabled = false,
}: DropdownProps<T>) => {
  const selectedOption = options.find((option) => option.value === value);
  const { side, align } = parseAnchor(anchor);

  return (
    <div className={styles.root}>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild disabled={disabled}>
          <button
            className={`${styles.trigger} ${disabled ? styles.disabled : ""}`}
            disabled={disabled}
          >
            {trigger ? (
              trigger
            ) : (
              <div className={styles.content}>
                <div className={styles.label}>
                  <p className={styles.text}>{selectedOption?.label || "Select..."}</p>
                </div>
                <div className={styles.icon}>
                  <ChevronDownIcon className={styles.iconSvg} />
                </div>
              </div>
            )}
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.dropdown}
            side={side}
            align={align}
            sideOffset={gap}
            collisionPadding={8}
          >
            {options.map((option) => (
              <DropdownMenu.Item
                key={option.value}
                className={`${styles.option} ${option.value === value ? styles.optionSelected : ""}`}
                onSelect={() => onChange(option.value)}
              >
                <p className={styles.text}>{option.label}</p>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
};

export default Dropdown;
