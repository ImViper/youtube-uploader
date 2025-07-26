import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import AuthProvider from '@/components/auth/AuthProvider';
import router from '@/router';
import './App.css';

const theme = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    borderRadius: 6,
  },
};

function App() {
  return (
    <Provider store={store}>
      <ConfigProvider theme={theme}>
        <AntApp>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </AntApp>
      </ConfigProvider>
    </Provider>
  );
}

export default App;
