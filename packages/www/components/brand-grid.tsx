"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { BrandCard } from "@/components/brand-card";
import { AddBrandModal } from "@/components/add-brand-modal";
import { createBrand } from "@/app/_actions/brands";
import { toast } from "sonner";
import { tripleWhaleAccounts } from "@lighthouse/database/src/schema";

interface Brand {
  id: string;
  name: string;
  website: string;
  tripleWhaleAccount: typeof tripleWhaleAccounts.$inferSelect | null;
}

interface BrandGridProps {
  initialBrands: Brand[];
}

export function BrandGrid({ initialBrands }: BrandGridProps) {
  const [brands, setBrands] = React.useState<Brand[]>(initialBrands);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleSave = React.useCallback(
    async (data: { name: string; website: string }) => {
      try {
        const result = await createBrand(data);

        // Add the new brand to the list
        setBrands((prev) => [
          ...prev,
          {
            id: result.brandId,
            name: data.name,
            website: data.website,
            tripleWhaleAccount: null,
          },
        ]);

        // Open Triple Whale auth URL in a new tab
        window.open(result.authUrl, "_blank");

        toast.success(
          "Brand created successfully! Please complete the Triple Whale connection in the new tab."
        );
      } catch (error) {
        console.error("Error creating brand:", error);
        toast.error("Failed to create brand. Please try again.");
      }
    },
    []
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Brands</h1>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Brand
        </Button>
      </div>

      {brands.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-8 text-center">
          <div className="text-lg font-semibold">No brands yet</div>
          <div className="text-sm text-muted-foreground">
            Get started by adding your first brand
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Brand
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={{
                id: brand.id,
                name: brand.name,
                website: brand.website,
                connected: !!brand.tripleWhaleAccount?.tripleWhaleAccessToken,
                slackConnected: false,
              }}
            />
          ))}
        </div>
      )}

      <AddBrandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
