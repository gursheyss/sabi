"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Slack } from "lucide-react";
import { BrandCard } from "@/components/brand-card";
import { AddBrandModal } from "@/components/add-brand-modal";
import { createBrand } from "@/app/_actions/brands";
import { toast } from "sonner";
import type {
  Brand as DBBrand,
  ChannelBrandMapping,
} from "@sabi/database/src/schema";

interface BrandGridProps {
  initialBrands: DBBrand[];
  hasSlackWorkspace: boolean;
  channels?: ChannelBrandMapping[];
}

export function BrandGrid({
  initialBrands,
  hasSlackWorkspace,
  channels = [],
}: BrandGridProps) {
  const [brands] = React.useState<DBBrand[]>(initialBrands);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleSave = React.useCallback(
    async (data: { name: string; website: string; channelId: string }) => {
      if (!hasSlackWorkspace) {
        toast.error("Please connect to Slack before creating a brand");
        throw new Error("Slack workspace not connected");
      }

      try {
        const result = await createBrand(data);
        toast.success(
          "Please complete the Triple Whale authorization in the new tab"
        );
        return result;
      } catch (error) {
        console.error("Error creating brand:", error);
        toast.error("Failed to create brand. Please try again.");
        throw error;
      }
    },
    [hasSlackWorkspace]
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-end">
        {hasSlackWorkspace && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Brand
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {brands.map((brand) => (
          <BrandCard
            key={brand.id}
            brand={{
              id: brand.id,
              name: brand.name,
              website: brand.website,
              connected: !!brand.tripleWhaleAccessToken,
            }}
          />
        ))}
        {brands.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground">
            {hasSlackWorkspace ? (
              <>
                <p>No brands yet.</p>
                <p>Click &quot;Add Brand&quot; to create your first brand.</p>
              </>
            ) : (
              <>
                <p>Connect to Slack to start creating brands.</p>
                <p>
                  This allows you to manage your brands through Slack as well.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <AddBrandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        channels={channels.filter((channel) => !channel.brandId)}
      />
    </div>
  );
}
