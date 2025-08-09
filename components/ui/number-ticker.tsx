"use client";

import { cn } from "@/lib/utils";
import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

export const NumberTicker = ({
  value,
  direction = "up",
  delay = 0,
  className,
  suffix = "",
  prefix = "",
  decimalPlaces = 0,
}: {
  value: number;
  direction?: "up" | "down";
  delay?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
  decimalPlaces?: number;
}) => {
  const spring = useSpring(0, { damping: 60, stiffness: 300 });
  const display = useTransform(spring, (current) => {
    if (decimalPlaces > 0) {
      return current.toFixed(decimalPlaces);
    }
    return Math.round(current).toLocaleString();
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      spring.set(direction === "down" ? value : 0);
      spring.set(value);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [spring, delay, value, direction]);

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
};