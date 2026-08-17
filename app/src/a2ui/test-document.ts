import { z } from "zod";

import { ODYSSEY_A2UI_CATALOG_ID } from "./document";

const componentId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const assessmentId = z.string().uuid();
const assignmentToken = z.string().regex(/^[A-Za-z0-9_-]{32,}$/);

const submitAction = z
  .object({
    event: z
      .object({
        name: z.literal("test.submit"),
        context: z
          .object({
            assessmentId,
            assignmentToken,
            answer: z.object({ path: z.literal("/answer") }).strict(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const textComponent = z
  .object({
    component: z.literal("OdysseyText"),
    id: componentId,
    text: z.string().min(1).max(400),
    variant: z.enum(["h1", "h2", "body", "caption"]).optional(),
  })
  .strict();
const textResponseComponent = z
  .object({
    component: z.literal("OdysseyTextResponse"),
    id: z.literal("answer"),
    label: z.string().min(1).max(120),
    maxLength: z.literal(100),
    value: z.object({ path: z.literal("/answer") }).strict(),
    action: submitAction,
  })
  .strict();
const multipleChoiceComponent = z
  .object({
    component: z.literal("OdysseyMultipleChoice"),
    id: z.literal("answer"),
    label: z.string().min(1).max(120),
    options: z.array(z.string().min(1).max(120)).min(2).max(4),
    value: z.object({ path: z.literal("/answer") }).strict(),
    action: submitAction,
  })
  .strict();
const trueFalseComponent = z
  .object({
    component: z.literal("OdysseyTrueFalse"),
    id: z.literal("answer"),
    label: z.string().min(1).max(120),
    value: z.object({ path: z.literal("/answer") }).strict(),
    action: submitAction,
  })
  .strict();
const columnComponent = z
  .object({
    component: z.literal("OdysseyColumn"),
    id: componentId,
    children: z.array(componentId).max(3),
  })
  .strict();
const component = z.discriminatedUnion("component", [
  textComponent,
  textResponseComponent,
  multipleChoiceComponent,
  trueFalseComponent,
  columnComponent,
]);

const createSurface = z
  .object({
    version: z.literal("v0.9"),
    createSurface: z
      .object({
        surfaceId: z.literal("odyssey-test"),
        catalogId: z.literal(ODYSSEY_A2UI_CATALOG_ID),
      })
      .strict(),
  })
  .strict();
const updateDataModel = z
  .object({
    version: z.literal("v0.9"),
    updateDataModel: z
      .object({
        surfaceId: z.literal("odyssey-test"),
        path: z.literal("/answer"),
        value: z.literal(""),
      })
      .strict(),
  })
  .strict();
const updateComponents = z
  .object({
    version: z.literal("v0.9"),
    updateComponents: z
      .object({
        surfaceId: z.literal("odyssey-test"),
        components: z.array(component).length(3),
      })
      .strict(),
  })
  .strict();

/** Strict A2UI v0.9 Test surface with one server-bound submit action. */
export const odysseyTestA2uiDocumentSchema = z
  .object({
    messages: z.tuple([createSurface, updateDataModel, updateComponents]),
  })
  .strict()
  .superRefine((document, context) => {
    const components = document.messages[2].updateComponents.components;
    const byId = new Map(components.map((item) => [item.id, item]));
    const root = byId.get("root");
    if (
      !root ||
      root.component !== "OdysseyColumn" ||
      root.children.length !== 2 ||
      root.children[0] !== "question" ||
      root.children[1] !== "answer" ||
      byId.get("question")?.component !== "OdysseyText" ||
      !["OdysseyTextResponse", "OdysseyMultipleChoice", "OdysseyTrueFalse"].includes(
        byId.get("answer")?.component ?? "",
      )
    )
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Test A2UI document has an invalid fixed component graph",
      });
  });

export type OdysseyTestA2uiDocument = z.infer<
  typeof odysseyTestA2uiDocumentSchema
>;

/** Rejects every unregistered component, binding, function, and action shape. */
export function parseOdysseyTestA2uiDocument(
  value: unknown,
): OdysseyTestA2uiDocument {
  return odysseyTestA2uiDocumentSchema.parse(value);
}

/** Compiles one server-issued response shape into Odyssey's fixed catalog. */
export function createTestA2uiDocument(input: {
  assessmentId: string;
  assignmentToken: string;
  /** Legacy text callers may supply question; new callers supply interaction. */
  question?: string;
  interaction?:
    | { type: "text-response"; prompt: string; response: { maxLength: 100 } }
    | { type: "multiple-choice"; prompt: string; options: readonly string[] }
    | { type: "true-false"; prompt: string };
}): OdysseyTestA2uiDocument {
  const interaction = input.interaction ?? {
    type: "text-response" as const,
    prompt: input.question ?? "",
    response: { maxLength: 100 as const },
  };
  const answer =
    interaction.type === "text-response"
      ? { component: "OdysseyTextResponse" as const, id: "answer" as const, label: "Type your answer", maxLength: 100 as const, value: { path: "/answer" as const } }
      : interaction.type === "multiple-choice"
        ? { component: "OdysseyMultipleChoice" as const, id: "answer" as const, label: "Choose one answer", options: [...interaction.options], value: { path: "/answer" as const } }
        : { component: "OdysseyTrueFalse" as const, id: "answer" as const, label: "Choose true or false", value: { path: "/answer" as const } };
  return parseOdysseyTestA2uiDocument({
    messages: [
      { version: "v0.9", createSurface: { surfaceId: "odyssey-test", catalogId: ODYSSEY_A2UI_CATALOG_ID } },
      { version: "v0.9", updateDataModel: { surfaceId: "odyssey-test", path: "/answer", value: "" } },
      {
        version: "v0.9",
        updateComponents: {
          surfaceId: "odyssey-test",
          components: [
            { component: "OdysseyColumn", id: "root", children: ["question", "answer"] },
            { component: "OdysseyText", id: "question", text: interaction.prompt, variant: "h2" },
            { ...answer, action: { event: { name: "test.submit", context: { assessmentId: input.assessmentId, assignmentToken: input.assignmentToken, answer: { path: "/answer" } } } } },
          ],
        },
      },
    ],
  });
}

/** The only client event accepted from the fixed Test A2UI surface. */
export const odysseyTestA2uiActionSchema = z
  .object({
    name: z.literal("test.submit"),
    surfaceId: z.literal("odyssey-test"),
    sourceComponentId: z.literal("answer"),
    context: z
      .object({
        assessmentId,
        assignmentToken,
        answer: z.string().trim().min(1).max(100),
      })
      .strict(),
  })
  .strict();

export type OdysseyTestA2uiAction = z.infer<typeof odysseyTestA2uiActionSchema>;
