import { describe, expect, it } from "vitest";
import { AsyncClient, Client, IncheckClient } from "../../src/index.js";

describe("Client aliases", () => {
  it("exports Client and AsyncClient as IncheckClient aliases", () => {
    expect(Client).toBe(IncheckClient);
    expect(AsyncClient).toBe(IncheckClient);
  });

  it("exposes metadata resource on the client", () => {
    const client = new IncheckClient({ apiKey: "test-key" });
    expect(client.metadata).toBeDefined();
    expect(typeof client.metadata.statesAndScopes).toBe("function");
  });
});
