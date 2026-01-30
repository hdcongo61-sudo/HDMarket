/**
 * Apple Design System Button Styles
 * Following Apple's Human Interface Guidelines
 */

export const appleButtonStyles = {
  // Primary Button (Main actions)
  primary: {
    base: "px-6 py-3 rounded-3xl font-semibold text-base transition-all duration-200 active:scale-95 shadow-sm",
    enabled: "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md",
    disabled: "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
  },
  
  // Secondary Button (Alternative actions)
  secondary: {
    base: "px-6 py-3 rounded-3xl font-semibold text-base transition-all duration-200 active:scale-95 border border-gray-300",
    enabled: "bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-400",
    disabled: "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
  },
  
  // Destructive Button (Delete, remove actions)
  destructive: {
    base: "px-6 py-3 rounded-3xl font-semibold text-base transition-all duration-200 active:scale-95 shadow-sm",
    enabled: "bg-red-600 text-white hover:bg-red-700 hover:shadow-md",
    disabled: "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
  },
  
  // Tertiary Button (Subtle actions)
  tertiary: {
    base: "px-5 py-2.5 rounded-3xl font-medium text-sm transition-all duration-200 active:scale-95",
    enabled: "bg-gray-100 text-gray-700 hover:bg-gray-200",
    disabled: "bg-gray-50 text-gray-400 cursor-not-allowed opacity-60"
  },
  
  // Ghost Button (Minimal, text-like)
  ghost: {
    base: "px-4 py-2 rounded-3xl font-medium text-sm transition-all duration-200 active:scale-95",
    enabled: "text-blue-600 hover:bg-blue-50",
    disabled: "text-gray-400 cursor-not-allowed opacity-60"
  },
  
  // Icon Button (Circular, icon only)
  icon: {
    base: "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm",
    enabled: "bg-white text-gray-700 hover:bg-gray-100 hover:shadow-md border border-gray-200",
    disabled: "bg-gray-100 text-gray-400 cursor-not-allowed opacity-60"
  },
  
  // Small Button
  small: {
    base: "px-4 py-2 rounded-3xl font-medium text-sm transition-all duration-200 active:scale-95 shadow-sm",
    enabled: "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md",
    disabled: "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
  },
  
  // Large Button
  large: {
    base: "px-8 py-4 rounded-3xl font-semibold text-lg transition-all duration-200 active:scale-95 shadow-md",
    enabled: "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg",
    disabled: "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
  }
};

/**
 * Get Apple-style button classes
 * @param {string} variant - Button variant (primary, secondary, destructive, etc.)
 * @param {boolean} disabled - Whether button is disabled
 * @param {string} size - Optional size override (small, large)
 * @returns {string} Combined class string
 */
export const getAppleButtonClasses = (variant = 'primary', disabled = false, size = null) => {
  const style = size ? appleButtonStyles[size] : appleButtonStyles[variant];
  if (!style) return appleButtonStyles.primary.base;
  
  const state = disabled ? style.disabled : style.enabled;
  return `${style.base} ${state}`;
};
