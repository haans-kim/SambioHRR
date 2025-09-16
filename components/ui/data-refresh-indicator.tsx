"use client";

import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";

interface DataRefreshIndicatorProps {
  isLoading?: boolean;
  lastUpdated?: Date | null;
  error?: string | null;
  className?: string;
}

export function DataRefreshIndicator({
  isLoading = false,
  lastUpdated,
  error,
  className
}: DataRefreshIndicatorProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && lastUpdated && !error) {
      setShowSuccess(true);
      toast({
        variant: "success",
        title: "데이터 업데이트 완료",
        description: `${new Date(lastUpdated).toLocaleTimeString('ko-KR')}에 갱신되었습니다`,
        duration: 3000,
      });

      const timer = setTimeout(() => {
        setShowSuccess(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isLoading, lastUpdated, error, toast]);

  useEffect(() => {
    if (error) {
      toast({
        variant: "destructive",
        title: "업데이트 실패",
        description: error,
        duration: 5000,
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
        <span>데이터 업데이트 중...</span>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-green-600", className)}>
        <CheckCircle2 className="h-4 w-4" />
        <span>업데이트 완료</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-red-600", className)}>
        <AlertCircle className="h-4 w-4" />
        <span>업데이트 실패</span>
      </div>
    );
  }

  if (lastUpdated) {
    return (
      <div className={cn("text-xs text-muted-foreground", className)}>
        마지막 업데이트: {new Date(lastUpdated).toLocaleString('ko-KR')}
      </div>
    );
  }

  return null;
}