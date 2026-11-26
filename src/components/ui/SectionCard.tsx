import React from "react";

interface SectionCardProps {
  children: React.ReactNode;
  className?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`w-full rounded-[15px] border border-[var(--wsj-border)] bg-[var(--wsj-card)] p-5 ${className}`}
    >
      {children}
    </div>
  );
};
