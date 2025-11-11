import { useEffect, useMemo, useRef, useState } from "react";
import { ProgressBar } from "../../ui";
import styles from "./SanitizeProgress.module.css";

const LOADING_STAGES = [
  "Analyzing text...",
  "Scanning tables…",
  "Analyzing charts & data series…",
  "Processing speaker notes…",
  "Performing OCR on images & logos…",
  "Checking embedded objects…",
  "Finalizing results…",
];

const PREDICTED_TOTAL_MS = 2 * 60 * 1000; // 2 min

const MAX_BEFORE_ROLLBACK = 98;
const ROLLBACK_TO = 70;
const TICK_MS = 100;

export default function SanitizeProgress() {
  const [label, setLabel] = useState(LOADING_STAGES[0]);
  const [percent, setPercent] = useState(0);

  const virtualElapsedRef = useRef(0);
  const rollbackCountRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const stageDurationMs = useMemo(() => PREDICTED_TOTAL_MS / LOADING_STAGES.length, []);

  const updateStageLabel = (elapsedMs: number) => {
    const rawIndex = Math.floor(elapsedMs / stageDurationMs);
    const idx = Math.min(rawIndex, LOADING_STAGES.length - 1);
    setLabel(LOADING_STAGES[idx]);
  };

  useEffect(() => {
    const start = performance.now();
    let lastTick = start;

    timerRef.current = window.setInterval(() => {
      const now = performance.now();
      const dt = now - lastTick;
      lastTick = now;

      virtualElapsedRef.current += dt;
      let projected = (virtualElapsedRef.current / PREDICTED_TOTAL_MS) * 100;

      if (projected >= MAX_BEFORE_ROLLBACK) {
        if (rollbackCountRef.current === 0 || projected >= MAX_BEFORE_ROLLBACK + 1) {
          rollbackCountRef.current += 1;
          const targetElapsed = (ROLLBACK_TO / 100) * PREDICTED_TOTAL_MS;
          virtualElapsedRef.current = targetElapsed;
          projected = ROLLBACK_TO;
        } else {
          projected = MAX_BEFORE_ROLLBACK;
        }
      }

      const clamped = Math.min(projected, 99);
      setPercent(Math.round(clamped));

      updateStageLabel(virtualElapsedRef.current);
    }, TICK_MS);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [stageDurationMs]);

  return (
    <div className={styles.root}>
      <div className={styles.label}>
        <div className={styles.stage}>{label}</div>
        <div className={styles.percent}>{percent}%</div>
      </div>
      <ProgressBar percent={percent} />
    </div>
  );
}
