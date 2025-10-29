'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ThumbsUp, MessageCircle, Send, Loader2, User, AlertCircle, Copy, CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


interface Question {
  id: string;
  text: string;
  author: string;
  upvotes: number;
  timestamp: number;
  upvotedBy: string[];
  answered: boolean;
}

export function QandA({ sessionId }: { sessionId:string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  
  const { user } = useUser();
  const [clientId, setClientId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    let id = localStorage.getItem('qa_client_id');
    if (!id) {
      id = `client_${Date.now()}_${Math.random()}`;
      localStorage.setItem('qa_client_id', id);
    }
    setClientId(id);

    try {
      setIsLoading(true);
      const storageKey = `questions_${sessionId}`;
      const storedQuestions = localStorage.getItem(storageKey);
      if (storedQuestions) {
        setQuestions(JSON.parse(storedQuestions));
      }
    } catch (e) {
      console.error("Failed to load questions from local storage", e);
      setLocalError("Could not load questions from your browser's storage.");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const saveQuestionsToLocalStorage = (updatedQuestions: Question[]) => {
    try {
      const storageKey = `questions_${sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedQuestions));
    } catch (e) {
      console.error("Failed to save questions to local storage", e);
      setLocalError("Could not save your action. Your browser's storage might be full.");
    }
  };

  const handleQuestionSubmit = async () => {
    if (!newQuestion.trim()) return;

    setIsSubmitting(true);
    setLocalError(null);

    await new Promise(resolve => setTimeout(resolve, 300));
    
    const questionData: Question = {
      id: `${Date.now()}`,
      text: newQuestion,
      author: postAnonymously ? 'Anonymous' : (user?.displayName || 'Anonymous Attendee'),
      upvotes: 0,
      timestamp: Date.now(),
      upvotedBy: [],
      answered: false,
    };
    
    const updatedQuestions = [questionData, ...questions];
    setQuestions(updatedQuestions);
    saveQuestionsToLocalStorage(updatedQuestions);

    setNewQuestion('');
    setPostAnonymously(false);
    setIsSubmitting(false);
  };

  const handleUpvote = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question || question.upvotedBy.includes(clientId)) {
      return; 
    }

    const updatedQuestions = questions.map(q => 
      q.id === questionId 
        ? { ...q, upvotes: q.upvotes + 1, upvotedBy: [...q.upvotedBy, clientId] }
        : q
    );

    setQuestions(updatedQuestions);
    saveQuestionsToLocalStorage(updatedQuestions);
  };

  const handleToggleAnswered = (questionId: string) => {
    const updatedQuestions = questions.map(q =>
        q.id === questionId ? { ...q, answered: !q.answered } : q
    );
    setQuestions(updatedQuestions);
    saveQuestionsToLocalStorage(updatedQuestions);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
        title: "Copied!",
        description: "Question text copied to clipboard.",
    });
  };

  const sortedQuestions = useMemo(() => {
    return [...questions].sort((a, b) => {
        if (a.answered !== b.answered) {
            return a.answered ? 1 : -1;
        }
        if (b.upvotes !== a.upvotes) {
            return b.upvotes - a.upvotes;
        }
        return b.timestamp - a.timestamp;
    });
  }, [questions]);

  return (
    <Card className="mt-8 bg-muted/20 border-t-4 border-primary/50 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-3 text-2xl font-bold text-primary">
                <MessageCircle className="h-7 w-7" />
                <span>Live Q&amp;A</span>
            </CardTitle>
            <Badge variant="secondary" className="text-lg">
                {questions.length} Questions
            </Badge>
        </div>
        <CardDescription>
          Ask a question or upvote your favorites. The most popular questions will be addressed by the speaker.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Type your question here..."
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              disabled={isSubmitting}
              onKeyDown={(e) => e.key === 'Enter' && !isSubmitting && handleQuestionSubmit()}
            />
            <Button
              onClick={handleQuestionSubmit}
              disabled={isSubmitting || !newQuestion.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Send />
              )}
              <span className="sr-only">Submit question</span>
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="anonymous"
              checked={postAnonymously}
              onCheckedChange={(checked) => setPostAnonymously(checked as boolean)}
              disabled={isSubmitting}
            />
            <Label
              htmlFor="anonymous"
              className="text-sm font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Post question anonymously
            </Label>
          </div>
        </div>

        {localError && (
          <Alert variant="destructive" className="mb-4">
             <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {isLoading ? (
             <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
             </div>
          ) : sortedQuestions.length > 0 ? (
            sortedQuestions.map((question) => (
              <div key={question.id} className={cn("flex items-start gap-4 p-4 rounded-lg bg-background/60 border", {"opacity-60 bg-green-50/50 border-green-200": question.answered})}>
                <div className="flex flex-col items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpvote(question.id)}
                        disabled={question.upvotedBy.includes(clientId)}
                        className="flex flex-col h-auto px-2 py-1 text-primary disabled:text-muted-foreground hover:text-primary/80"
                    >
                        <ThumbsUp className="h-5 w-5" />
                        <span className="font-bold text-sm">{question.upvotes}</span>
                    </Button>
                     <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(question.text)}
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        title="Copy question text"
                    >
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-1">
                  <p className="text-foreground">{question.text}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{question.author}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleToggleAnswered(question.id)}>
                        <CheckCircle2 className={cn("mr-2 h-4 w-4", question.answered ? "text-green-600" : "text-muted-foreground")} />
                        {question.answered ? "Answered" : "Mark Answered"}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground font-medium">No questions yet.</p>
                <p className="text-sm text-muted-foreground/80">Be the first to ask something!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
