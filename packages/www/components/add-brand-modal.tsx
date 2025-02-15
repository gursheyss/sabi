"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SlackBrand {
  id: string;
  name: string;
}

const brandFormSchema = z.object({
  name: z.string().min(2, {
    message: "Brand name must be at least 2 characters.",
  }),
  website: z.string().url({
    message: "Please enter a valid website URL.",
  }),
  slackBrandId: z.string({
    required_error: "Please select a Slack brand to connect.",
  }),
});

type BrandFormValues = z.infer<typeof brandFormSchema>;

const defaultValues: Partial<BrandFormValues> = {
  name: "",
  website: "",
  slackBrandId: "",
};

interface AddBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: BrandFormValues) => Promise<{ authUrl: string }>;
  slackBrands?: SlackBrand[];
}

export function AddBrandModal({
  isOpen,
  onClose,
  onSave,
  slackBrands = [],
}: AddBrandModalProps) {
  const [isLoading, setIsLoading] = React.useState(false);
  const form = useForm<BrandFormValues>({
    resolver: zodResolver(brandFormSchema),
    defaultValues,
  });

  async function onSubmit(data: BrandFormValues) {
    setIsLoading(true);
    try {
      const response = await onSave(data);
      console.log("Triple Whale response:", response);

      if (!response?.authUrl) {
        throw new Error("No authorization URL received");
      }

      const authWindow = window.open(response.authUrl, "_blank");
      if (!authWindow) {
        toast.error(
          "Please enable popups to complete Triple Whale authorization"
        );
        return;
      }

      form.reset();
      onClose();
      toast.success(
        "Please complete the Triple Whale authorization in the new tab"
      );
    } catch (error) {
      console.error("Error in form submission:", error);
      toast.error("Failed to add brand. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const selectedBrand = slackBrands.find(
    (brand) => brand.id === form.watch("slackBrandId")
  );

  React.useEffect(() => {
    if (selectedBrand) {
      form.setValue("name", selectedBrand.name);
    }
  }, [selectedBrand, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Brand</DialogTitle>
          <DialogDescription>
            Select a brand from your Slack workspace to connect with Triple
            Whale.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="slackBrandId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slack Brand</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a brand from Slack" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {slackBrands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter brand name"
                      {...field}
                      disabled={!!selectedBrand}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com"
                      type="url"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Adding..." : "Add Brand"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
