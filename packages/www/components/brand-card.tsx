"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getIntegrationsUrl, refreshBrandConnection } from "@/app/_actions/brands";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

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
  const handleConnect = React.useCallback(async () => {
    try {
      const integrationsUrl = await getIntegrationsUrl(brand.id);
      window.open(integrationsUrl, "_blank");
    } catch (error) {
      console.error("Error getting integrations URL:", error);
      toast.error("Failed to get integrations URL. Please try again.");
    }
  }, [brand.id]);

  const handleRefreshConnection = React.useCallback(async () => {
    try {
      const result = await refreshBrandConnection(brand.id);
      window.open(result.authUrl, "_blank");
      toast.success(
        "Please complete the Triple Whale authorization in the new tab"
      );
    } catch (error) {
      console.error("Error refreshing connection:", error);
      toast.error("Failed to refresh connection. Please try again.");
    }
  }, [brand.id]);

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
      <CardFooter className="flex flex-col gap-2">
        <Button
          className="w-full"
          variant={brand.connected ? "secondary" : "default"}
          onClick={handleConnect}
        >
          {brand.connected ? "Manage Connections" : "Connect Accounts"}
        </Button>
          <Button
            className="w-full"
            variant="outline"
            onClick={handleRefreshConnection}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh Connection
          </Button>
      </CardFooter>
    </Card>
  );
}
