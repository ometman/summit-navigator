"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wand2, Loader2 } from "lucide-react";
import {
  generateSessionSummary,
  type GenerateSessionSummaryInput,
} from "@/ai/flows/generate-session-summary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AiSummary({
  speaker,
  topic,
  intendedAudience,
}: GenerateSessionSummaryInput) {
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    setIsLoading(true);
    setError(null);
    setSummary("");
    try {
      const result = await generateSessionSummary({
        speaker,
        topic,
        intendedAudience,
      });
      setSummary(result.summary);
    } catch (e) {
      console.error(e);
      setError("An error occurred while generating the summary.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mt-8 bg-muted/30 border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl text-primary">
          <Wand2 className="h-6 w-6" />
          <span>AI-Powered Summary</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!summary && !isLoading && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm flex-1">
              Want a quick overview? Let AI generate a concise summary of this session's key takeaways.
            </p>
            <Button onClick={handleGenerateSummary}>
              <Wand2 className="mr-2" />
              Generate Summary
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin" />
            <span>Generating summary, please wait...</span>
          </div>
        )}

        {error && (
            <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        {summary && (
          <div>
            <blockquote className="text-foreground italic">"{summary}"</blockquote>
            <Button
              variant="link"
              onClick={handleGenerateSummary}
              className="pl-0 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" />
                  Regenerating...
                </>
              ) : (
                "Regenerate"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
