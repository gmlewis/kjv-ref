// Mock Prophet client for testing
import { useState, useEffect, ReactNode } from 'react';

export function useSubscribe(shape: string, args?: any) {
  return { data: [], loading: false, error: null };
}

export function useMutation(mutation: string) {
  return { mutate: () => Promise.resolve() };
}

export function useBatchMutation() {
  return { batchMutate: () => Promise.resolve([]) };
}

export function useMembers(shape: string, args: any) {
  return { data: {} };
}

export function usePresence(shape: string, args: any) {
  return { data: [], publish: () => {} };
}

export function useUser() {
  return { user: null };
}

export function useUsers() {
  return { users: [] };
}

export function useCurrentUser() {
  return { user: null };
}

export function useUploadFile() {
  return { upload: () => Promise.resolve('') };
}

export function useFile(fileId: string) {
  return { file: null };
}

export function Switch({ children }: { children: ReactNode }) {
  return children as ReactNode;
}

export function Route({ path, children }: { path: string; children: ReactNode }) {
  const location = useLocation();
  if (location.pathname === path || (path === '/' && location.pathname === '')) {
    return children as ReactNode;
  }
  return null;
}

export function Link({ to, children, onClick }: { to: string; children: ReactNode; onClick?: () => void }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, '', to);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (onClick) onClick();
  };
  
  return { type: 'a', props: { href: to, onClick: handleClick, children } };
}

export function useLocation() {
  const [location, setLocation] = useState({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  });

  useEffect(() => {
    const handlePopState = () => {
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return location;
}

export function useParams() {
  const location = useLocation();
  const pathname = location.pathname;
  const params: Record<string, string> = {};
  
  // Simple param extraction - can be enhanced
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0) {
    params.id = segments[segments.length - 1];
  }
  
  return params;
}
