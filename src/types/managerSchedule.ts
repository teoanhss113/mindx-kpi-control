import { MANAGER_WORK_SESSIONS } from '@/constants';

export type ManagerWorkSession = (typeof MANAGER_WORK_SESSIONS)[number]['value'];

export interface ManagerScheduleRegistration {
  id: string;
  managerId: string;
  managerName: string;
  managerEmail: string;
  centreId: string;
  centreName: string;
  centreShortName: string;
  date: string;
  weekday: number;
  session: ManagerWorkSession;
  note: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ManagerScheduleInput {
  centreId: string;
  centreName: string;
  centreShortName: string;
  date: string;
  weekday: number;
  session: ManagerWorkSession;
  note?: string | null;
}

export interface ManagerScheduleProfile {
  id: string;
  email: string;
  name: string;
  username?: string;
  fullName?: string;
  regionNames: string[];
  roleName: string;
}
