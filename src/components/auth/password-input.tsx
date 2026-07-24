"use client";

import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPasswordVisibilityState } from "@/lib/auth/password-visibility";

type Props = Omit<ComponentProps<typeof Input>, "type"> & {
  hidePasswordLabel: string;
  showPasswordLabel: string;
};

export function PasswordInput({
  hidePasswordLabel,
  showPasswordLabel,
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  const { buttonLabel, inputType } = getPasswordVisibilityState(visible, {
    hide: hidePasswordLabel,
    show: showPasswordLabel,
  });
  const VisibilityIcon = visible ? IconEyeOff : IconEye;

  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label={buttonLabel}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
        size="icon"
        type="button"
        variant="outline"
      >
        <VisibilityIcon data-icon="inline-start" />
      </Button>
      <Input {...props} type={inputType} />
    </div>
  );
}
