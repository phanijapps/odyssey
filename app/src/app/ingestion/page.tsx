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

type Workflow = {
  readonly id: string;
  readonly stage: Stage;
  readonly bronze?: {
    readonly fileName: string;
    readonly format: string;
    readonly byteSize: number;
    readonly warnings: readonly string[];
  };
  readonly silver?: {
    readonly sourceSummary: string;
    readonly records: readonly unknown[];
    readonly warnings: readonly string[];
  };
  readonly recordCount?: number;
  readonly graphProjected?: boolean;
};

const stageLabel: Record<Stage, string> = {
  bronze: "Bronze awaiting approval",
  "bronze-approved": "Bronze approved",
  silver: "Silver awaiting approval",
  "silver-approved": "Silver approved",
  gold: "Gold indexed",
};

const actions: Record<
  Exclude<Stage, "gold">,
  { label: string; value: string }
> = {
  bronze: { label: "Approve Bronze", value: "approve-bronze" },
  "bronze-approved": { label: "Generate Silver", value: "generate-silver" },
  silver: { label: "Approve Silver", value: "approve-silver" },
  "silver-approved": { label: "Generate Gold", value: "generate-gold" },
};

/** Desktop-only steward workflow for source promotion. */
export default function IngestionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/curriculum/ingestions", {
        method: "POST",
        headers: { origin: window.location.origin },
        body: form,
      });
      const body = (await response.json()) as Workflow & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Unable to validate source");
      setWorkflow(body);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to validate source",
      );
    } finally {
      setPending(false);
    }
  };

  const advance = async () => {
    if (!workflow || workflow.stage === "gold") return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/curriculum/ingestions/${workflow.id}/actions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: window.location.origin,
          },
          body: JSON.stringify({ action: actions[workflow.stage].value }),
        },
      );
      const body = (await response.json()) as Workflow & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? "Unable to advance workflow");
      setWorkflow(body);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to advance workflow",
      );
    } finally {
      setPending(false);
    }
  };

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
          {workflow ? stageLabel[workflow.stage] : "Ready for one source"}
        </span>
      </header>
      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <aside className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">One source at a time.</p>
          <p className="mt-2">
            Bronze and Silver are temporary. Gold alone powers semantic
            retrieval.
          </p>
        </aside>
        <Card size="sm">
          <CardHeader>
            <CardTitle>Submitted source</CardTitle>
            <CardDescription>
              Upload → Bronze approval → Silver review → Gold semantic index
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!workflow && (
              <label className="block text-sm font-medium">
                Source file
                <input
                  className="mt-2 block w-full text-sm"
                  type="file"
                  accept=".pdf,.csv,.json,.txt,text/plain,application/pdf,text/csv,application/json"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {workflow?.bronze && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <strong>{workflow.bronze.fileName}</strong>
                <p className="mt-1 text-muted-foreground">
                  {workflow.bronze.format.toUpperCase()} ·{" "}
                  {workflow.bronze.byteSize} bytes
                </p>
                {workflow.bronze.warnings.map((warning) => (
                  <p className="mt-1 text-muted-foreground" key={warning}>
                    {warning}
                  </p>
                ))}
              </div>
            )}
            {workflow?.silver && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <strong>Silver candidate</strong>
                <p className="mt-1 text-muted-foreground">
                  {workflow.silver.sourceSummary}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {workflow.silver.records.length} extracted records
                </p>
              </div>
            )}
            {workflow?.stage === "gold" && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <strong>Gold semantic layer ready</strong>
                <p className="mt-1 text-muted-foreground">
                  {workflow.recordCount ?? 0} records indexed in SQLite-Vec
                  {workflow.graphProjected ? " and Engram." : "."}
                </p>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="gap-2">
            {!workflow ? (
              <Button disabled={!file || pending} onClick={submit}>
                {pending ? "Validating…" : "Upload source"}
              </Button>
            ) : workflow.stage === "gold" ? null : (
              <Button disabled={pending} onClick={advance}>
                {pending ? "Working…" : actions[workflow.stage].label}
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
