import { useCallback, useEffect, useRef, useState } from 'react';

interface UseLessonTimersProps {
  onWarning?: () => void;
  onSkipOffer?: () => void;
  onTimeout?: () => void;
  activityDurationSeconds?: number;
}

export function useLessonTimers({
  onWarning,
  onSkipOffer,
  onTimeout,
  activityDurationSeconds = 30,
}: UseLessonTimersProps = {}) {
  const [timeRemaining, setTimeRemaining] = useState(activityDurationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [hasWarned, setHasWarned] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use refs to store callbacks to avoid stale closures and setState during render
  const onWarningRef = useRef(onWarning);
  const onTimeoutRef = useRef(onTimeout);
  const onSkipOfferRef = useRef(onSkipOffer);

  // Update refs when callbacks change
  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    onSkipOfferRef.current = onSkipOffer;
  }, [onSkipOffer]);

  // Track warning/timeout events to trigger via useEffect (avoids setState during render)
  const [warningTriggered, setWarningTriggered] = useState(false);
  const [timeoutTriggered, setTimeoutTriggered] = useState(false);

  // Handle warning via useEffect to avoid setState during render
  useEffect(() => {
    if (warningTriggered) {
      onWarningRef.current?.();
      setWarningTriggered(false);
    }
  }, [warningTriggered]);

  // Handle timeout via useEffect to avoid setState during render
  useEffect(() => {
    if (timeoutTriggered) {
      onTimeoutRef.current?.();
      setTimeoutTriggered(false);
    }
  }, [timeoutTriggered]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isRunning || timeRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setIsRunning(false);
          // Trigger timeout via state to avoid setState during render
          setTimeoutTriggered(true);
          return 0;
        }

        const newTime = prev - 1;

        if (newTime === 10 && !hasWarned) {
          setHasWarned(true);
          // Trigger warning via state to avoid setState during render
          setWarningTriggered(true);
        }

        return newTime;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, timeRemaining, hasWarned]);

  const startTimer = useCallback(() => {
    setTimeRemaining(activityDurationSeconds);
    setIsRunning(true);
    setHasWarned(false);
  }, [activityDurationSeconds]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimeRemaining(activityDurationSeconds);
    setIsRunning(false);
    setHasWarned(false);
  }, [activityDurationSeconds]);

  const skipTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRunning(false);
    setHasWarned(false);
    onSkipOfferRef.current?.();
  }, []);

  return {
    timeRemaining,
    isRunning,
    hasWarned,
    startTimer,
    resetTimer,
    skipTimer,
  };
}
