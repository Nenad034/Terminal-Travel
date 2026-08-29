import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/cn';

// shadcn/ui Badge — variant "ok"/"warn"/"danger" dodati uz standardne, jer M17 već ima
// ta tri semantička statusa (rezervacije/fakture/etc.) sa proverenim kontrastom.
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        ok: 'border-transparent bg-ok-bg text-ok',
        warn: 'border-transparent bg-warn-bg text-warn',
        danger: 'border-transparent bg-danger-bg text-danger',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
