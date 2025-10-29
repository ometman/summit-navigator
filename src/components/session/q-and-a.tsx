'use client';

import { useState } from 'react';
import {
  useFirestore,
  useUser,
  useMemoFirebase,
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

  // Temporarily disable question fetching
  const questions: Question[] | null = [];
  const isLoadingQuestions = false;
  const questionsError = null;


  const questionsRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'sessions', sessionId, 'questions');
  }, [firestore, sessionId]);


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

        {localError && (
          <Alert variant="destructive" className="mb-4">
             <AlertCircle className="h-4 w-4" />
            <AlertTitle>Submission Failed</AlertTitle>
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        )}

        <div className="text-center py-8 px-4 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground font-medium">Q&A is temporarily disabled.</p>
            <p className="text-sm text-muted-foreground/80">We are working on resolving a permissions issue.</p>
        </div>
      </CardContent>
    </Card>
  );
}
