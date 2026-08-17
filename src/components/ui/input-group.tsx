"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/input-group relative flex h-9 w-full min-w-0 items-center overflow-hidden rounded-2xl border border-input bg-background shadow-xs transition-[color,box-shadow] outline-none has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50",
        className,
      )}
      data-slot="input-group"
      {...props}
    />
  );
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        "inline-start": "order-first pl-2",
        "inline-end": "order-last pr-2",
        "block-start": "order-first w-full justify-start px-2.5 pt-2",
        "block-end": "order-last w-full justify-start px-2.5 pb-2",
      },
    },
    defaultVariants: { align: "inline-start" },
  },
);

function InputGroupAddon({
  align = "inline-start",
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      data-slot="input-group-addon"
      {...props}
    />
  );
}

function InputGroupButton({
  className,
  size = "xs",
  type = "button",
  variant = "ghost",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "type"> &
  VariantProps<typeof inputGroupButtonVariants> & {
    type?: "button" | "submit" | "reset";
  }) {
  return (
    <Button
      className={cn(inputGroupButtonVariants({ size }), className)}
      data-size={size}
      type={type}
      variant={variant}
      {...props}
    />
  );
}

const inputGroupButtonVariants = cva(
  "flex items-center gap-2 text-sm shadow-none",
  {
    variants: {
      size: {
        xs: "h-6 gap-1 rounded-md px-1.5",
        sm: "",
        "icon-xs": "size-6 rounded-md p-0",
        "icon-sm": "size-8 p-0",
      },
    },
    defaultVariants: { size: "xs" },
  },
);

function InputGroupText({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0",
        className,
      )}
      data-slot="input-group-control"
      {...props}
    />
  );
}

function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent shadow-none ring-0",
        className,
      )}
      data-slot="input-group-control"
      {...props}
    />
  );
}

export {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
};
