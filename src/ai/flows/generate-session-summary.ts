// This file is machine-generated - edit at your own risk!

'use server';

/**
 * @fileOverview An AI agent that creates summaries for leadership sessions.
 *
 * - generateSessionSummary - A function that handles the session summarization process.
 * - GenerateSessionSummaryInput - The input type for the generateSessionSummary function.
 * - GenerateSessionSummaryOutput - The return type for the generateSessionSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateSessionSummaryInputSchema = z.object({
  speaker: z.string().describe('The name of the speaker for the leadership session.'),
  topic: z.string().describe('The topic of the leadership session.'),
  intendedAudience: z.string().describe('The intended audience for the leadership session.'),
});

export type GenerateSessionSummaryInput = z.infer<typeof GenerateSessionSummaryInputSchema>;

const GenerateSessionSummaryOutputSchema = z.object({
  summary: z.string().describe('A short, informative summary of the leadership session.'),
});

export type GenerateSessionSummaryOutput = z.infer<typeof GenerateSessionSummaryOutputSchema>;

export async function generateSessionSummary(input: GenerateSessionSummaryInput): Promise<GenerateSessionSummaryOutput> {
  return generateSessionSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSessionSummaryPrompt',
  input: {schema: GenerateSessionSummaryInputSchema},
  output: {schema: GenerateSessionSummaryOutputSchema},
  prompt: `You are an AI assistant that generates summaries for leadership sessions.

  Given the following information, create a short, informative summary of the leadership session.

  Speaker: {{{speaker}}}
  Topic: {{{topic}}}
  Intended Audience: {{{intendedAudience}}}

  Summary: `,
});

const generateSessionSummaryFlow = ai.defineFlow(
  {
    name: 'generateSessionSummaryFlow',
    inputSchema: GenerateSessionSummaryInputSchema,
    outputSchema: GenerateSessionSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
