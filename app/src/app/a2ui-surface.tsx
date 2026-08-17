"use client";

import { useEffect, useRef, useState } from "react";
import { A2uiSurface, createComponentImplementation } from "@a2ui/react/v0_9";
import {
  Catalog,
  CommonSchemas,
  MessageProcessor,
  type SurfaceModel,
} from "@a2ui/web_core/v0_9";
import { z } from "zod";
import {
  ODYSSEY_A2UI_CATALOG_ID,
  odysseyPerformanceA2uiActionSchema,
  parseOdysseyA2uiDocument,
  parseOdysseyParentPerformanceA2uiDocument,
  type OdysseyA2uiSurfaceId,
} from "../a2ui/document";

const OdysseyText = createComponentImplementation(
  {
    name: "OdysseyText",
    schema: z.object({
      text: z.string(),
      variant: z.enum(["h1", "h2", "body", "caption"]).optional(),
    }),
  },
  ({ props }) => {
    if (props.variant === "h1") return <h1>{props.text}</h1>;
    if (props.variant === "h2") return <h2>{props.text}</h2>;
    if (props.variant === "caption")
      return <p className="eyebrow">{props.text}</p>;
    return <p>{props.text}</p>;
  },
);

const OdysseyStatus = createComponentImplementation(
  {
    name: "OdysseyStatus",
    schema: z.object({
      tone: z.enum(["neutral", "positive", "caution"]),
      text: z.string(),
    }),
  },
  ({ props }) => (
    <p className={`a2ui-status a2ui-status-${props.tone}`}>{props.text}</p>
  ),
);

const OdysseyColumn = createComponentImplementation(
  {
    name: "OdysseyColumn",
    schema: z.object({ children: z.array(z.string()).max(24) }),
  },
  ({ props, buildChild }) => (
    <div className="a2ui-column">
      {props.children.map((child: string) => buildChild(child))}
    </div>
  ),
);

const OdysseyGuidanceCard = createComponentImplementation(
  {
    name: "OdysseyGuidanceCard",
    // The strict document parser, not this renderer schema, authorizes action data.
    schema: z.object({
      standardCode: z.string(),
      statusText: z.string(),
      action: CommonSchemas.Action.optional(),
    }),
  },
  ({ props }) => (
    <div className="guidance-card">
      <h3 className="guidance-code">{props.standardCode}</h3>
      <p className="guidance-status">{props.statusText}</p>
      {props.action && (
        <button className="secondary-btn" onClick={() => props.action?.()}>
          Practice this skill
        </button>
      )}
    </div>
  ),
);

const odysseyCatalog = new Catalog(ODYSSEY_A2UI_CATALOG_ID, [
  OdysseyText,
  OdysseyStatus,
  OdysseyColumn,
  OdysseyGuidanceCard,
]);

type OdysseySurfaceModel = SurfaceModel<typeof OdysseyText>;

/** Renders only locally validated, server-issued Odyssey A2UI documents. */
export function OdysseyA2uiSurface({
  document,
  surfaceId = "odyssey-performance",
  onPracticeTarget,
}: {
  document: unknown;
  surfaceId?: OdysseyA2uiSurfaceId;
  onPracticeTarget?: (topicId: string) => void;
}) {
  const [surface, setSurface] = useState<OdysseySurfaceModel | null>(null);
  const [error, setError] = useState(false);
  const onPracticeTargetRef = useRef(onPracticeTarget);
  onPracticeTargetRef.current = onPracticeTarget;

  useEffect(() => {
    const processor = new MessageProcessor([odysseyCatalog], (action) => {
      const parsed = odysseyPerformanceA2uiActionSchema.safeParse({
        name: action.name,
        surfaceId: action.surfaceId,
        sourceComponentId: action.sourceComponentId,
        context: action.context,
      });
      if (!parsed.success) return;
      onPracticeTargetRef.current?.(parsed.data.context.topicId);
    });
    setSurface(null);
    const subscription = processor.onSurfaceCreated((created) => {
      if (created.id === surfaceId) setSurface(created as OdysseySurfaceModel);
    });
    try {
      const parsed =
        surfaceId === "odyssey-parent-performance"
          ? parseOdysseyParentPerformanceA2uiDocument(document)
          : parseOdysseyA2uiDocument(document);
      processor.processMessages(parsed.messages);
    } catch {
      setError(true);
    }
    return () => subscription.unsubscribe();
  }, [document, surfaceId]);

  if (error)
    return <p role="alert">Performance is unavailable. Please retry.</p>;
  if (!surface) return <p>Loading performance…</p>;
  return <A2uiSurface surface={surface} />;
}
