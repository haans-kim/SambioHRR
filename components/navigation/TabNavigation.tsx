"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function TabNavigation() {
  const pathname = usePathname();

  const tabs = [
    { name: "전체 개요", href: "/" },
    { name: "팀별 분석", href: "/teams" },
    { name: "그룹별 분석", href: "/groups" },
  ];

  return (
    <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
      {tabs.map((tab) => {
        const isActive = tab.href === "/" 
          ? pathname === "/" 
          : pathname.startsWith(tab.href);
          
        return (
          <Link
            key={tab.name}
            href={tab.href}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-medium text-center rounded-md transition-all",
              isActive
                ? "bg-blue-500 text-white shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-white"
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}