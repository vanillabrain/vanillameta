import * as React from "react"
import {
  Select as ShadcnSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select"
import { FormControl, FormLabel, FormHelperText } from "./form"
import { cn } from "@/lib/utils"

// MUI Select props interface
interface MuiSelectProps {
  value?: any
  onChange?: (event: { target: { value: any } }) => void
  onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void
  children?: React.ReactNode
  className?: string
  fullWidth?: boolean
  displayEmpty?: boolean
  size?: "small" | "medium" | "large"
  variant?: "outlined" | "filled" | "standard"
  label?: string
  helperText?: string
  error?: boolean
  required?: boolean
  disabled?: boolean
  placeholder?: string
  sx?: React.CSSProperties
  name?: string
  id?: string
  multiple?: boolean // TODO: 다중 선택 지원은 향후 구현
  renderValue?: (value: any) => React.ReactNode
  MenuProps?: any // 무시됨
  inputProps?: any // 무시됨
  SelectDisplayProps?: any // 무시됨
}

// MUI MenuItem props interface
interface MuiMenuItemProps {
  value?: any
  children?: React.ReactNode
  disabled?: boolean
  className?: string
  sx?: React.CSSProperties
}

/**
 * MUI Select를 Shadcn Select로 변환하는 호환성 컴포넌트
 */
export const Select = React.forwardRef<HTMLButtonElement, MuiSelectProps>(
  ({ 
    value,
    onChange,
    onBlur,
    onFocus,
    children,
    className,
    fullWidth = false,
    displayEmpty = false,
    size = "medium",
    variant = "outlined",
    label,
    helperText,
    error = false,
    required = false,
    disabled = false,
    placeholder,
    sx,
    name,
    id,
    multiple = false,
    renderValue,
    ...props
  }, ref) => {
    // Shadcn Select는 문자열 값만 지원하므로 변환
    const stringValue = value !== undefined && value !== null ? String(value) : undefined

    const handleValueChange = (newValue: string) => {
      // MUI onChange 이벤트 형식으로 변환
      const event = {
        target: {
          value: newValue === "" ? "" : newValue,
          name: name,
        }
      }
      onChange?.(event)
    }

    // size 매핑
    const sizeMap = {
      small: "sm" as const,
      medium: "default" as const,
      large: "default" as const, // large는 default로 매핑
    }

    // displayEmpty가 true이고 placeholder가 없으면 기본 placeholder 설정
    const selectPlaceholder = placeholder || (displayEmpty ? "선택" : undefined)

    // MenuItem 컴포넌트들을 SelectItem으로 변환
    const convertedChildren = React.Children.map(children, (child) => {
      if (React.isValidElement(child) && (child.type as any)?.displayName === 'MenuItem') {
        const { value: itemValue, children: itemChildren, disabled: itemDisabled } = child.props
        return (
          <SelectItem 
            key={itemValue} 
            value={String(itemValue)}
            disabled={itemDisabled}
          >
            {itemChildren}
          </SelectItem>
        )
      }
      return child
    })

    const selectComponent = (
      <ShadcnSelect
        value={stringValue}
        onValueChange={handleValueChange}
        disabled={disabled}
        name={name}
      >
        <SelectTrigger
          ref={ref}
          id={id}
          className={cn(
            fullWidth && "w-full",
            error && "border-destructive focus:ring-destructive",
            className
          )}
          size={sizeMap[size]}
          onBlur={onBlur}
          onFocus={onFocus}
          style={sx}
        >
          <SelectValue placeholder={selectPlaceholder}>
            {renderValue && stringValue ? renderValue(value) : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {convertedChildren}
        </SelectContent>
      </ShadcnSelect>
    )

    // label이나 helperText가 있으면 FormControl로 감싸기
    if (label || helperText) {
      return (
        <div className={cn("space-y-2", fullWidth && "w-full")}>
          {label && (
            <FormLabel htmlFor={id} required={required} className={error ? "text-destructive" : ""}>
              {label}
            </FormLabel>
          )}
          {selectComponent}
          {helperText && (
            <FormHelperText className={error ? "text-destructive" : ""}>
              {helperText}
            </FormHelperText>
          )}
        </div>
      )
    }

    return selectComponent
  }
)
Select.displayName = "Select"

/**
 * MUI MenuItem을 위한 호환성 컴포넌트
 * Select 내부에서 자동으로 SelectItem으로 변환됨
 */
export const MenuItem = React.forwardRef<HTMLDivElement, MuiMenuItemProps>(
  ({ value, children, disabled, className, sx, ...props }, ref) => {
    return (
      <div ref={ref} {...props}>
        {children}
      </div>
    )
  }
)
MenuItem.displayName = "MenuItem"

// FormControl 관련 컴포넌트들도 export (필요한 경우)
export { FormControl, FormLabel, FormHelperText }

// MUI Select API 호환성을 위한 추가 컴포넌트
export const InputLabel = FormLabel