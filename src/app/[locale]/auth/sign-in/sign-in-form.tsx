"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  type AuthActionState,
  signInWithPassword,
} from "@/app/[locale]/_actions/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: AuthActionState = { status: "idle" };

type Props = {
  backendEnabled: boolean;
  copy: {
    email: string;
    emailPlaceholder: string;
    hidePassword: string;
    password: string;
    passwordHelp: string;
    passwordPlaceholder: string;
    showPassword: string;
    submit: string;
  };
  locale: string;
  next: string;
};

export function SignInForm({ backendEnabled, copy, locale, next }: Props) {
  const [state, formAction, isPending] = useActionState(
    signInWithPassword,
    initialState,
  );

  useEffect(() => {
    if (state.status === "error" && state.message) {
      toast.error(state.message);
    }
  }, [state]);

  return (
    <form action={formAction}>
      <input name="locale" type="hidden" value={locale} />
      <input name="next" type="hidden" value={next} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">{copy.email}</FieldLabel>
          <Input
            autoComplete="email"
            id="email"
            name="email"
            placeholder={copy.emailPlaceholder}
            required
            type="email"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">{copy.password}</FieldLabel>
          <PasswordInput
            autoComplete="current-password"
            hidePasswordLabel={copy.hidePassword}
            id="password"
            name="password"
            placeholder={copy.passwordPlaceholder}
            required
            showPasswordLabel={copy.showPassword}
          />
          <FieldDescription>{copy.passwordHelp}</FieldDescription>
        </Field>
        <Button disabled={!backendEnabled || isPending} type="submit">
          {copy.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
