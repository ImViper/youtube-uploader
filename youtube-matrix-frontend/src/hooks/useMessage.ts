import { App } from 'antd';

export const useMessage = () => {
  const { notification, message, modal } = App.useApp();

  const showError = (title: string, description?: string) => {
    notification.error({
      message: title,
      description,
      placement: 'topRight',
    });
  };

  const showSuccess = (title: string, description?: string) => {
    notification.success({
      message: title,
      description,
      placement: 'topRight',
    });
  };

  const showWarning = (title: string, description?: string) => {
    notification.warning({
      message: title,
      description,
      placement: 'topRight',
    });
  };

  const showInfo = (title: string, description?: string) => {
    notification.info({
      message: title,
      description,
      placement: 'topRight',
    });
  };

  return {
    notification,
    message,
    modal,
    showError,
    showSuccess,
    showWarning,
    showInfo,
  };
};