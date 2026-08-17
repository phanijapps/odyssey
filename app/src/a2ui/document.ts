import { z } from "zod";

export const ODYSSEY_A2UI_CATALOG_ID = "odyssey.learning.v1";
const componentId = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);

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
const columnComponent = z
  .object({
    component: z.literal("OdysseyColumn"),
    id: componentId,
    children: z.array(componentId).max(16),
  })
  .strict();

const component = z.discriminatedUnion("component", [
  textComponent,
  statusComponent,
  columnComponent,
]);

const createSurface = z
  .object({
    version: z.literal("v0.9"),
    createSurface: z
      .object({
        surfaceId: z.literal("odyssey-performance"),
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
        surfaceId: z.literal("odyssey-performance"),
        components: z.array(component).min(1).max(16),
      })
      .strict(),
  })
  .strict();

/** A complete, local-only A2UI v0.9 surface accepted by Odyssey's renderer. */
export const odysseyA2uiDocumentSchema = z
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

export type OdysseyA2uiDocument = z.infer<typeof odysseyA2uiDocumentSchema>;

/** Rejects unknown fields/components before the A2UI processor sees a document. */
export function parseOdysseyA2uiDocument(value: unknown): OdysseyA2uiDocument {
  return odysseyA2uiDocumentSchema.parse(value);
}
