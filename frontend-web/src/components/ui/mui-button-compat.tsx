import * as React from "react"
import { Button as ShadcnButton, buttonVariants } from "./button"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

// MUI Button variant mapping
const muiVariantMap = {
  text: "ghost",
  contained: "default", 
  outlined: "outline",
} as const

// Shadcn Button variant types
type ShadcnVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"

// MUI size mapping
const muiSizeMap = {
  small: "sm",
  medium: "default",
  large: "lg",
} as const

// MUI color mapping
const muiColorMap = {
  primary: "default",
  secondary: "secondary", 
  error: "destructive",
  warning: "destructive", // 경고는 destructive로 매핑
  info: "secondary", // 정보는 secondary로 매핑
  success: "default", // 성공은 default로 매핑
  inherit: "ghost",
} as const

interface MuiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "text" | "contained" | "outlined"
  size?: "small" | "medium" | "large"
  color?: "primary" | "secondary" | "error" | "warning" | "info" | "success" | "inherit"
  fullWidth?: boolean
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
  sx?: React.CSSProperties
  component?: React.ElementType
  href?: string
  asChild?: boolean
  // MUI specific props that should be filtered
  disableRipple?: boolean
  disableFocusRipple?: boolean
  disableTouchRipple?: boolean
  disableElevation?: boolean
}

/**
 * MUI Button을 Shadcn Button으로 변환하는 호환성 컴포넌트
 * 점진적 마이그레이션을 위해 MUI API를 유지하면서 Shadcn 스타일을 사용
 */
export const Button = React.forwardRef<HTMLButtonElement, MuiButtonProps>(
  ({ 
    className, 
    variant = "text",
    size = "medium", 
    color = "primary",
    fullWidth = false,
    startIcon,
    endIcon,
    sx,
    component,
    href,
    children,
    disabled,
    asChild = false,
    // Filter out MUI specific props
    disableRipple,
    disableFocusRipple,
    disableTouchRipple,
    disableElevation,
    ...props 
  }, ref) => {
    // MUI variant를 Shadcn variant로 변환
    const shadcnVariant = muiVariantMap[variant] || "default"
    const shadcnSize = muiSizeMap[size] || "default"
    
    // color에 따른 추가 스타일 처리
    const colorClass = React.useMemo(() => {
      if (color === "error" || color === "warning") {
        return "destructive"
      }
      if (color === "secondary" || color === "info") {
        return "secondary"
      }
      return shadcnVariant
    }, [color, shadcnVariant]) as ShadcnVariant

    // sx prop을 style로 변환
    const style = sx ? sx : undefined

    // fullWidth 처리
    const widthClass = fullWidth ? "w-full" : ""

    // component prop 처리
    const Comp = component || (href ? "a" : "button")
    
    // href가 있는 경우 asChild를 true로 설정
    const shouldUseAsChild = asChild || !!href || !!component

    const content = (
      <>
        {startIcon && <span className="mr-2">{startIcon}</span>}
        {children}
        {endIcon && <span className="ml-2">{endIcon}</span>}
      </>
    )

    if (shouldUseAsChild) {
      return (
        <ShadcnButton
          ref={ref}
          variant={colorClass}
          size={shadcnSize}
          className={cn(widthClass, className)}
          style={style}
          disabled={disabled}
          asChild
          {...props}
        >
          <Comp href={href}>
            {content}
          </Comp>
        </ShadcnButton>
      )
    }

    return (
      <ShadcnButton
        ref={ref}
        variant={colorClass}
        size={shadcnSize}
        className={cn(widthClass, className)}
        style={style}
        disabled={disabled}
        {...props}
      >
        {content}
      </ShadcnButton>
    )
  }
)
Button.displayName = "Button"

// IconButton 컴포넌트
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "small" | "medium" | "large"
  color?: MuiButtonProps["color"]
  edge?: "start" | "end" | false
  sx?: React.CSSProperties
  component?: React.ElementType
  href?: string
  // MUI specific props that should be filtered
  disableRipple?: boolean
  disableFocusRipple?: boolean
  disableTouchRipple?: boolean
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ 
    className, 
    size = "medium",
    color = "primary",
    edge,
    sx,
    component,
    href,
    children,
    // Filter out MUI specific props
    disableRipple,
    disableFocusRipple,
    disableTouchRipple,
    ...props 
  }, ref) => {
    // edge prop에 따른 margin 처리
    const edgeClass = edge === "start" ? "-ml-2" : edge === "end" ? "-mr-2" : ""
    
    // size에 따른 icon button 크기 설정
    const sizeClass = size === "small" ? "size-8" : size === "large" ? "size-10" : "size-9"

    const Comp = component || (href ? "a" : "button")
    const shouldUseAsChild = !!href || !!component

    if (shouldUseAsChild) {
      return (
        <ShadcnButton
          ref={ref}
          variant="ghost"
          size="icon"
          className={cn(sizeClass, edgeClass, className)}
          style={sx}
          asChild
          {...props}
        >
          <Comp href={href}>
            {children}
          </Comp>
        </ShadcnButton>
      )
    }

    return (
      <ShadcnButton
        ref={ref}
        variant="ghost"
        size="icon"
        className={cn(sizeClass, edgeClass, className)}
        style={sx}
        {...props}
      >
        {children}
      </ShadcnButton>
    )
  }
)
IconButton.displayName = "IconButton"

// ButtonGroup 컴포넌트
interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: MuiButtonProps["variant"]
  size?: MuiButtonProps["size"]
  color?: MuiButtonProps["color"]
  orientation?: "horizontal" | "vertical"
  fullWidth?: boolean
  sx?: React.CSSProperties
}

export const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ 
    className, 
    variant = "outlined",
    size = "medium",
    color = "primary",
    orientation = "horizontal",
    fullWidth = false,
    sx,
    children,
    ...props 
  }, ref) => {
    const orientationClass = orientation === "vertical" ? "flex-col" : "flex-row"
    const widthClass = fullWidth ? "w-full" : ""

    // ButtonGroup 내부의 Button들에 props 전달
    const childrenWithProps = React.Children.map(children, (child, index) => {
      if (React.isValidElement(child)) {
        const isFirst = index === 0
        const isLast = index === React.Children.count(children) - 1
        
        // 버튼 그룹 내에서 rounded 처리
        let roundedClass = ""
        if (orientation === "horizontal") {
          if (isFirst && !isLast) roundedClass = "rounded-r-none"
          else if (!isFirst && isLast) roundedClass = "rounded-l-none"
          else if (!isFirst && !isLast) roundedClass = "rounded-none"
        } else {
          if (isFirst && !isLast) roundedClass = "rounded-b-none"
          else if (!isFirst && isLast) roundedClass = "rounded-t-none"
          else if (!isFirst && !isLast) roundedClass = "rounded-none"
        }

        return React.cloneElement(child as React.ReactElement<any>, {
          variant: variant,
          size: size,
          color: color,
          className: cn(
            (child as React.ReactElement<any>).props.className,
            roundedClass,
            fullWidth && "flex-1"
          ),
        })
      }
      return child
    })

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex",
          orientationClass,
          widthClass,
          "-space-x-px", // 버튼 사이 border 중첩 처리
          className
        )}
        style={sx}
        {...props}
      >
        {childrenWithProps}
      </div>
    )
  }
)
ButtonGroup.displayName = "ButtonGroup"

// LoadingButton 컴포넌트 (로딩 상태 지원)
interface LoadingButtonProps extends MuiButtonProps {
  loading?: boolean
  loadingIndicator?: React.ReactNode
  loadingPosition?: "start" | "end" | "center"
}

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ 
    loading = false,
    loadingIndicator,
    loadingPosition = "center",
    startIcon,
    endIcon,
    children,
    disabled,
    ...props 
  }, ref) => {
    const defaultLoadingIndicator = (
      <svg
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    )

    const indicator = loadingIndicator || defaultLoadingIndicator

    let content = children
    if (loading) {
      if (loadingPosition === "start") {
        content = (
          <>
            {indicator}
            <span className="ml-2">{children}</span>
          </>
        )
      } else if (loadingPosition === "end") {
        content = (
          <>
            <span className="mr-2">{children}</span>
            {indicator}
          </>
        )
      } else {
        content = indicator
      }
    }

    return (
      <Button
        ref={ref}
        disabled={disabled || loading}
        startIcon={!loading ? startIcon : undefined}
        endIcon={!loading ? endIcon : undefined}
        {...props}
      >
        {content}
      </Button>
    )
  }
)
LoadingButton.displayName = "LoadingButton"