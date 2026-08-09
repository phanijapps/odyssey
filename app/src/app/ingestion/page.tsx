"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Stage =
  | "bronze"
  | "bronze-approved"
  | "silver"
  | "silver-approved"
  | "gold";

const stageLabel: Record<Stage, string> = {
  bronze: "Bronze awaiting approval",
  "bronze-approved": "Bronze approved",
  silver: "Silver awaiting approval",
  "silver-approved": "Silver approved",
  gold: "Gold indexed",
};

/** Desktop-only steward workflow for source promotion. */
export default function IngestionPage() {
  const [stage, setStage] = useState<Stage>("bronze");
  const [sourceName, setSourceName] = useState<string | null>(null);
  const next = () =>
    setStage((current) =>
      current === "bronze"
        ? "bronze-approved"
        : current === "bronze-approved"
          ? "silver"
          : current === "silver"
            ? "silver-approved"
            : "gold",
    );
  const action =
    stage === "bronze"
      ? "Approve Bronze"
      : stage === "bronze-approved"
        ? "Ingest to Silver"
        : stage === "silver"
          ? "Approve Silver"
          : stage === "silver-approved"
            ? "Ingest to Gold"
            : "Gold indexed";
  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-5 flex items-center justify-between border-b pb-3">
        <div>
          <p className="text-xs text-muted-foreground">
            CURRICULUM STEWARD · DESKTOP
          </p>
          <h1 className="text-2xl font-semibold">Curriculum intake</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {stageLabel[stage]}
        </span>
      </header>
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <aside className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">One source at a time.</p>
          <p className="mt-2">
            Gold alone powers questions and semantic retrieval.
          </p>
        </aside>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Submitted source</CardTitle>
            <CardDescription>
              Bronze → approval → Silver → approval → Gold
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!sourceName ? (
              <label className="block text-sm font-medium">
                Source file
                <input
                  className="mt-2 block w-full text-sm"
                  type="file"
                  accept=".pdf,.csv,.json,.txt,text/plain,application/pdf,text/csv,application/json"
                  onChange={(event) =>
                    setSourceName(event.target.files?.[0]?.name ?? null)
                  }
                />
              </label>
            ) : (
              <p className="mb-3 text-sm text-muted-foreground">
                Bronze source: {sourceName}
              </p>
            )}
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <strong>{stageLabel[stage]}</strong>
              <p className="mt-1 text-muted-foreground">
                Pi agents synthesize content; they cannot approve promotions.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={next} disabled={!sourceName || stage === "gold"}>
              {action}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
