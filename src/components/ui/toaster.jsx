import { Toaster as SonnerToaster } from 'sonner';

export const Toaster = () => {
  return <SonnerToaster richColors closeButton position="top-right" toastOptions={{ duration: 3200 }} />;
};
