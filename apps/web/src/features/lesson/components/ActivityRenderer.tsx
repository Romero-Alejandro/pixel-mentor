import type { ActivityResponse } from '@pixel-mentor/shared/activities';

import { ActivityPanel } from '@/features/lesson/components/ActivityPanel';
import { MultiSelectActivityPanel } from '@/features/lesson/components/MultiSelectActivityPanel';
import { TrueFalseActivityPanel } from '@/features/lesson/components/TrueFalseActivityPanel';
import { OrderingActivityPanel } from '@/features/lesson/components/OrderingActivityPanel';

/**
 * Format-dispatching activity renderer (Fase 1).
 *
 * The activity format is data (`activityFormat` from the backend static
 * content); this component maps it to the matching panel plugin. Legacy
 * steps without a format fall back to mcq_single. Adding a new format =
 * adding a panel + one case here.
 */
export function ActivityRenderer({
  activityFormat,
  question,
  options,
  orderingItems,
  onAnswer,
  onStructuredAnswer,
  isProcessing,
  selectedId,
  isCorrect,
  correctOptionId,
}: {
  activityFormat: string | null;
  question: string;
  options: Array<{ id: string; text: string }>;
  orderingItems: Array<{ id: string; text: string }>;
  /** mcq_single path (option id). */
  onAnswer: (text: string, id: string) => void;
  /** Structured path for Fase 1 formats. */
  onStructuredAnswer: (payload: ActivityResponse, label: string) => void;
  isProcessing: boolean;
  selectedId: string | null;
  isCorrect: boolean | null;
  correctOptionId?: string | null;
}) {
  switch (activityFormat) {
    case 'mcq_multi':
      return (
        <MultiSelectActivityPanel
          question={question}
          options={options}
          onConfirm={onStructuredAnswer}
          isProcessing={isProcessing}
        />
      );
    case 'true_false':
      return (
        <TrueFalseActivityPanel
          question={question}
          onConfirm={onStructuredAnswer}
          isProcessing={isProcessing}
        />
      );
    case 'ordering':
      return (
        <OrderingActivityPanel
          question={question}
          items={orderingItems}
          onConfirm={onStructuredAnswer}
          isProcessing={isProcessing}
        />
      );
    // mcq_single and legacy steps without an explicit format
    default:
      return (
        <ActivityPanel
          question={question}
          options={options}
          onAnswer={onAnswer}
          isProcessing={isProcessing}
          selectedId={selectedId}
          isCorrect={isCorrect}
          correctOptionId={correctOptionId}
        />
      );
  }
}
