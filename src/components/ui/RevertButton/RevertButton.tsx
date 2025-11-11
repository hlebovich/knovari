import { RedoIcon } from "../../icons";
import IconButton from "../IconButton/IconButton";

interface RevertButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function RevertButton({ onClick, ...rest }: RevertButtonProps) {
  const icon = <RedoIcon />;

  return <IconButton icon={icon} color="default" {...rest} onClick={onClick} />;
}
