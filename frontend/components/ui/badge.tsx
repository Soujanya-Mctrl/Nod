import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
    {
        variants: {
            variant: {
                default: "bg-[var(--foreground)] text-[var(--background)]",
                draft: "bg-[var(--background-secondary)] text-[var(--foreground-muted)] border border-[var(--border)]",
                awaiting: "bg-[var(--background-secondary)] text-[var(--foreground)] border border-[var(--border-strong)]",
                nodded: "bg-[var(--foreground)] text-[var(--background)]",
                declined: "bg-[var(--background-secondary)] text-[var(--foreground-muted)] border border-[var(--border)] line-through",
                completed: "bg-[var(--foreground)] text-[var(--background)]",
                outline: "border border-[var(--border)] text-[var(--foreground-muted)]",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    );
}

export { Badge, badgeVariants };
