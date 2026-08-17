"use client";

import { useEffect, useState } from "react";
import { A2uiSurface, createComponentImplementation } from "@a2ui/react/v0_9";
import {
  Catalog,
  MessageProcessor,
  type SurfaceModel,
} from "@a2ui/web_core/v0_9";
import { z } from "zod";
import {
  ODYSSEY_A2UI_CATALOG_ID,
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
    schema: z.object({ children: z.array(z.string()).max(16) }),
  },
  ({ props, buildChild }) => (
    <div className="a2ui-column">
      {props.children.map((child: string) => buildChild(child))}
    </div>
  ),
);

const odysseyCatalog = new Catalog(ODYSSEY_A2UI_CATALOG_ID, [
  OdysseyText,
  OdysseyStatus,
  OdysseyColumn,
]);

type OdysseySurfaceModel = SurfaceModel<typeof OdysseyText>;

/** Renders only locally validated, server-issued Odyssey A2UI documents. */
export function OdysseyA2uiSurface({
  document,
  surfaceId = "odyssey-performance",
}: {
  document: unknown;
  surfaceId?: OdysseyA2uiSurfaceId;
}) {
  const [surface, setSurface] = useState<OdysseySurfaceModel | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const processor = new MessageProcessor([odysseyCatalog]);
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
