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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getIntegrationsUrl,
  refreshBrandConnection,
  updateChannelMappings,
} from "@/app/_actions/brands";
import { toast } from "sonner";
import { RefreshCw, Settings } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";

interface Brand {
  id: string;
  name: string;
  website: string;
  connected: boolean;
}

interface Channel {
  id: string;
  name: string;
}

interface BrandCardProps {
  brand: Brand;
  workspaceId?: string;
  channels?: Channel[];
  mappedChannelIds?: string[];
}

export function BrandCard({
  brand,
  workspaceId,
  channels = [],
  mappedChannelIds = [],
}: BrandCardProps) {
  const [selectedChannels, setSelectedChannels] =
    React.useState<string[]>(mappedChannelIds);
  const [isUpdating, setIsUpdating] = React.useState(false);

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

  const handleUpdateChannels = React.useCallback(async () => {
    if (!workspaceId) {
      toast.error("No workspace connected");
      return;
    }

    try {
      setIsUpdating(true);
      await updateChannelMappings({
        brandId: brand.id,
        workspaceId,
        channelIds: selectedChannels,
      });
      toast.success("Channel mappings updated successfully");
    } catch (error) {
      console.error("Error updating channel mappings:", error);
      toast.error("Failed to update channel mappings. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  }, [brand.id, workspaceId, selectedChannels]);

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
        {workspaceId && (
          <Dialog>
            <DialogTrigger asChild>
              <Button className="w-full" variant="outline">
                <Settings className="mr-2 h-4 w-4" />
                Channel Mappings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Map Channels to {brand.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Channels</label>
                  <MultiSelect
                    options={channels.map((channel) => ({
                      label: `#${channel.name}`,
                      value: channel.id,
                    }))}
                    selected={selectedChannels}
                    onChange={setSelectedChannels}
                    placeholder="Select channels..."
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleUpdateChannels}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Updating..." : "Update Mappings"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardFooter>
    </Card>
  );
}
