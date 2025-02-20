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
import {
  getIntegrationsUrl,
  refreshBrandConnection,
} from "@/app/_actions/brands";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, LinkIcon } from "lucide-react";
import type { Brand as DBBrand } from "@sabi/database/src/schema";
import { Badge } from "@/components/ui/badge";

interface BrandCardProps {
  brand: Pick<DBBrand, "id" | "name" | "website"> & {
    connected: boolean;
  };
  channelNames: string[];
}

export function BrandCard({ brand, channelNames }: BrandCardProps) {
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
    <Card className="flex flex-col transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-xl">
          <span className="truncate">{brand.name}</span>
          <Badge
            variant={brand.connected ? "default" : "secondary"}
            className="ml-2"
          >
            {brand.connected ? "Connected" : "Not Connected"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-2 pb-2">
        <a
          href={brand.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          <LinkIcon className="mr-1 h-4 w-4" />
          {brand.website}
        </a>
        {channelNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {channelNames.map((channel) => (
              <Badge key={channel} variant="outline">
                #{channel}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pt-2">
        <Button
          className="w-full"
          variant={brand.connected ? "secondary" : "default"}
          onClick={handleConnect}
        >
          {brand.connected ? "Manage Connections" : "Connect Accounts"}
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
        <Button
          className="w-full"
          variant="outline"
          onClick={handleRefreshConnection}
        >
          Refresh Connection
          <RefreshCw className="mr-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
