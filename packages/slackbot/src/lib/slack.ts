import { WebClient } from "@slack/web-api";

export const slack = new WebClient(process.env.SLACK_TOKEN!);
