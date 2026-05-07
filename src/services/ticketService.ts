import { lmsQuery } from './lmsClient';
import { Ticket, FindTicketPaginateResponse, TicketPagination } from '../types/ticket';

export interface FetchTicketsParams {
  pageIndex?: number;
  itemsPerPage?: number;
  centreId_in?: string[];
  createdAt_gte?: string;
  createdAt_lte?: string;
}

export async function fetchTickets(
  params: FetchTicketsParams,
  onProgress?: (loaded: number, total: number, chunk: Ticket[]) => void,
  abortSignal?: AbortSignal
): Promise<{ data: Ticket[]; pagination: TicketPagination }> {
  const query = `
    query FindTicketPaginate($payload: TicketQuery) {
      findTicketPaginate(payload: $payload) {
        data {
          id
          ticketCode
          title
          description
          priority
          feedbackTopic
          status
          deadline
          customerId
          productUserId
          assignee {
            id
            username
            email
          }
          ticketSource {
            id
            channel
            noteId
            classId
            callId
            surveyResponseId
            studentName
            studentId
            className
            centreId
            surveyId
            questions {
              id
              title
              description
              options
              type
              isRequired
              group
            }
            answers {
              questionId
              value
            }
            centre {
              id
              shortName
            }

          }
          attachments {
            fileName
            fileUrl
          }
          comments {
            id
            message
            userId
            createdAt
            user {
              id
              username
              email
            }
          }
          createdAt
          closedDate
        }
        pagination {
          type
          total
        }
      }
    }
  `;

  // We loop to fetch all pages if necessary, or just rely on itemsPerPage if we want all at once?
  // Since we want all tickets for a specific month, we can fetch in chunks like classes.
  const PAGE_SIZE = 100; // Increased from 50 for better performance
  let allTickets: Ticket[] = [];
  let pageIndex = params.pageIndex || 0;
  let total = 0;
  let hasMore = true;

  while (hasMore) {
    if (abortSignal?.aborted) {
      break;
    }

    const variables = {
      payload: {
        pageIndex,
        itemsPerPage: params.itemsPerPage || PAGE_SIZE,
        assignee_in: [],
        centreId_in: params.centreId_in || [],
        feedbackTopic_in: [],
        status_in: [],
        channel_in: [],
        filter_textSearch: "",
        deadline_gte: "",
        deadline_lte: "",
        createdAt_gte: params.createdAt_gte || "",
        createdAt_lte: params.createdAt_lte || "",
      }
    };

    const result = await lmsQuery<FindTicketPaginateResponse>({ query, variables });
    const { data, pagination } = result.data.findTicketPaginate;
    
    // First chunk sets total
    if (pageIndex === 0) {
      total = pagination.total;
    }

    allTickets = [...allTickets, ...data];
    if (onProgress) {
      onProgress(allTickets.length, total, data);
    }

    // Stop if we asked for a specific page, OR if we fetched everything
    if (params.itemsPerPage !== undefined) {
      return { data: allTickets, pagination };
    }

    if (allTickets.length >= total || data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      pageIndex++;
    }
  }

  return { data: allTickets, pagination: { type: 'TICKETS', total } };
}

// ─── Update Ticket ────────────────────────────────────────────────────────────
import { UpdateTicketPayload, LmsUser } from '../types/ticket';

export async function updateTicket(payload: UpdateTicketPayload): Promise<Ticket> {
  const query = `
    mutation TicketCommand($payload: UpdateTicketCommand!) {
      ticket {
        update(payload: $payload) {
          id
          ticketCode
          title
          description
          priority
          feedbackTopic
          status
          deadline
          assignee {
            id
            username
            email
          }
          createdAt
          closedDate
        }
      }
    }
  `;
  const result = await lmsQuery<any>({ query, variables: { payload }, operationName: 'TicketCommand' });
  return result.data.ticket.update;
}

// ─── Search Users (Assignee) ──────────────────────────────────────────────────
export async function searchUsers(search: string, pageIndex = 0, itemsPerPage = 100): Promise<{ data: LmsUser[]; total: number }> {
  const query = `
    query getUsers($search: String, $isActive: Boolean, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String) {
      users(payload: {
        filter_textSearch: $search,
        isActive_equals: $isActive,
        pageIndex: $pageIndex,
        itemsPerPage: $itemsPerPage,
        orderBy: $orderBy
      }) {
        data {
          id
          username
          email
          displayName
          centres {
            id
            shortName
            name
          }
        }
        pagination {
          total
        }
      }
    }
  `;
  const result = await lmsQuery<any>({
    query,
    variables: { search, isActive: true, pageIndex, itemsPerPage, orderBy: 'createdAt_desc' },
    operationName: 'getUsers',
  });
  return {
    data: result.data.users.data as LmsUser[],
    total: result.data.users.pagination.total,
  };
}
