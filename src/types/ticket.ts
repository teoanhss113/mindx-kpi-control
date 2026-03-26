// src/types/ticket.ts
export interface TicketUser {
  id: string;
  username: string;
  email: string;
}

export interface TicketQuestion {
  id: string;
  title: string;
  description?: string;
  options?: string[];
  type: string;
  isRequired: boolean;
  group: string;
}

export interface TicketAnswer {
  questionId: string;
  value: string;
}

export interface TicketSource {
  id: string;
  channel: string;
  studentName: string;
  studentId: string;
  className: string;
  centreId: string;
  centre: {
    id: string;
    shortName: string;
  };

  questions: TicketQuestion[];
  answers: TicketAnswer[];
  // Other fields you may not strictly need but are present:
  noteId?: string;
  classId?: string;
  callId?: string;
  surveyResponseId?: string;
  surveyId?: string;
}

export interface TicketAttachment {
  fileName: string;
  fileUrl: string;
}

export interface TicketComment {
  id: string;
  message: string;
  userId: string;
  createdAt: number;
  user: TicketUser;
}

export interface Ticket {
  id: string;
  ticketCode: string;
  title: string;
  description?: string;
  priority: string;
  feedbackTopic: string;
  status: string;
  deadline?: number | string;
  customerId?: string;
  productUserId?: string;
  assignee?: TicketUser;
  ticketSource: TicketSource;
  attachments?: TicketAttachment[];
  comments?: TicketComment[];
  createdAt: number;
  closedDate?: number;
}

export interface TicketPagination {
  type: string;
  total: number;
}

export interface FindTicketPaginateResponse {
  data: {
    findTicketPaginate: {
      data: Ticket[];
      pagination: TicketPagination;
    };
  };
}

export interface UpdateTicketPayload {
  id: string;
  title?: string;
  description?: string;
  priority?: string;
  feedbackTopic?: string;
  asigneeId?: string;
  attachments?: any[];
  status?: string;
}

export interface LmsUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  centres?: { id: string; shortName: string; name: string }[];
}
