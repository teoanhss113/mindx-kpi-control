/**
 * centresService.ts
 * Fetches the list of available learning centres from the LMS API.
 */

import { lmsQuery } from './lmsClient';

const GET_CENTRES_QUERY = /* graphql */ `
  query getCentres($search: String, $isActive: Boolean, $pageIndex: Int!, $itemsPerPage: Int!, $orderBy: String) {
    centres(payload: {
      filter_textSearch: $search,
      isActive_eq: $isActive,
      pageIndex: $pageIndex,
      itemsPerPage: $itemsPerPage,
      orderBy: $orderBy
    }) {
      data {
        id
        shortName
        name
        isActive
      }
      pagination {
        type
        total
      }
    }
  }
`;

export interface Centre {
  id: string;
  shortName: string;
  name: string;
  isActive: boolean;
}

interface CentresResponse {
  data: {
    centres: {
      data: Centre[];
      pagination: { type: string; total: number };
    };
  };
}

/** Fetch all active centres (auto-paginated). */
export async function fetchAllCentres(): Promise<Centre[]> {
  const all: Centre[] = [];
  let pageIndex = 0;
  const itemsPerPage = 50;
  let total = Infinity;

  while (all.length < total) {
    const res = await lmsQuery<CentresResponse>({
      query: GET_CENTRES_QUERY,
      variables: {
        search: '',
        isActive: true,
        pageIndex,
        itemsPerPage,
        orderBy: 'name_asc',
      },
      operationName: 'getCentres',
    });

    const page = res.data.centres;
    total = page.pagination.total;
    all.push(...page.data);

    if (page.data.length < itemsPerPage) break;
    pageIndex++;
  }

  return all;
}
