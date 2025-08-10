"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const router = useRouter();
  return (
    <nav className={cn("flex items-center space-x-1 text-sm", className)}>
      <Link
        href="/"
        onClick={(e) => { e.preventDefault(); router.push('/'); }}
        className="flex items-center hover:text-blue-600 transition-colors"
      >
        <Home className="w-4 h-4" />
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="w-4 h-4 mx-1 text-neutral-400" />
          {item.href ? (
            <Link
              href={item.label === '센터' ? '/' : item.href}
              onClick={(e) => { 
                e.preventDefault(); 
                const target = item.label === '센터' ? '/' : (item.href || '/');
                router.push(target); 
              }}
              className="hover:text-blue-600 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-neutral-900 dark:text-neutral-100 font-medium">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}