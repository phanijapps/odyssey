import { describe, expect, test } from "vitest";
import {
  Catalog,
  CommonSchemas,
  ComponentContext,
  GenericBinder,
  MessageProcessor,
} from "@a2ui/web_core/v0_9";
import { z } from "zod";

import {
  createTestA2uiDocument,
  odysseyTestA2uiActionSchema,
  parseOdysseyTestA2uiDocument,
} from "./test-document";

const assessmentId = "11111111-1111-4111-8111-111111111111";
const assignmentToken = "22222222-2222-4222-8222-222222222222";

describe("Test A2UI document", () => {
  test("compiles one fixed text-response action without answer material", () => {
    const document = createTestA2uiDocument({
      assessmentId,
      assignmentToken,
      question: "What is 2 + 2?",
    });

    expect(document.messages[2].updateComponents.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          component: "OdysseyTextResponse",
          value: { path: "/answer" },
          action: {
            event: {
              name: "test.submit",
              context: {
                assessmentId,
                assignmentToken,
                answer: { path: "/answer" },
              },
            },
          },
        }),
      ]),
    );
    expect(JSON.stringify(document)).not.toContain("correctAnswer");
  });

  test("accepts the producer's 400-character question boundary", () => {
    expect(
      createTestA2uiDocument({
        assessmentId,
        assignmentToken,
        question: "Q".repeat(400),
      }),
    ).toEqual(expect.any(Object));
  });

  test("rejects extra action context and altered component graphs", () => {
    const document = createTestA2uiDocument({
      assessmentId,
      assignmentToken,
      question: "What is 2 + 2?",
    });
    const invalidAction = structuredClone(document) as {
      messages: [
        unknown,
        unknown,
        { updateComponents: { components: unknown[] } },
      ];
    };
    const answer = invalidAction.messages[2].updateComponents.components[2] as {
      action: { event: { context: Record<string, unknown> } };
    };
    answer.action.event.context.answer = "4";
    expect(() => parseOdysseyTestA2uiDocument(invalidAction)).toThrow();

    const invalidGraph = structuredClone(document) as {
      messages: [
        unknown,
        unknown,
        { updateComponents: { components: unknown[] } },
      ];
    };
    (
      invalidGraph.messages[2].updateComponents.components[0] as {
        children: string[];
      }
    ).children = ["answer", "question"];
    expect(() => parseOdysseyTestA2uiDocument(invalidGraph)).toThrow();

    const invalidBinding = structuredClone(document) as unknown as {
      messages: [
        unknown,
        { updateDataModel: { path: string } },
        { updateComponents: { components: unknown[] } },
      ];
    };
    invalidBinding.messages[1].updateDataModel.path = "/other";
    expect(() => parseOdysseyTestA2uiDocument(invalidBinding)).toThrow();
  });

  test("accepts only the fixed submitted action", () => {
    expect(
      odysseyTestA2uiActionSchema.parse({
        name: "test.submit",
        surfaceId: "odyssey-test",
        sourceComponentId: "answer",
        context: { assessmentId, assignmentToken, answer: "4" },
      }),
    ).toEqual(expect.objectContaining({ name: "test.submit" }));
    expect(() =>
      odysseyTestA2uiActionSchema.parse({
        name: "practice.submit",
        surfaceId: "odyssey-test",
        sourceComponentId: "answer",
        context: { assessmentId, assignmentToken, answer: "4" },
      }),
    ).toThrow();
  });
});

test("resolves the bound answer into the fixed submit action", async () => {
  const received: unknown[] = [];
  const responseApi = {
    name: "OdysseyTextResponse",
    schema: z.object({
      label: z.string(),
      maxLength: z.literal(100),
      value: CommonSchemas.DynamicString,
      action: CommonSchemas.Action,
    }),
  };
  const catalog = new Catalog("odyssey.learning.v1", [
    {
      name: "OdysseyColumn",
      schema: z.object({ children: z.array(z.string()) }),
    },
    {
      name: "OdysseyText",
      schema: z.object({ text: z.string(), variant: z.string().optional() }),
    },
    responseApi,
  ]);
  const processor = new MessageProcessor([catalog], (action) => {
    received.push(action);
  });
  processor.processMessages(
    createTestA2uiDocument({
      assessmentId,
      assignmentToken,
      question: "What is 2 + 2?",
    }).messages,
  );
  const surface = processor.model.getSurface("odyssey-test");
  const context = new ComponentContext(surface!, "answer");
  const binder = new GenericBinder<{ action: () => void }>(
    context,
    responseApi.schema,
  );
  surface!.dataModel.set("/answer", "4");
  binder.snapshot.action();

  await expect
    .poll(() => received)
    .toEqual([
      expect.objectContaining({
        name: "test.submit",
        surfaceId: "odyssey-test",
        sourceComponentId: "answer",
        context: { assessmentId, assignmentToken, answer: "4" },
      }),
    ]);
  binder.dispose();
});
