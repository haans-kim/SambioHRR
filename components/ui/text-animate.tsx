"use client";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

export const TextAnimate = ({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, delay }}
        className={cn(className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};