'use client';

import { useState } from 'react';
import {
  useFirestore,
  useUser,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import {
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
import { ThumbsUp, MessageCircle, Send, Loader2, User } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { firestore } = useFirestore() || {};
  const { user, isUserLoading } = useUser();

  const questionsRef = useMemoFirebase(
    () => {
      if (!firestore) return null;
      return collection(firestore, 'sessions', sessionId, 'questions');
    },
    [firestore, sessionId]
  );

  const questionsQuery = useMemoFirebase(
    () => {
      if (!questionsRef) return null;
      return query(questionsRef, orderBy('upvotes', 'desc'));
    },
    [questionsRef]
  );

  const {
    data: questions,
    isLoading: isLoadingQuestions,
    error: questionsError,
  } = useCollection<Question>(questionsQuery);

  const handleQuestionSubmit = () => {
    if (!newQuestion.trim() || !user || !questionsRef) {
      return;
    }
    setIsSubmitting(true);
    setLocalError(null);

    const questionData = {
      text: newQuestion,
      author: user.isAnonymous ? 'Anonymous' : user.displayName || 'Anonymous',
      authorId: user.uid,
      upvotes: 0,
      timestamp: serverTimestamp(),
      upvotedBy: [],
    };
    
    addDocumentNonBlocking(questionsRef, questionData)
      .then(() => {
        setNewQuestion('');
      })
      .catch((e: any) => {
        setLocalError('Failed to submit your question. Please try again.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const handleUpvote = (questionId: string) => {
    if (!user || !firestore) return;
    const question = questions?.find((q) => q.id === questionId);
    if (!question || question.upvotedBy.includes(user.uid)) {
      return; // Already upvoted
    }

    const questionRef = doc(firestore, 'sessions', sessionId, 'questions', questionId);
    updateDocumentNonBlocking(questionRef, {
      upvotes: increment(1),
      upvotedBy: arrayUnion(user.uid),
    });
  };

  const isComponentLoading = isUserLoading || isLoadingQuestions;

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
        <div className="flex gap-2 mb-6">
          <Input
            type="text"
            placeholder="Type your question here..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            disabled={isSubmitting || !user}
            onKeyDown={(e) => e.key === 'Enter' && handleQuestionSubmit()}
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

        {localError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Submission Failed</AlertTitle>
            <AlertDescription>{localError}</AlertDescription>
          </Alert>
        )}

        {isComponentLoading ? (
            <div className="flex items-center justify-center h-24">
                <Loader2 className="animate-spin text-primary" />
            </div>
        ) : questionsError ? (
            <Alert variant="destructive">
                <AlertTitle>Error Loading Questions</AlertTitle>
                <AlertDescription>
                There was a problem fetching the Q&amp;A. Please check your connection
                and try again.
                </AlertDescription>
            </Alert>
        ) : (
            <div className="space-y-4">
            {questions && questions.length > 0 ? (
                questions.map((q) => (
                <div
                    key={q.id}
                    className="flex items-start gap-4 p-4 bg-card rounded-lg shadow-sm border"
                >
                    <div className="flex flex-col items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleUpvote(q.id)}
                        disabled={!user || q.upvotedBy?.includes(user.uid)}
                        className="group"
                    >
                        <ThumbsUp className={`h-5 w-5 ${q.upvotedBy?.includes(user?.uid || '') ? 'text-primary fill-primary/20' : 'text-slate-500 group-hover:text-primary'}`} />
                    </Button>
                    <span className="font-bold text-sm text-primary">{q.upvotes}</span>
                    </div>
                    <div className="flex-1">
                    <p className="text-foreground">{q.text}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <User className="h-3 w-3" />
                        <span>{q.author}</span>
                        <span>
                        {q.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
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
        )}
      </CardContent>
    </Card>
  );
}
