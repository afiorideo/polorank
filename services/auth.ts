import { useRouter } from 'next/router';
import toast from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import type { AuthUserResponse, SessionUser } from '../utils/auth/types';
import { canAccessDomain, canManageDomains, canManageKeywords, canManageSettings, canRefreshKeywords, isSuperadmin } from '../utils/auth/guards';

export async function fetchAuthUser(): Promise<AuthUserResponse> {
   const res = await fetch(`${window.location.origin}/api/auth/me`, { method: 'GET' });
   if (res.status === 401) { return { user: null }; }
   return res.json();
}

/** Current user + permission helpers for the UI (the server enforces the real guards). */
export function useAuthUser() {
   const query = useQuery('authUser', () => fetchAuthUser(), { staleTime: 60 * 1000 });
   const user: SessionUser | null = query.data?.user || null;
   return {
      user,
      isLoading: query.isLoading,
      isSuperadmin: isSuperadmin(user),
      canManageDomains: canManageDomains(user),
      canManageSettings: canManageSettings(user),
      canRefresh: canRefreshKeywords(user),
      canAccess: (domain: string | null | undefined) => canAccessDomain(user, domain),
      canManageKeywords: (domain: string | null | undefined) => canManageKeywords(user, domain),
   };
}

export type UserRow = {
   ID: number,
   email: string,
   role: 'superadmin' | 'domain_admin' | 'domain_user',
   domain_id: number | null,
   domain: string | null,
   active: boolean,
   created_at: string,
   last_login: string | null,
   locked: boolean,
};

const jsonHeaders = () => new Headers({ 'Content-Type': 'application/json', Accept: 'application/json' });

export async function fetchUsers(): Promise<{ users: UserRow[] }> {
   const res = await fetch(`${window.location.origin}/api/users`, { method: 'GET' });
   if (!res.ok) { throw new Error('No se pudo cargar la lista de usuarios'); }
   return res.json();
}

export function useFetchUsers(enabled: boolean) {
   return useQuery('users', () => fetchUsers(), { enabled });
}

const readError = async (res: Response, fallback: string) => {
   try { const data = await res.json(); return data?.error || fallback; } catch (e) { return fallback; }
};

export function useCreateUser(onSuccess?: Function) {
   const queryClient = useQueryClient();
   return useMutation(async (payload: { email: string, role: string, domain_id: number | null }) => {
      const res = await fetch(`${window.location.origin}/api/users`, { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) });
      if (!res.ok) { throw new Error(await readError(res, 'No se pudo crear el usuario')); }
      return res.json();
   }, {
      onSuccess: () => { toast('Usuario agregado', { icon: '✔️' }); queryClient.invalidateQueries(['users']); if (onSuccess) onSuccess(); },
      onError: (error: Error) => { toast(error.message, { icon: '⚠️' }); },
   });
}

export function useUpdateUser() {
   const queryClient = useQueryClient();
   return useMutation(async (payload: { ID: number, role?: string, domain_id?: number | null, active?: boolean }) => {
      const { ID, ...body } = payload;
      const res = await fetch(`${window.location.origin}/api/users/${ID}`, { method: 'PUT', headers: jsonHeaders(), body: JSON.stringify(body) });
      if (!res.ok) { throw new Error(await readError(res, 'No se pudo actualizar el usuario')); }
      return res.json();
   }, {
      onSuccess: () => { toast('Usuario actualizado', { icon: '✔️' }); queryClient.invalidateQueries(['users']); },
      onError: (error: Error) => { toast(error.message, { icon: '⚠️' }); },
   });
}

export function useDeleteUser() {
   const queryClient = useQueryClient();
   return useMutation(async (ID: number) => {
      const res = await fetch(`${window.location.origin}/api/users/${ID}`, { method: 'DELETE', headers: jsonHeaders() });
      if (!res.ok) { throw new Error(await readError(res, 'No se pudo eliminar el usuario')); }
      return res.json();
   }, {
      onSuccess: () => { toast('Usuario eliminado', { icon: '✔️' }); queryClient.invalidateQueries(['users']); },
      onError: (error: Error) => { toast(error.message, { icon: '⚠️' }); },
   });
}

export function useLogout() {
   const router = useRouter();
   const queryClient = useQueryClient();
   return async () => {
      try {
         const res = await fetch(`${window.location.origin}/api/logout`, { method: 'POST', headers: jsonHeaders() }).then((r) => r.json());
         if (!res.success) { toast(res.error, { icon: '⚠️' }); return; }
         queryClient.clear();
         router.push('/login');
      } catch (error) {
         toast('No se pudo cerrar la sesión. El servidor no responde.', { icon: '⚠️' });
      }
   };
}
