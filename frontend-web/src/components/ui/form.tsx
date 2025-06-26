import * as React from "react"
import { cn } from "@/lib/utils"
import { Label } from "./label"

// FormControl - 폼 요소를 감싸는 컨테이너
export const FormControl = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    error?: boolean
    disabled?: boolean
    required?: boolean
    fullWidth?: boolean
  }
>(({ className, error, disabled, required, fullWidth, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "space-y-2",
        fullWidth && "w-full",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    />
  )
})
FormControl.displayName = "FormControl"

// FormLabel - 폼 요소의 라벨
export const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<typeof Label> & {
    error?: boolean
    required?: boolean
  }
>(({ className, error, required, children, ...props }, ref) => {
  return (
    <Label
      ref={ref}
      className={cn(
        error && "text-destructive",
        required && "after:content-['*'] after:ml-0.5 after:text-destructive",
        className
      )}
      {...props}
    >
      {children}
    </Label>
  )
})
FormLabel.displayName = "FormLabel"

// FormHelperText - 폼 요소의 도움말 텍스트
export const FormHelperText = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement> & {
    error?: boolean
  }
>(({ className, error, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn(
        "text-sm text-muted-foreground",
        error && "text-destructive",
        className
      )}
      {...props}
    />
  )
})
FormHelperText.displayName = "FormHelperText"

// FormGroup - 여러 폼 요소를 그룹핑
export const FormGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    row?: boolean
  }
>(({ className, row, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        row ? "flex flex-row gap-4 items-center" : "space-y-2",
        className
      )}
      {...props}
    />
  )
})
FormGroup.displayName = "FormGroup"