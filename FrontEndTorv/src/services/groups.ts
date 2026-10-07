import api from './api';
import type { GroupPeriod } from '../utils/groupPeriod';

// Contrato de /groups/* (spec docs/superpowers/specs/2026-10-06-groups-competition-design.md).
export type Visibility = 'PUBLIC' | 'PRIVATE';

export interface GroupListItem extends GroupPeriod {
  id: string;
  name: string;
  visibility: Visibility;
  cover_url: string | null;
  member_count: number;
  is_owner: boolean;
  my_rank: number;
  my_points: number;
}

export interface DiscoverItem extends GroupPeriod {
  id: string;
  name: string;
  cover_url: string | null;
  member_count: number;
}

export interface DiscoverPage {
  groups: DiscoverItem[];
  next_cursor: number | null;
}

export interface GroupDetailData extends GroupPeriod {
  id: string;
  name: string;
  visibility: Visibility;
  cover_url: string | null;
  member_count: number;
  is_owner: boolean;
  is_member: boolean;
  invite_token: string | null; // só o dono recebe
  my_invitation: { id: string; kind: 'INVITE' | 'REQUEST' } | null;
}

export interface GroupInput {
  name: string;
  visibility: Visibility;
  starts_at: string;
  ends_at: string | null;
  tz_offset_min: number;
}

export type GroupPatch = Partial<Omit<GroupInput, 'tz_offset_min'>>;

export interface RankingRow {
  position: number;
  user_id: string;
  name: string;
  username: string;
  photo_url: string | null;
  total_points: number; // dias com treino
  activities_count: number;
  is_me: boolean;
}

export interface PendingItem {
  id: string;
  user_id: string;
  name: string;
  username: string;
  photo_url: string | null;
  created_at: string;
}

export interface PendingLists {
  requests: PendingItem[];
  invites: PendingItem[];
}

export interface ReceivedInvitation {
  id: string;
  group: { id: string; name: string; cover_url: string | null };
  invited_by: { name: string; username: string };
  created_at: string;
}

export interface JoinPreview {
  group: GroupPeriod & { id: string; name: string; cover_url: string | null; member_count: number };
  is_member: boolean;
  ended: boolean;
}

// Mesmo envio da foto de perfil: no web o File vem do picker; no celular, { uri, name, type }.
export function coverForm(uri: string, webFile?: File): FormData {
  const form = new FormData();
  if (webFile) {
    form.append('photo', webFile, webFile.name);
  } else {
    form.append('photo', { uri, name: uri.split('/').pop() || 'cover.jpg', type: 'image/jpeg' } as any);
  }
  return form;
}

export const groupsApi = {
  list: () => api.get<{ groups: GroupListItem[] }>('/groups').then((r) => r.data.groups),
  discover: (q: string, cursor = 0) =>
    api.get<DiscoverPage>('/groups/discover', { params: { q: q || undefined, cursor } }).then((r) => r.data),
  get: (id: string) => api.get<GroupDetailData>(`/groups/${id}`).then((r) => r.data),
  create: (body: GroupInput) => api.post<GroupDetailData>('/groups', body).then((r) => r.data),
  update: (id: string, body: GroupPatch) => api.patch<GroupDetailData>(`/groups/${id}`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/groups/${id}`),
  uploadCover: (id: string, form: FormData) =>
    api.post<{ cover_url: string }>(`/groups/${id}/cover`, form).then((r) => r.data.cover_url),
  ranking: (id: string) => api.get<{ ranking: RankingRow[] }>(`/groups/${id}/ranking`).then((r) => r.data.ranking),
  removeMember: (id: string, userId: string) => api.delete(`/groups/${id}/members/${userId}`),
  invite: (id: string, username: string) => api.post<{ id: string }>(`/groups/${id}/invitations`, { username }).then((r) => r.data),
  requestJoin: (id: string) => api.post<{ id: string }>(`/groups/${id}/requests`).then((r) => r.data),
  pending: (id: string) => api.get<PendingLists>(`/groups/${id}/requests`).then((r) => r.data),
  received: () => api.get<{ invitations: ReceivedInvitation[] }>('/groups/invitations/received').then((r) => r.data.invitations),
  accept: (invitationId: string) =>
    api.post<{ group_id: string; status: string }>(`/groups/invitations/${invitationId}/accept`).then((r) => r.data),
  decline: (invitationId: string) =>
    api.post<{ group_id: string; status: string }>(`/groups/invitations/${invitationId}/decline`).then((r) => r.data),
  cancelInvitation: (invitationId: string) => api.delete(`/groups/invitations/${invitationId}`),
  createInviteLink: (id: string) => api.post<{ token: string }>(`/groups/${id}/invite-link`).then((r) => r.data.token),
  revokeInviteLink: (id: string) => api.delete(`/groups/${id}/invite-link`),
  joinPreview: (token: string) => api.get<JoinPreview>(`/groups/join/${token}`).then((r) => r.data),
  join: (token: string) => api.post<{ group_id: string }>(`/groups/join/${token}`).then((r) => r.data.group_id),
};
