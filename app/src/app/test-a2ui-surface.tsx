"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { A2uiSurface, createComponentImplementation } from "@a2ui/react/v0_9";
import {
  Catalog,
  CommonSchemas,
  MessageProcessor,
  type SurfaceModel,
} from "@a2ui/web_core/v0_9";
import { z } from "zod";
import { MathText } from "../components/math-text";
import { ODYSSEY_A2UI_CATALOG_ID } from "../a2ui/document";
import {
  odysseyTestA2uiActionSchema,
  parseOdysseyTestA2uiDocument,
  type OdysseyTestA2uiAction,
  type OdysseyTestA2uiDocument,
} from "../a2ui/test-document";

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
    if (props.variant === "h2")
      return (
        <h2 className="question-text">
          <MathText>{props.text}</MathText>
        </h2>
      );
    if (props.variant === "caption")
      return <p className="eyebrow">{props.text}</p>;
    return <p>{props.text}</p>;
  },
);

const OdysseyColumn = createComponentImplementation(
  {
    name: "OdysseyColumn",
    schema: z.object({ children: z.array(z.string()).max(3) }),
  },
  ({ props, buildChild }) => (
    <div className="a2ui-column">
      {props.children.map((child: string) => buildChild(child))}
    </div>
  ),
);

const OdysseyTextResponse = createComponentImplementation(
  {
    name: "OdysseyTextResponse",
    // The strict document parser, not this renderer schema, authorizes action data.
    schema: z.object({
      label: z.string(),
      maxLength: z.literal(100),
      value: CommonSchemas.DynamicString,
      action: CommonSchemas.Action,
    }),
  },
  ({ props }) => (
    <form
      className="answer-row"
      onSubmit={(event) => {
        event.preventDefault();
        props.action();
      }}
    >
      <label className="sr-only" htmlFor="odyssey-a2ui-answer">
        {props.label}
      </label>
      <input
        id="odyssey-a2ui-answer"
        className="answer-input"
        value={props.value}
        maxLength={props.maxLength}
        onChange={(event) => props.setValue(event.target.value)}
        placeholder={props.label}
        autoFocus
      />
      <button
        className="primary-button"
        type="submit"
        disabled={!props.value.trim()}
      >
        Check
      </button>
    </form>
  ),
);

const testCatalog = new Catalog(ODYSSEY_A2UI_CATALOG_ID, [
  OdysseyText,
  OdysseyColumn,
  OdysseyTextResponse,
]);
type TestSurfaceModel = SurfaceModel<typeof OdysseyText>;

/** Renders and dispatches only the fixed, validated Test A2UI contract. */
export function OdysseyTestA2uiSurface({
  document,
  onSubmit,
}: {
  document: OdysseyTestA2uiDocument;
  onSubmit: (action: OdysseyTestA2uiAction) => Promise<void>;
}) {
  const [surface, setSurface] = useState<TestSurfaceModel | null>(null);
  const [error, setError] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    const processor = new MessageProcessor([testCatalog], (action) => {
      const parsed = odysseyTestA2uiActionSchema.safeParse({
        name: action.name,
        surfaceId: action.surfaceId,
        sourceComponentId: action.sourceComponentId,
        context: action.context,
      });
      if (!parsed.success || submitting.current) return;
      submitting.current = true;
      return onSubmit(parsed.data).finally(() => {
        submitting.current = false;
      });
    });
    setSurface(null);
    setError(false);
    const subscription = processor.onSurfaceCreated((created) => {
      if (created.id === "odyssey-test")
        setSurface(created as TestSurfaceModel);
    });
    try {
      processor.processMessages(
        parseOdysseyTestA2uiDocument(document).messages,
      );
    } catch {
      setError(true);
    }
    return () => subscription.unsubscribe();
  }, [document, onSubmit]);

  if (error) return <p role="alert">Test is unavailable. Please retry.</p>;
  if (!surface) return <p>Loading test…</p>;
  return <A2uiSurface surface={surface} />;
}
