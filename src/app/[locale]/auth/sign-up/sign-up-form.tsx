"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  type SignUpActionState,
  signUpWithPassword,
} from "@/app/[locale]/_actions/auth";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

const initialState: SignUpActionState = { status: "idle" };

export function SignUpForm({
  backendEnabled,
  copy,
  locale,
}: {
  backendEnabled: boolean;
  copy: {
    email: string;
    emailPlaceholder: string;
    hidePassword: string;
    name: string;
    namePlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    showPassword: string;
    submit: string;
  };
  locale: string;
}) {
  const [state, formAction, isPending] = useActionState(
    signUpWithPassword,
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
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="full_name">{copy.name}</FieldLabel>
          <Input
            autoComplete="name"
            id="full_name"
            name="full_name"
            placeholder={copy.namePlaceholder}
            required
          />
        </Field>
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
            autoComplete="new-password"
            hidePasswordLabel={copy.hidePassword}
            id="password"
            minLength={8}
            name="password"
            placeholder={copy.passwordPlaceholder}
            required
            showPasswordLabel={copy.showPassword}
          />
        </Field>
        <Button disabled={!backendEnabled || isPending} type="submit">
          {copy.submit}
        </Button>
      </FieldGroup>
    </form>
  );
}
