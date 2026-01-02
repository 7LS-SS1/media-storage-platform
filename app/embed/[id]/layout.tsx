import type React from "react";

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="m-0 p-0 min-h-screen overflow-hidden bg-black">
      {children}
    </div>
  );
}
