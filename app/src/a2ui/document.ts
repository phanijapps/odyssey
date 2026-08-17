import { z } from "zod";

export const ODYSSEY_A2UI_CATALOG_ID = "odyssey.learning.v1";
const componentId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const topicId = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[^:]+::[^:]+::[^:]+::[^:]+$/);

const textComponent = z
  .object({
    component: z.literal("OdysseyText"),
    id: componentId,
    text: z.string().min(1).max(320),
    variant: z.enum(["h1", "h2", "body", "caption"]).optional(),
  })
  .strict();
const statusComponent = z
  .object({
    component: z.literal("OdysseyStatus"),
    id: componentId,
    tone: z.enum(["neutral", "positive", "caution"]),
    text: z.string().min(1).max(320),
  })
  .strict();
const practiceAction = z
  .object({
    event: z
      .object({
        name: z.literal("performance.practice"),
        context: z.object({ topicId }).strict(),
      })
      .strict(),
  })
  .strict();
const guidanceCardComponent = z
  .object({
    component: z.literal("OdysseyGuidanceCard"),
    id: z.string().regex(/^guidance-[0-9]{1,2}$/),
    standardCode: z.string().min(1).max(64),
    statusText: z.string().min(1).max(160),
    action: practiceAction.optional(),
  })
  .strict();
const columnComponent = z
  .object({
    component: z.literal("OdysseyColumn"),
    id: componentId,
    children: z.array(componentId).max(24),
  })
  .strict();

const component = z.discriminatedUnion("component", [
  textComponent,
  statusComponent,
  guidanceCardComponent,
  columnComponent,
]);

export const ODYSSEY_A2UI_SURFACE_IDS = [
  "odyssey-performance",
  "odyssey-parent-performance",
] as const;
export type OdysseyA2uiSurfaceId = (typeof ODYSSEY_A2UI_SURFACE_IDS)[number];

function createReadOnlyDocumentSchema(surfaceId: OdysseyA2uiSurfaceId) {
  const createSurface = z
    .object({
      version: z.literal("v0.9"),
      createSurface: z
        .object({
          surfaceId: z.literal(surfaceId),
          catalogId: z.literal(ODYSSEY_A2UI_CATALOG_ID),
        })
        .strict(),
    })
    .strict();
  const updateComponents = z
    .object({
      version: z.literal("v0.9"),
      updateComponents: z
        .object({
          surfaceId: z.literal(surfaceId),
          components: z.array(component).min(1).max(24),
        })
        .strict(),
    })
    .strict();

  return z
    .object({
      messages: z.tuple([createSurface, updateComponents]),
    })
    .strict()
    .superRefine((document, context) => {
      const components = document.messages[1].updateComponents.components;
      const byId = new Map(
        components.map((component) => [component.id, component]),
      );
      if (byId.size !== components.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate component id",
        });
        return;
      }
      const root = byId.get("root");
      if (!root || root.component !== "OdysseyColumn") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A2UI document requires an OdysseyColumn root",
        });
        return;
      }

      const visiting = new Set<string>();
      const visited = new Set<string>();
      const visit = (id: string): void => {
        if (visiting.has(id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A2UI component graph contains a cycle",
          });
          return;
        }
        if (visited.has(id)) return;
        const component = byId.get(id);
        if (!component) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: `A2UI child component ${id} is missing`,
          });
          return;
        }
        visiting.add(id);
        if (component.component === "OdysseyColumn")
          component.children.forEach(visit);
        visiting.delete(id);
        visited.add(id);
      };
      visit("root");
      if (visited.size !== components.length)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A2UI document contains an unreachable component",
        });
    });
}

/** A complete, local-only learner Performance A2UI v0.9 surface. */
export const odysseyA2uiDocumentSchema = createReadOnlyDocumentSchema(
  "odyssey-performance",
);
export type OdysseyA2uiDocument = z.infer<typeof odysseyA2uiDocumentSchema>;

/** A complete, local-only parent Performance A2UI v0.9 surface. */
export const odysseyParentPerformanceA2uiDocumentSchema =
  createReadOnlyDocumentSchema("odyssey-parent-performance");
export type OdysseyParentPerformanceA2uiDocument = z.infer<
  typeof odysseyParentPerformanceA2uiDocumentSchema
>;

/** Rejects unknown fields/components before the A2UI processor sees a learner document. */
export function parseOdysseyA2uiDocument(value: unknown): OdysseyA2uiDocument {
  return odysseyA2uiDocumentSchema.parse(value);
}

/** The only client event accepted from the fixed learner Performance surface. */
export const odysseyPerformanceA2uiActionSchema = z
  .object({
    name: z.literal("performance.practice"),
    surfaceId: z.literal("odyssey-performance"),
    sourceComponentId: z.string().regex(/^guidance-[0-9]{1,2}$/),
    context: z.object({ topicId }).strict(),
  })
  .strict();

export type OdysseyPerformanceA2uiAction = z.infer<
  typeof odysseyPerformanceA2uiActionSchema
>;

/** Rejects unknown fields/components before the A2UI processor sees a parent document. */
export function parseOdysseyParentPerformanceA2uiDocument(
  value: unknown,
): OdysseyParentPerformanceA2uiDocument {
  return odysseyParentPerformanceA2uiDocumentSchema.parse(value);
}
