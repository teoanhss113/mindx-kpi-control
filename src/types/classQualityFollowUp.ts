export type ClassQualityFollowUpStatus = 'unprocessed' | 'in_progress' | 'resolved';

export interface ClassQualityFollowUp {
  classId: string;
  className: string;
  status: ClassQualityFollowUpStatus;
  note: string;
  updatedByProfileId: string;
  updatedByEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassQualityFollowUpInput {
  classId: string;
  className: string;
  status: ClassQualityFollowUpStatus;
  note: string;
}

