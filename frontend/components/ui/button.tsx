import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-[var(--foreground)] text-[var(--background)] hover:bg-neutral-800 active:scale-[0.98]",
                secondary:
                    "bg-[var(--accent)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent-hover)] hover:border-[var(--border-strong)]",
                outline:
                    "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--accent)] hover:border-[var(--border-strong)]",
                ghost:
                    "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]",
                destructive:
                    "bg-red-600 text-white hover:bg-red-700",
                success:
                    "bg-emerald-600 text-white hover:bg-emerald-700",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 px-3 text-sm",
                lg: "h-11 px-6 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = "Button";

export { Button, buttonVariants };
