import * as React from "react"
import { cn } from "../../utils/cn"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", type = "button", ...props }, ref) => {
    const baseStyle =
      "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
    const variants = {
      default: "bg-blue-600 text-white hover:bg-blue-500",
      outline: "border border-gray-300 text-gray-700 hover:bg-gray-100",
    }
    return (
      <button
        ref={ref}
        type={type} // ahora por defecto es "button"
        className={cn(baseStyle, variants[variant], className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
