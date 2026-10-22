import type { ReactNode } from "react";
import "./globals.css";
export const metadata = {
  title: "QChat · Quản trị",
  description: "Trung tâm quản trị QChat",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
