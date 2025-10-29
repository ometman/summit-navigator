import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calendar, Users,LogIn } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <main className="flex-1">
        <section className="py-24 md:py-32 text-center bg-white rounded-xl shadow-md">
          <div className="container px-4 md:px-6">
            <div className="max-w-3xl mx-auto">
              <h1 className="text-4xl md:text-5xl font-extrabold text-foreground tracking-tighter mb-4">
                Welcome to the Summit Navigator
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Your interactive guide to the premier leadership training event of the year.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    View Dashboard <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/login">
                    Register or Login <LogIn className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
            <div className="container px-4 md:px-6">
                <div className="grid md:grid-cols-3 gap-12 text-center">
                    <div className="flex flex-col items-center">
                        <Users className="h-12 w-12 text-primary mb-4" />
                        <h3 className="text-2xl font-bold text-foreground mb-2">Expert Speakers</h3>
                        <p className="text-muted-foreground">
                            Learn from seasoned leaders and visionaries in church growth and management.
                        </p>
                    </div>
                    <div className="flex flex-col items-center">
                        <Calendar className="h-12 w-12 text-primary mb-4" />
                        <h3 className="text-2xl font-bold text-foreground mb-2">Interactive Agenda</h3>
                        <p className="text-muted-foreground">
                            Engage with a dynamic schedule, session details, and live Q&A.
                        </p>
                    </div>
                    <div className="flex flex-col items-center">
                        <ArrowRight className="h-12 w-12 text-primary mb-4" />
                        <h3 className="text-2xl font-bold text-foreground mb-2">Actionable Insights</h3>
                        <p className="text-muted-foreground">
                            Gain practical strategies to implement in your ministry immediately.
                        </p>
                    </div>
                </div>
            </div>
        </section>
      </main>
    </>
  );
}