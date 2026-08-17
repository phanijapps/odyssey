import { z } from "zod";

import { ODYSSEY_A2UI_CATALOG_ID } from "./document";

const componentId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const topicId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[^:]+::[^:]+::[^:]+::[^:]+$/);
const assignmentToken = z.string().regex(/^[A-Za-z0-9_-]{32,}$/);

const submitAction = z
  .object({
    event: z
      .object({
        name: z.literal("practice.submit"),
        context: z
          .object({
            topicId,
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
        surfaceId: z.literal("odyssey-practice"),
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
        surfaceId: z.literal("odyssey-practice"),
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
        surfaceId: z.literal("odyssey-practice"),
        components: z.array(component).length(3),
      })
      .strict(),
  })
  .strict();

/** Strict A2UI v0.9 Practice surface with one server-bound submit action. */
export const odysseyPracticeA2uiDocumentSchema = z
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
        message: "Practice A2UI document has an invalid fixed component graph",
      });
  });

export type OdysseyPracticeA2uiDocument = z.infer<
  typeof odysseyPracticeA2uiDocumentSchema
>;

/** Rejects every unregistered component, binding, function, and action shape. */
export function parseOdysseyPracticeA2uiDocument(
  value: unknown,
): OdysseyPracticeA2uiDocument {
  return odysseyPracticeA2uiDocumentSchema.parse(value);
}

/** Compiles one server-issued response shape into Odyssey's fixed catalog. */
export function createPracticeA2uiDocument(input: {
  topicId: string;
  assignmentToken: string;
  /** Legacy text callers may supply question; new callers supply interaction. */
  question?: string;
  interaction?:
    | { type: "text-response"; prompt: string; response: { maxLength: 100 } }
    | { type: "multiple-choice"; prompt: string; options: readonly string[] }
    | { type: "true-false"; prompt: string };
}): OdysseyPracticeA2uiDocument {
  const interaction = input.interaction ?? {
    type: "text-response" as const,
    prompt: input.question ?? "",
    response: { maxLength: 100 as const },
  };
  const answer =
    interaction.type === "text-response"
      ? {
          component: "OdysseyTextResponse" as const,
          id: "answer" as const,
          label: "Type your answer",
          maxLength: 100 as const,
          value: { path: "/answer" as const },
        }
      : interaction.type === "multiple-choice"
        ? {
            component: "OdysseyMultipleChoice" as const,
            id: "answer" as const,
            label: "Choose one answer",
            options: [...interaction.options],
            value: { path: "/answer" as const },
          }
        : {
            component: "OdysseyTrueFalse" as const,
            id: "answer" as const,
            label: "Choose true or false",
            value: { path: "/answer" as const },
          };
  return parseOdysseyPracticeA2uiDocument({
    messages: [
      { version: "v0.9", createSurface: { surfaceId: "odyssey-practice", catalogId: ODYSSEY_A2UI_CATALOG_ID } },
      { version: "v0.9", updateDataModel: { surfaceId: "odyssey-practice", path: "/answer", value: "" } },
      {
        version: "v0.9",
        updateComponents: {
          surfaceId: "odyssey-practice",
          components: [
            { component: "OdysseyColumn", id: "root", children: ["question", "answer"] },
            { component: "OdysseyText", id: "question", text: interaction.prompt, variant: "h2" },
            {
              ...answer,
              action: { event: { name: "practice.submit", context: { topicId: input.topicId, assignmentToken: input.assignmentToken, answer: { path: "/answer" } } } },
            },
          ],
        },
      },
    ],
  });
}

/** The only client event accepted from the fixed Practice A2UI surface. */
export const odysseyPracticeA2uiActionSchema = z
  .object({
    name: z.literal("practice.submit"),
    surfaceId: z.literal("odyssey-practice"),
    sourceComponentId: z.literal("answer"),
    context: z
      .object({
        topicId,
        assignmentToken,
        answer: z.string().trim().min(1).max(100),
      })
      .strict(),
  })
  .strict();

export type OdysseyPracticeA2uiAction = z.infer<
  typeof odysseyPracticeA2uiActionSchema
>;
