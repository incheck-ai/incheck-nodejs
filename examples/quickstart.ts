import { Client } from "../src/index.js";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const client = new Client({
    apiKey: process.env.INCHECK_API_KEY,
    environment: (process.env.INCHECK_ENVIRONMENT as "production" | "staging" | undefined) ?? "production"
  });

  const orgId = process.env.INCHECK_ORG_ID;

  if (orgId) {
    const data = new Uint8Array(await readFile("./README.md"));

    const uploadResult = await client.documents.upload(
      orgId,
      [{ filename: "README.md", data }],
      { wait: false }
    );
    console.log("Upload status:", uploadResult.status);

    const docs = await client.documents.list(orgId);
    console.log("Document count:", docs.documents.length);
  }

  const chatResult = await client.chat.create({
    content: "What are the key signs of dehydration?",
    options: { orgId }
  });
  console.log("Chat response:", chatResult.content);

  console.log("Streaming response:");
  for await (const chunk of client.chat.stream({
    content: "Give me a concise dehydration triage checklist.",
    options: { orgId }
  })) {
    if (chunk.content) process.stdout.write(chunk.content);
  }
  process.stdout.write("\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
