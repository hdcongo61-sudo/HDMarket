/**
 * Apple Design System Button Styles
 * Following Apple's Human Interface Guidelines (HIG)
 * Uses Apple System Blue #007AFF, proper radius, subtle shadows
 */

export const appleButtonStyles = {
  // Primary Button (Main actions) - Apple Blue
  primary: {
    base: "px-6 py-3 rounded-full font-semibold text-[17px] transition-all duration-200 tap-feedback min-h-[48px] flex items-center justify-center",
    enabled: "bg-[#007AFF] text-white hover:bg-[#0051D5] active:bg-[#0051D5] shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
    disabled: "bg-[#C7C7CC] text-white/80 cursor-not-allowed opacity-80"
  },
  
  // Secondary Button (Alternative actions)
  secondary: {
    base: "px-6 py-3 rounded-full font-semibold text-[17px] transition-all duration-200 tap-feedback min-h-[48px] flex items-center justify-center",
    enabled: "bg-white text-[#007AFF] border border-[#C7C7CC] hover:bg-[#F2F2F7] active:bg-[#E5E5EA] shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
    disabled: "bg-[#F2F2F7] text-[#AEAEB2] border-[#E5E5EA] cursor-not-allowed"
  },
  
  // Destructive Button (Delete, remove actions)
  destructive: {
    base: "px-6 py-3 rounded-full font-semibold text-[17px] transition-all duration-200 tap-feedback min-h-[48px] flex items-center justify-center",
    enabled: "bg-[#FF3B30] text-white hover:bg-[#E6342A] active:bg-[#CC2E26] shadow-[0_1px_3px_rgba(255,59,48,0.3)]",
    disabled: "bg-[#C7C7CC] text-white/80 cursor-not-allowed opacity-80"
  },
  
  // Tertiary Button (Subtle actions) - Filled tertiary
  tertiary: {
    base: "px-5 py-2.5 rounded-full font-medium text-[15px] transition-all duration-200 tap-feedback min-h-[44px] flex items-center justify-center",
    enabled: "bg-[rgba(120,120,128,0.12)] text-[#000] hover:bg-[rgba(120,120,128,0.18)] active:bg-[rgba(120,120,128,0.24)]",
    disabled: "bg-[rgba(120,120,128,0.08)] text-[#AEAEB2] cursor-not-allowed"
  },
  
  // Ghost Button (Minimal, text-like)
  ghost: {
    base: "px-4 py-2 rounded-full font-medium text-[15px] transition-all duration-200 tap-feedback min-h-[44px] flex items-center justify-center",
    enabled: "text-[#007AFF] hover:bg-[rgba(0,122,255,0.08)] active:bg-[rgba(0,122,255,0.16)]",
    disabled: "text-[#AEAEB2] cursor-not-allowed"
  },
  
  // Icon Button (Circular, icon only)
  icon: {
    base: "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 tap-feedback",
    enabled: "bg-[rgba(120,120,128,0.12)] text-[#000] hover:bg-[rgba(120,120,128,0.18)]",
    disabled: "bg-[rgba(120,120,128,0.08)] text-[#AEAEB2] cursor-not-allowed"
  },
  
  // Small Button
  small: {
    base: "px-4 py-2 rounded-full font-medium text-[15px] transition-all duration-200 tap-feedback min-h-[44px] flex items-center justify-center",
    enabled: "bg-[#007AFF] text-white hover:bg-[#0051D5] shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
    disabled: "bg-[#C7C7CC] text-white/80 cursor-not-allowed opacity-80"
  },
  
  // Large Button
  large: {
    base: "px-8 py-4 rounded-full font-semibold text-[19px] transition-all duration-200 tap-feedback min-h-[52px] flex items-center justify-center",
    enabled: "bg-[#007AFF] text-white hover:bg-[#0051D5] shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
    disabled: "bg-[#C7C7CC] text-white/80 cursor-not-allowed opacity-80"
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
