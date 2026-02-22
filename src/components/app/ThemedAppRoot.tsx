import { ToastContainer } from 'react-toastify';
import { useTheme } from '../../context/ThemeContext';
import AppRouterContent from './AppRouterContent';

export default function ThemedAppRoot() {
  const { isDark } = useTheme();

  return (
    <>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={isDark ? 'dark' : 'light'}
      />
      <AppRouterContent />
    </>
  );
}
