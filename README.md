# Lighthouse

This is a Bun workspace containing multiple packages:

- `@lighthouse/www`: The main website
- `@lighthouse/slackbot`: Slack integration
- `@lighthouse/database`: Shared database layer

## Development

To install dependencies:

```bash
bun install
```

To run the website:

```bash
cd packages/www
bun run dev
```

To run the Slackbot:

```bash
cd packages/slackbot
bun run dev
```

This project was created using `bun init` in bun v1.2.2. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
