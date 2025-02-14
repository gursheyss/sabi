"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";

interface Brand {
  id: string;
  name: string;
  website: string;
  connected: boolean;
}

interface BrandCardProps {
  brand: Brand;
}

export function BrandCard({ brand }: BrandCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl">{brand.name}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <a
          href={brand.website}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:underline"
        >
          {brand.website}
        </a>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          variant={brand.connected ? "secondary" : "default"}
          asChild
        >
          <Link href={`/my-brands/${brand.id}/connections`}>
            {brand.connected ? "Manage Connections" : "Connect Accounts"}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
