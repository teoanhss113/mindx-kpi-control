import { lmsQuery } from './lmsClient';

export const STUDENT_TEACHING_SURVEY_ID = '676a84b4fe6e69ed05003d81';

export interface ClassSurveyLookupInput {
  classId: string;
  sessionId: string;
  sessionNumber: number;
  surveyId?: string;
}

export interface ClassSurveyLookupResult extends ClassSurveyLookupInput {
  classSurveyId?: string;
  target?: string;
  status?: string;
  responseCount: number;
  opened: boolean;
}

interface RawClassSurvey {
  id: string;
  classId: string;
  sessionId: string;
  surveyId: string;
  target: string;
  responses?: string[];
  status?: string;
}

const BATCH_SIZE = 35;

function surveyKey(classId: string, sessionId: string) {
  return `${classId}:${sessionId}`;
}

export async function fetchStudentClassSurveys(
  inputs: ClassSurveyLookupInput[],
  signal?: AbortSignal
): Promise<Map<string, ClassSurveyLookupResult>> {
  const uniqueInputs = Array.from(
    new Map(inputs.map(input => [surveyKey(input.classId, input.sessionId), input])).values()
  );
  const results = new Map<string, ClassSurveyLookupResult>();

  // Split work into parallelizable chunks
  const batches: ClassSurveyLookupInput[][] = [];
  for (let offset = 0; offset < uniqueInputs.length; offset += BATCH_SIZE) {
    batches.push(uniqueInputs.slice(offset, offset + BATCH_SIZE));
  }

  // Fire parallel concurrent requests for MAXIMUM SPEED instead of sequential waiting
  await Promise.all(batches.map(async (batch) => {
    if (signal?.aborted) return;
    
    try {
      const variableDefs = batch.map((_, index) => `$payload${index}: FindOneClassSurveyInput!`).join(', ');
      const fields = batch.map((_, index) => `
        s${index}: findOneClassSurvey(payload: $payload${index}) {
          id
          classId
          sessionId
          surveyId
          target
          responses
          status
        }
      `).join('\n');

      const query = `
        query FindStudentClassSurveys(${variableDefs}) {
          ${fields}
        }
      `;

      const variables = Object.fromEntries(
        batch.map((input, index) => [
          `payload${index}`,
          {
            classId: input.classId,
            sessionId: input.sessionId,
            surveyId: input.surveyId || STUDENT_TEACHING_SURVEY_ID,
            target: 'STUDENT',
          },
        ])
      );

      // CRITICAL: Pass allowPartialErrors=true so "not found" errors don't crash valid peers!
      const response = await lmsQuery<{ data: Record<string, RawClassSurvey | null> }>({
        query,
        variables,
        operationName: 'FindStudentClassSurveys',
        signal,
        allowPartialErrors: true,
      });

      batch.forEach((input, index) => {
        const survey = response?.data ? response.data[`s${index}`] : null;
        const key = surveyKey(input.classId, input.sessionId);
        const status = survey?.status?.toUpperCase();
        
        // We save the state, potentially with no data if response key was missing due to GraphQL error
        results.set(key, {
          ...input,
          surveyId: input.surveyId || STUDENT_TEACHING_SURVEY_ID,
          classSurveyId: survey?.id,
          target: survey?.target,
          status: survey?.status,
          responseCount: survey?.responses?.length || 0,
          opened: Boolean(survey && status !== 'CREATED'),
        });
      });
    } catch (e) {
      // Silently proceed; individual chunk crash shouldn't break the whole application dashboard load
      console.warn('Failed to load a partial survey batch', e);
    }
  }));

  return results;
}

export { surveyKey as classSurveyKey };
