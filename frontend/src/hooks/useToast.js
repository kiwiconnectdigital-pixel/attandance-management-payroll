import toast from 'react-hot-toast';

/**
 * Thin wrapper around react-hot-toast with consistent styling
 */
export const useToast = () => {
  const success = (message) => toast.success(message, { duration: 3000 });
  const error = (message) => toast.error(message, { duration: 4000 });
  const info = (message) => toast(message, { icon: 'ℹ️', duration: 3000 });
  const loading = (message) => toast.loading(message);
  const dismiss = (id) => toast.dismiss(id);

  /**
   * Wraps an async fn with loading → success/error toasts
   * Usage: await withToast(apiCall(), 'Saving...', 'Saved!')
   */
  const withToast = async (promise, loadingMsg = 'Processing...', successMsg = 'Done!') => {
    const toastId = toast.loading(loadingMsg);
    try {
      const result = await promise;
      toast.success(successMsg, { id: toastId });
      return result;
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Something went wrong';
      toast.error(message, { id: toastId });
      throw err;
    }
  };

  return { success, error, info, loading, dismiss, withToast };
};