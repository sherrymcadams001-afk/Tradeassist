import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Shield, Zap } from "lucide-react";

type VerificationStep = {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "pending" | "processing" | "complete" | "error";
  duration?: number;
};

type VerificationSequenceProps = {
  onComplete: () => void;
};

export function VerificationSequence({ onComplete }: VerificationSequenceProps) {
  const [steps, setSteps] = useState<VerificationStep[]>([
    {
      id: "tier",
      label: "Tier Authentication",
      icon: <Shield className="h-5 w-5" />,
      status: "pending",
      duration: 800,
    },
    {
      id: "strategy",
      label: "Strategy Validation",
      icon: <Zap className="h-5 w-5" />,
      status: "pending",
      duration: 900,
    },
    {
      id: "market",
      label: "Market Link Established",
      icon: <CheckCircle2 className="h-5 w-5" />,
      status: "pending",
      duration: 800,
    },
  ]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (currentStepIndex >= steps.length) {
      const timer = setTimeout(() => {
        onComplete();
      }, 400);
      return () => clearTimeout(timer);
    }

    const currentStep = steps[currentStepIndex];
    if (!currentStep) {
      return;
    }

    setSteps((prev) =>
      prev.map((step, idx) => ({
        ...step,
        status: idx === currentStepIndex ? "processing" : idx < currentStepIndex ? "complete" : "pending",
      })),
    );

    const timer = setTimeout(() => {
      setSteps((prev) =>
        prev.map((step, idx) => ({
          ...step,
          status: idx === currentStepIndex ? "complete" : step.status,
        })),
      );
      setCurrentStepIndex((prev) => prev + 1);
    }, currentStep.duration ?? 1000);

    return () => clearTimeout(timer);
  }, [currentStepIndex, steps.length, onComplete]);

  const allComplete = steps.every((step) => step.status === "complete");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#01030a] px-4">
      <div className="w-full max-w-md space-y-8">
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-950/50">
            <Shield className="h-8 w-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-semibold text-white">System Verification</h1>
          <p className="mt-2 text-sm text-slate-400">
            {allComplete ? "Authentication complete" : "Establishing secure connection..."}
          </p>
        </header>

        <div className="space-y-4">
          {steps.map((step, idx) => {
            const isActive = step.status === "processing";
            const isComplete = step.status === "complete";
            const isPending = step.status === "pending";

            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-all duration-300 ${
                  isComplete
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : isActive
                      ? "border-cyan-400/30 bg-cyan-400/5 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                      : "border-slate-800 bg-slate-950/30"
                }`}
              >
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                    isComplete
                      ? "bg-emerald-500/20 text-emerald-400"
                      : isActive
                        ? "bg-cyan-400/20 text-cyan-400"
                        : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    step.icon
                  )}
                </div>

                <div className="flex-1">
                  <p
                    className={`text-sm font-medium transition-colors ${
                      isComplete ? "text-emerald-300" : isActive ? "text-cyan-300" : "text-slate-400"
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isComplete ? "Verified" : isActive ? "Verifying..." : isPending ? "Pending" : ""}
                  </p>
                </div>

                {isActive && (
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 [animation-delay:300ms]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {allComplete && (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Access Granted
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
