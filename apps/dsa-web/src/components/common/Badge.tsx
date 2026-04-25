import React from 'react';
import { cn } from '../../utils/cn';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'history';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  glow?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'border-border/80 bg-elevated/92 text-foreground',
  success: 'border-success/35 bg-success/16 text-[hsl(var(--color-success))]',
  warning: 'border-warning/35 bg-warning/16 text-[hsl(var(--color-warning))]',
  danger: 'border-danger/35 bg-danger/16 text-[hsl(var(--color-danger))]',
  info: 'border-cyan/45 bg-cyan/18 text-[hsl(var(--primary))]',
  history: 'border-purple/35 bg-purple/16 text-[hsl(var(--color-purple))]',
};

const glowStyles: Record<BadgeVariant, string> = {
  default: '',
  success: 'shadow-success/20',
  warning: 'shadow-warning/20',
  danger: 'shadow-danger/20',
  info: 'shadow-cyan/20',
  history: 'shadow-purple/20',
};

/**
 * Badge component with multiple variants and optional glow styling.
 */
export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  glow = false,
  className = '',
  style,
  ...rest
}) => {
  const sizeStyles = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      {...rest}
      style={style}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium backdrop-blur-sm',
        sizeStyles,
        variantStyles[variant],
        glow && `shadow-lg ${glowStyles[variant]}`,
        className,
      )}
    >
      {children}
    </span>
  );
};
