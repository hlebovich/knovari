import { useEffect, useMemo, useState } from "react";
import type { Priority, ShapeType, TreatmentAction, Type } from "../../../types/changelog.ts";
import {
  AcceptButton,
  AppliedBadge,
  Badge,
  Dropdown,
  RevertButton,
  Tooltip,
  TooltipProvider,
} from "../../ui";
import type { BadgeColor } from "../../ui/Badge/Badge.tsx";
import type { DropdownOption } from "../../ui/Dropdown/Dropdown.tsx";
import styles from "./Card.module.css";

export interface CardProps {
  priority: Priority;
  type: Type;
  shapeType: ShapeType;
  action?: TreatmentAction;
  category: string;
  rationale?: string;
  initialValue: string;
  proposedValue: string;
  groupId: number | null;
  isApplied: boolean;
  onResolveStatusChange: (isApplied: boolean, action: TreatmentAction) => void;
  onActionChange: (action: TreatmentAction) => void;
  isLoading?: boolean;
  error?: {
    message?: string;
    error?: Error;
  } | null;
}

const UNKNOWN_ITEM_DEFAULTS = {
  rationale: "Manual review required",
  initialValue: "Couldn't analyze",
  action: "skip" as TreatmentAction,
};

const CONFIDENCE_SCORE_CONFIG: Record<Priority, { color: BadgeColor; text: string }> = {
  high: { color: "green" as const, text: "High" },
  medium: { color: "yellow" as const, text: "Medium" },
  low: { color: "orange" as const, text: "Low" },
  veryLow: { color: "red" as const, text: "Very Low" },
  unknown: { color: "default" as const, text: "Unknown" },
};

export default function Card({
  priority,
  type,
  shapeType,
  action,
  category,
  rationale,
  initialValue,
  proposedValue,
  isApplied,
  isLoading,
  onResolveStatusChange,
  onActionChange,
  error,
}: CardProps) {
  const [lastAction, setLastAction] = useState<"accept" | "reject" | "revert" | null>(null);
  const defaultAction: TreatmentAction =
    shapeType === "unknown" ? UNKNOWN_ITEM_DEFAULTS.action : action || "replace";

  const [selectedAction, setSelectedAction] = useState<TreatmentAction>(defaultAction);

  const resolvedClass = useMemo(() => {
    return isApplied ? styles.resolved : "";
  }, [isApplied]);

  const handleAccept = () => {
    setLastAction("accept");
    onResolveStatusChange(true, selectedAction);
  };

  const handleRevert = () => {
    setLastAction("revert");
    onResolveStatusChange(false, selectedAction);
  };

  const handleActionChange = (newAction: TreatmentAction) => {
    setSelectedAction(newAction);
    onActionChange(newAction);
  };

  const getActionOptions = () => {
    const baseOptions: DropdownOption<TreatmentAction>[] = [
      { label: "Redact", value: "redact" },
      { label: "Skip", value: "skip" },
    ];

    const rangeOption: DropdownOption<TreatmentAction> = { label: "Obfuscate", value: "obfuscate" };
    const replaceOption: DropdownOption<TreatmentAction> = { label: "Replace", value: "replace" };

    if (type === "range") {
      return [rangeOption, ...baseOptions];
    }

    return [replaceOption, ...baseOptions];
  };

  useEffect(() => {
    if (action) {
      setSelectedAction(action);
    }
  }, [action]);

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.icon}>
              <Badge variant="icon" color={CONFIDENCE_SCORE_CONFIG[priority].color} icon="!" />
            </div>
            <div className={styles.info}>
              <TooltipProvider>
                <Tooltip content={category}>
                  <div className={styles.category}>{category}</div>
                </Tooltip>
              </TooltipProvider>

              <div className={`${styles.initialValue} ${resolvedClass}`}>
                {shapeType === "image" ? "Image" : shapeType === "chart" ? "Chart" : initialValue}
              </div>
            </div>
          </div>
          {isApplied ? (
            <div className={styles.actionsRight}>
              <AppliedBadge />
              <RevertButton
                loading={isLoading && lastAction === "revert"}
                disabled={isLoading}
                onClick={handleRevert}
              />
            </div>
          ) : (
            <Badge
              variant="default"
              color={CONFIDENCE_SCORE_CONFIG[priority].color}
              text={CONFIDENCE_SCORE_CONFIG[priority].text}
            />
          )}
        </div>

        {!isApplied && (
          <>
            <div className={styles.description}>{rationale}</div>

            {shapeType !== "unknown" && (
              <div className={styles.actions}>
                <div className={styles.actionsLeft}>
                  <div className={styles.treatment}>
                    <Dropdown<TreatmentAction>
                      options={getActionOptions()}
                      value={selectedAction}
                      onChange={handleActionChange}
                      gap={4}
                      disabled={isApplied || isLoading}
                    />
                  </div>
                  {(selectedAction === "replace" || selectedAction === "obfuscate") && (
                    <TooltipProvider>
                      <Tooltip content={proposedValue}>
                        <div className={styles.replaceValue}>
                          <p className={`${styles.replaceValueText} ${resolvedClass}`}>
                            {proposedValue}
                          </p>
                        </div>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className={styles.actionsRight}>
                  <AcceptButton
                    loading={isLoading && lastAction === "accept"}
                    disabled={isLoading}
                    active={false}
                    activate={handleAccept}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {error?.message && <div className={styles.error}>{error.message}</div>}
      </div>
    </div>
  );
}
