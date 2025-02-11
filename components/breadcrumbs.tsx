"use client";

import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const routes = [
  {
    title: "Dashboard",
    url: "/dashboard",
  },
  {
    title: "My Brands",
    url: "/my-brands",
  },
];

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const currentRoute = routes.find((route) => route.url === pathname);

  if (!currentRoute) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.length > 1 && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>{currentRoute.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
