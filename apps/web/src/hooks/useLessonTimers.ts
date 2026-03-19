import { useCallback, useEffect, useRef, useState } from 'react';

import { ACTIVITY_TIMEOUT_SECONDS } from '@/config/lessonTiming';

interface UseLessonTimersProps {
  onWarning?: () => void;
  onSkipOffer?: () => void;
  onTimeout?: () => void;
  activityDurationSeconds?: number;
}

const DEFAULT_ACTIVITY_DURATION = ACTIVITY_TIMEOUT_SECONDS;

export function useLessonTimers({
  onWarning,
  onSkipOffer,
  onTimeout,
  activityDurationSeconds = DEFAULT_ACTIVITY_DURATION,
}: UseLessonTimersProps = {}) {
  const [timeRemaining, setTimeRemaining] = useState(activityDurationSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [hasWarned, setHasWarned] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callbacks = useRef({ onWarning, onSkipOffer, onTimeout });

  useEffect(() => {
    callbacks.current = { onWarning, onSkipOffer, onTimeout };
  }, [onWarning, onSkipOffer, onTimeout]);

  const clearCurrentInterval = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isRunning || timeRemaining <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;

        if (newTime === 10 && !hasWarned) {
          setHasWarned(true);
          callbacks.current.onWarning?.();
        }

        if (newTime <= 0) {
          clearCurrentInterval();
          setIsRunning(false);
          callbacks.current.onTimeout?.();
          return 0;
        }

        return newTime;
      });
    }, 1000);

    return clearCurrentInterval;
  }, [isRunning, timeRemaining, hasWarned, clearCurrentInterval]);

  const startTimer = useCallback(() => {
    setTimeRemaining(activityDurationSeconds);
    setIsRunning(true);
    setHasWarned(false);
  }, [activityDurationSeconds]);

  const resetTimer = useCallback(() => {
    clearCurrentInterval();
    setTimeRemaining(activityDurationSeconds);
    setIsRunning(false);
    setHasWarned(false);
  }, [activityDurationSeconds, clearCurrentInterval]);

  const skipTimer = useCallback(() => {
    clearCurrentInterval();
    setIsRunning(false);
    setHasWarned(false);
    callbacks.current.onSkipOffer?.();
  }, [clearCurrentInterval]);

  return {
    timeRemaining,
    isRunning,
    hasWarned,
    startTimer,
    resetTimer,
    skipTimer,
  };
}
