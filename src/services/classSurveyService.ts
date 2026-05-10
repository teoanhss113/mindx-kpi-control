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

  for (let offset = 0; offset < uniqueInputs.length; offset += BATCH_SIZE) {
    if (signal?.aborted) throw new Error('Aborted');

    const batch = uniqueInputs.slice(offset, offset + BATCH_SIZE);
    if (batch.length === 0) continue;

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

    const response = await lmsQuery<{ data: Record<string, RawClassSurvey | null> }>({
      query,
      variables,
      operationName: 'FindStudentClassSurveys',
      signal,
    });

    batch.forEach((input, index) => {
      const survey = response.data[`s${index}`];
      const key = surveyKey(input.classId, input.sessionId);
      const status = survey?.status?.toUpperCase();
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
  }

  return results;
}

export { surveyKey as classSurveyKey };
