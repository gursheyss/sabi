"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConnectSlackModal({ open }: { open: boolean }) {
  const installUrl = "https://slack.heysabi.com/slack/install";

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-[425px]"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Connect Your Slack Workspace</DialogTitle>
          <DialogDescription>
            To use Sabi, you need to connect your Slack workspace. This will
            allow us to send notifications and updates to your team.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          <Button asChild className="w-full">
            <a href={installUrl} target="_blank" rel="noopener noreferrer">
              Connect Slack Workspace
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
