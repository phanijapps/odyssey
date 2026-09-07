import { Type } from "@earendil-works/pi-ai";

/** Typebox schema for one atlas node — validated at the completion boundary. */
export const AtlasNodeSchema = Type.Object(
  {
    concept: Type.String({ minLength: 3, maxLength: 60 }),
    tier: Type.Union([Type.Literal(1), Type.Literal(2), Type.Literal(3)]),
    question: Type.String({ minLength: 20, maxLength: 400 }),
    answer: Type.String({ minLength: 1, maxLength: 100 }),
    acceptableAnswers: Type.Array(
      Type.String({ minLength: 1, maxLength: 100 }),
      {
        maxItems: 5,
      },
    ),
    hint: Type.String({ minLength: 10, maxLength: 200 }),
    solution: Type.Array(Type.String({ minLength: 1, maxLength: 120 }), {
      minItems: 2,
      maxItems: 5,
    }),
    diagramSvg: Type.String({ maxLength: 20_000 }),
  },
  { additionalProperties: false },
);

/** Typebox schema for the full atlas payload. */
export const AtlasSchema = Type.Object(
  {
    nodes: Type.Array(AtlasNodeSchema, { minItems: 4, maxItems: 15 }),
  },
  { additionalProperties: false },
);
