import React from "react";
import styles from "./Badge.module.css";

export type BadgeColor = "default" | "green" | "yellow" | "orange" | "red";

type IconVariantProps = {
  variant: "icon";
  icon: React.ReactNode;
  text?: never;
  color?: BadgeColor;
};

type DefaultVariantProps = {
  variant: "default";
  text: string;
  icon?: never;
  color?: BadgeColor;
};

type BadgeProps = IconVariantProps | DefaultVariantProps;

export default function Badge({ variant, color = "default", ...props }: BadgeProps) {
  const classNames = [styles.root, styles[`color-${color}`], styles[`variant-${variant}`]].join(
    " "
  );

  return (
    <div className={classNames} data-name="Badge">
      {variant === "icon" ? (
        <div className={styles.iconContent}>{props.icon}</div>
      ) : (
        <div className={styles.textContent}>
          <div className={styles.label}>{props.text}</div>
        </div>
      )}
    </div>
  );
}
