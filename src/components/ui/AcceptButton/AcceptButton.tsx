import { CheckIcon } from "../../icons";
import IconButton from "../IconButton/IconButton";

interface AcceptButtonProps {
  active: boolean;
  loading?: boolean;
  disabled?: boolean;
  activate: () => void;
}

export default function AcceptButton({ active, activate, loading, disabled }: AcceptButtonProps) {
  const color = active ? "success" : "default";
  const icon = <CheckIcon active={active} />;

  return (
    <IconButton
      icon={icon}
      color={color}
      onClick={activate}
      loading={loading}
      disabled={disabled || active}
    />
  );
}
