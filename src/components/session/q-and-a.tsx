'use client';

import { useState } from 'react';
import {
  useFirestore,
  useUser,
  useMemoFirebase,
  useCollection,
} from '@/firebase';
import {
  addDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  doc,
  serverTimestamp,
  increment,
  arrayUnion,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ThumbsUp, MessageCircle, Send, Loader2, User, AlertCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Skeleton } from '@/components/ui/skeleton';

interface Question {
  id: string;
  text: string;
  author: string;
  upvotes: number;
  timestamp: any;
  upvotedBy: string[];
}

export function QandA({ sessionId }: { sessionId: string }) {
  const [newQuestion, setNewQuestion] = useState('');
  const [postAnonymously, setPostAnonymously] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const questionsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'sessions', sessionId, 'questions');
  }, [firestore, sessionId]);
  
  const questionsQuery = useMemoFirebase(() => {
    if (!questionsRef) return null;
    return query(questionsRef, orderBy('upvotes', 'desc'), orderBy('timestamp', 'desc'));
  }, [questionsRef]);

  const { data: questions, isLoading: isLoadingQuestions, error: questionsError } = useCollection<Question>(questionsQuery);

  const handleQuestionSubmit = async () => {
    if (!newQuestion.trim() || !user || !firestore || !questionsRef) {
      return;
    }
    setIsSubmitting(true);
    setLocalError(null);

    const questionData = {
      text: newQuestion,
      author: postAnonymously ? 'Anonymous' : user.displayName || 'Anonymous',
      authorId: user.uid,
      upvotes: 0,
      timestamp: serverTimestamp(),
      upvotedBy: [],
    };
    
    try {
      await addDoc(questionsRef, questionData);
      setNewQuestion('');
      setPostAnonymously(false);
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: questionsRef.path,
            operation: 'create',
            requestResourceData: questionData,
        });
        errorEmitter.emit('permission-error', contextualError);
        setLocalError('Failed to submit your question. Please check your permissions and try again.');
        console.error("Submission error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async (questionId: string) => {
    if (!user || !firestore) return;

    const question = questions?.find((q) => q.id === questionId);
    if (!question || question.upvotedBy.includes(user.uid)) {
      return; // Already upvoted or question not found
    }

    const questionRef = doc(firestore, 'sessions', sessionId, 'questions', questionId);
    
    try {
        await updateDoc(questionRef, {
            upvotes: increment(1),
            upvotedBy: arrayUnion(user.uid),
        });
    } catch (e: any) {
        const contextualError = new FirestorePermissionError({
            path: questionRef.path,
            operation: 'update',
            requestResourceData: { upvotes: 'increment(1)' },
        });
        errorEmitter.emit('permission-error', contextualError);
        console.error("Upvote error:", e);
        // Optionally show an error to the user that upvote failed
    }
  };

  const isComponentLoading = isUserLoading || (isLoadingQuestions && !questions);

  return (
    <Card className="mt-8 bg-muted/20 border-t-4 border-primary/50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-2xl font-bold text-primary">
          <MessageCircle className="h-7 w-7" />
          <span>Live Q&amp;A</span>
        </CardTitle>
        <CardDescription>
          Ask a question or upvote your favorites. The most popular questions will be addressed by the speaker.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={user ? "Type your question here..." : "Authenticating..."}
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              disabled={isSubmitting || !user}
              onKeyDown={(e) => e.key === 'Enter' && !isSubmitting && handleQuestionSubmit()}
            />
            <Button
              onClick={handleQuestionSubmit}
              disabled={isSubmitting || !newQuestion.trim() || !user}
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
              disabled={isSubmitting || !user}
            />
            <Label
              htmlFor="anonymous"
              className="text-sm font-medium leading-none text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Post question anonymously
            </Label>
          </div>
        </div>

        {(localError || questionsError) && (
          <Alert variant="destructive" className="mb-4">
             <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{localError || 'Could not load questions.'}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {isComponentLoading ? (
             <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
             </div>
          ) : questions && questions.length > 0 ? (
            questions.map((question) => (
              <div key={question.id} className="flex items-start gap-4 p-4 rounded-lg bg-background/60 border">
                <div className="flex flex-col items-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpvote(question.id)}
                        disabled={!user || question.upvotedBy.includes(user.uid)}
                        className="flex flex-col h-auto px-2 py-1 text-primary disabled:text-muted-foreground hover:text-primary/80"
                    >
                        <ThumbsUp className="h-5 w-5" />
                        <span className="font-bold text-sm">{question.upvotes}</span>
                    </Button>
                </div>
                <div className="flex-1">
                  <p className="text-foreground">{question.text}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{question.author}</span>
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
