import type { ShapeDescriptor, MutationDescriptor, MembersDescriptor, PresenceDescriptor } from '../../kjv-memorize';

declare module '@prophet/client/react' {
  import type { ReactNode } from 'react';

  interface ProphetAppProps {
    children: ReactNode;
    baseUrl?: string;
    orgSlug?: string;
    appName?: string;
    token?: string;
    revision?: number;
    schemas?: Record<string, Record<string, string>>;
    defaults?: Record<string, Record<string, { kind: string }>>;
    entityDefaults?: Record<string, Record<string, unknown>>;
    currentUserId?: string;
  }

  export function ProphetApp(props: ProphetAppProps): ReactNode;

  export function useSubscribe<TEntity, TArgs extends Record<string, unknown> = Record<string, never>>(
    shape: ShapeDescriptor<TEntity, TArgs>,
    options?: TArgs extends Record<string, never> ? undefined : { args: TArgs }
  ): { data: TEntity[] | null; loading: boolean; error: { code: string; message?: string } | null };

  export function useMutation<TArgs extends Record<string, unknown>, TReturns = void>(
    mutation: MutationDescriptor<TArgs, TReturns>
  ): { mutate: (args: TArgs) => Promise<TReturns>; data: TReturns | null; loading: boolean; error: { code: string; message?: string } | null };

  export function useBatchMutation(): {
    batchMutate: (entries: { mutation: MutationDescriptor<any, any>; args: any }[]) => Promise<(string | null)[]>;
    loading: boolean;
    error: { code: string; message?: string } | null;
  };

  export function useMembers<TEntity, TScopes extends string>(
    shape: MembersDescriptor<TEntity, TScopes>,
    options: { entity: string }
  ): { data: Record<TScopes, string[]> | null; loading: boolean; error: { code: string } | null };

  export function usePresence<TEntity, TData extends Record<string, unknown>>(
    shape: PresenceDescriptor<TEntity, TData>,
    options: { entity: string; initialData: TData }
  ): { data: { connectionId: string; userId: string; data: TData }[] | null; publish: (data: Partial<TData>) => void; loading: boolean; error: { code: string } | null };

  export function useCurrentUser(): {
    user: { id: string; email: string; firstName?: string; lastName?: string; profilePictureUrl?: string } | null;
    organization?: { id: string; name: string; slug: string } | null;
    loading: boolean;
    error: { code: string } | null;
  };

  export function useUser(userId: string | null | undefined): { user: { id: string; email: string; firstName?: string; lastName?: string } | null; loading: boolean; error: { code: string } | null };

  export function useUsers(): { users: { id: string; email: string; firstName?: string; lastName?: string }[]; loading: boolean; error: { code: string } | null; invalidate: () => void };

  export function useUploadFile(): { upload: (blob: Blob, name?: string, contentType?: string) => Promise<string>; loading: boolean; error: { code: string } | null };

  export function useFile(fileId: string | null | undefined): { file: { id: string; name: string; contentType: string; size: number; createdAt: string; downloadUrl: string } | null; loading: boolean; error: { code: string } | null };

  export function useLocation(): [string, (path: string) => void];

  export function useParams(): Record<string, string>;

  export function useRoute(path: string): [boolean, Record<string, string>];

  interface SwitchProps { children: ReactNode }
  export function Switch(props: SwitchProps): ReactNode;

  interface RouteProps { path: string; children: ReactNode | ((params: Record<string, string>) => ReactNode) }
  export function Route(props: RouteProps): ReactNode;

  interface LinkProps {
    href: string;
    children: ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    [key: string]: any;
  }
  export function Link(props: LinkProps): ReactNode;
}
