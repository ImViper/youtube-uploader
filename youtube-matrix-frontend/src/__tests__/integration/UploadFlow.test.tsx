import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test/testUtils';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { uploadsApi } from '@/features/uploads/uploadsApi';
import { useAppDispatch } from '@/hooks/redux';

// Mock server
const server = setupServer(
  http.post('http://localhost:3000/api/uploads', async () => {
    // 简化处理，不解析FormData
    return HttpResponse.json({
      id: '123',
      title: 'Test Video',
      description: 'Test Description',
      status: 'completed',
      progress: 100,
      accountId: 'test-account',
      videoUrl: 'https://youtube.com/watch?v=123',
      createdAt: new Date().toISOString(),
    });
  }),
  http.get('http://localhost:3000/api/uploads', () => {
    return HttpResponse.json({
      items: [
        { 
          id: '1', 
          title: 'Video 1', 
          status: 'completed', 
          progress: 100,
          accountId: 'acc1',
          videoUrl: 'https://youtube.com/watch?v=1',
          createdAt: new Date().toISOString(),
        },
        { 
          id: '2', 
          title: 'Video 2', 
          status: 'uploading', 
          progress: 45,
          accountId: 'acc2',
          videoUrl: null,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 2,
      page: 1,
      pageSize: 10,
      hasNextPage: false,
    });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Test component that uses the upload API
const TestUploadComponent: React.FC = () => {
  const dispatch = useAppDispatch();
  const [message, setMessage] = React.useState('');
  
  const handleUpload = async () => {
    try {
      const mockFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
      const result = await dispatch(
        uploadsApi.endpoints.createUpload.initiate({
          accountId: 'test-account',
          videoFile: mockFile,
          title: 'Test Video',
          description: 'Test Description',
          tags: ['test'],
        })
      ).unwrap();
      setMessage('Upload successful');
    } catch (error) {
      setMessage('Upload failed');
    }
  };
  
  return (
    <div>
      <button onClick={handleUpload}>Start Upload</button>
      {message && <div>{message}</div>}
    </div>
  );
};

describe('Upload Flow Integration', () => {

  it('fetches upload list', async () => {
    const TestListComponent: React.FC = () => {
      const { data: uploadsData } = uploadsApi.useGetUploadsQuery({
        page: 1,
        pageSize: 10,
      });
      
      const uploads = uploadsData?.items || [];
      
      return (
        <div>
          {uploads.map((upload) => (
            <div key={upload.id}>{upload.title}</div>
          ))}
        </div>
      );
    };

    renderWithProviders(<TestListComponent />);
    
    await waitFor(() => {
      expect(screen.getByText('Video 1')).toBeInTheDocument();
      expect(screen.getByText('Video 2')).toBeInTheDocument();
    });
  });
});