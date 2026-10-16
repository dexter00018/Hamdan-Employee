import { describe, expect, it } from 'vitest';
import { answerKnownSystemQuestion } from '@/lib/employee/system-question-answer';

describe('Ask AI local system knowledge', () => {
  it('explains Ask AI capabilities without sending a generic help question upstream', () => {
    const answer = answerKnownSystemQuestion('What can Ask AI help with?', 'en');
    expect(answer).toContain('attendance, leave, Offset');
    expect(answer).toContain('signed-in account');
    expect(answer).toContain('another employee');
  });

  it('answers the same capability question in Filipino', () => {
    const answer = answerKnownSystemQuestion('Ano puwede itanong sa Ask AI?', 'auto');
    expect(answer).toContain('sarili mong attendance');
    expect(answer).toContain('signed-in account');
  });

  it('defers a private, account-specific question even when it contains known terms', () => {
    expect(answerKnownSystemQuestion('What is my current leave balance?', 'en')).toBeNull();
  });
});
