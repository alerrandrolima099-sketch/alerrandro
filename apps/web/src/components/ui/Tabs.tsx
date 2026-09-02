"use client";

import clsx from "clsx";
import { ReactNode } from "react";

export type TabItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  count?: number;
};

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border mb-6 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              isActive
                ? "border-primary text-white"
                : "border-transparent text-muted hover:text-white"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={clsx(
                  "text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center",
                  isActive ? "bg-primary/15 text-primary" : "bg-surfaceHover text-muted"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
