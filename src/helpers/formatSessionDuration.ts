export function formatSessionDuration(totalSecondsInput: number): string {
  const totalSeconds: number = Math.max(0, Math.floor(totalSecondsInput));

  const totalMinutes: number = Math.floor(totalSeconds / 60);
  const totalHours: number = Math.floor(totalMinutes / 60);

  const days: number = Math.floor(totalHours / 24);
  const hoursRemainder: number = totalHours % 24;
  const minutesRemainder: number = totalMinutes % 60;

  const hoursString: string = String(hoursRemainder).padStart(2, "0");
  const minutesString: string = String(minutesRemainder).padStart(2, "0");

  if (days === 0) {
    return `${hoursString}:${minutesString}`;
  }

  const daysString: string = String(days).padStart(2, "0");
  return `${daysString}:${hoursString}:${minutesString}`;
}
