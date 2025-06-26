import * as React from "react"
import { Checkbox as ShadcnCheckbox } from "./checkbox"
import { Label } from "./label"
import { cn } from "@/lib/utils"

// MUI Checkbox props interface
interface MuiCheckboxProps {
  checked?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void
  value?: any
  name?: string
  id?: string
  disabled?: boolean
  required?: boolean
  color?: "primary" | "secondary" | "error" | "info" | "success" | "warning" | "default"
  size?: "small" | "medium" | "large"
  className?: string
  sx?: React.CSSProperties
  indeterminate?: boolean
  icon?: React.ReactNode
  checkedIcon?: React.ReactNode
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>
  inputRef?: React.Ref<HTMLInputElement>
}

// MUI FormControlLabel props interface
interface MuiFormControlLabelProps {
  control: React.ReactElement
  label: React.ReactNode
  labelPlacement?: "end" | "start" | "top" | "bottom"
  value?: any
  disabled?: boolean
  checked?: boolean
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void
  name?: string
  className?: string
  sx?: React.CSSProperties
  required?: boolean
}

/**
 * MUI Checkbox를 Shadcn Checkbox로 변환하는 호환성 컴포넌트
 */
export const Checkbox = React.forwardRef<HTMLButtonElement, MuiCheckboxProps>(
  ({ 
    checked,
    onChange,
    onBlur,
    onFocus,
    value,
    name,
    id,
    disabled = false,
    required = false,
    color = "primary",
    size = "medium",
    className,
    sx,
    indeterminate = false,
    icon,
    checkedIcon,
    inputProps,
    inputRef,
    ...props
  }, ref) => {
    // Shadcn Checkbox는 checked 대신 checked 상태를 사용
    const handleCheckedChange = (checkedState: boolean) => {
      // MUI onChange 이벤트 형식으로 변환
      const event = {
        target: {
          checked: checkedState,
          value: value,
          name: name,
        }
      } as React.ChangeEvent<HTMLInputElement>
      
      onChange?.(event, checkedState)
    }

    // size에 따른 클래스 설정
    const sizeClasses = {
      small: "h-3.5 w-3.5",
      medium: "h-4 w-4",
      large: "h-5 w-5"
    }

    // color에 따른 클래스 설정 (기본적으로 shadcn은 primary 색상 사용)
    const colorClasses = {
      primary: "",
      secondary: "data-[state=checked]:bg-secondary data-[state=checked]:border-secondary",
      error: "data-[state=checked]:bg-destructive data-[state=checked]:border-destructive",
      info: "data-[state=checked]:bg-info data-[state=checked]:border-info",
      success: "data-[state=checked]:bg-success data-[state=checked]:border-success",
      warning: "data-[state=checked]:bg-warning data-[state=checked]:border-warning",
      default: "data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900"
    }

    return (
      <ShadcnCheckbox
        ref={ref}
        id={id}
        name={name}
        value={value}
        checked={checked}
        onCheckedChange={handleCheckedChange}
        disabled={disabled}
        required={required}
        className={cn(
          sizeClasses[size],
          colorClasses[color],
          className
        )}
        style={sx}
        onBlur={onBlur as any}
        onFocus={onFocus as any}
        {...props}
      />
    )
  }
)
Checkbox.displayName = "Checkbox"

/**
 * MUI FormControlLabel을 위한 호환성 컴포넌트
 * Checkbox와 Label을 함께 렌더링
 */
export const FormControlLabel = React.forwardRef<HTMLDivElement, MuiFormControlLabelProps>(
  ({ 
    control,
    label,
    labelPlacement = "end",
    value,
    disabled,
    checked,
    onChange,
    name,
    className,
    sx,
    required,
    ...props
  }, ref) => {
    // control element에 props 전달
    const controlElement = React.cloneElement(control, {
      checked: checked !== undefined ? checked : control.props.checked,
      onChange: onChange || control.props.onChange,
      value: value || control.props.value,
      name: name || control.props.name,
      disabled: disabled || control.props.disabled,
      required: required || control.props.required,
    })

    // labelPlacement에 따른 flex 방향 설정
    const flexDirection = {
      end: "flex-row",
      start: "flex-row-reverse",
      top: "flex-col-reverse",
      bottom: "flex-col"
    }

    // labelPlacement에 따른 gap 설정
    const gapClass = labelPlacement === "top" || labelPlacement === "bottom" ? "gap-1" : "gap-2"

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center",
          flexDirection[labelPlacement],
          gapClass,
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        style={sx}
        {...props}
      >
        {controlElement}
        <Label
          htmlFor={control.props.id}
          className={cn(
            "font-normal cursor-pointer select-none",
            disabled && "cursor-not-allowed",
            required && "after:content-['*'] after:ml-0.5 after:text-destructive"
          )}
        >
          {label}
        </Label>
      </div>
    )
  }
)
FormControlLabel.displayName = "FormControlLabel"

// MUI FormGroup을 위한 간단한 컴포넌트
export const FormGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("space-y-2", className)}
        {...props}
      />
    )
  }
)
FormGroup.displayName = "FormGroup"