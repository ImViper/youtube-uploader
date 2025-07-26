# YouTube Matrix Frontend

A modern, enterprise-grade web application for managing YouTube uploads across multiple accounts with real-time monitoring, bulk operations, and advanced analytics.

## 🚀 Features

- **Multi-Account Management**: Manage unlimited YouTube accounts with health monitoring
- **Bulk Upload Operations**: Upload videos in bulk with CSV import and intelligent distribution
- **Real-time Monitoring**: Track system performance, upload progress, and account health
- **Advanced Analytics**: Comprehensive dashboards with performance metrics and insights
- **Queue Management**: Sophisticated upload queue with priority and scheduling
- **Security Features**: CSRF protection, input sanitization, and secure authentication
- **Responsive Design**: Fully optimized for desktop and mobile devices
- **Performance Optimized**: Lazy loading, virtual scrolling, and intelligent caching

## 🛠 Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5.x for lightning-fast development
- **State Management**: Redux Toolkit with RTK Query
- **UI Components**: Ant Design 5.0
- **Charts**: ECharts for data visualization
- **Real-time**: Socket.io for WebSocket connections
- **Styling**: Tailwind CSS + CSS Modules
- **Testing**: Jest, React Testing Library, Cypress
- **CI/CD**: GitHub Actions, Docker, Kubernetes

## 📋 Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- Backend API running (see backend repository)

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/youtube-matrix-frontend.git
cd youtube-matrix-frontend

# Install dependencies
npm ci

# Create environment file
cp .env.example .env

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## 📜 Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors
npm run format           # Format code with Prettier
npm run format:check     # Check code formatting
npm run type-check       # Run TypeScript type checking
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate test coverage
npm run e2e              # Run E2E tests
npm run e2e:open         # Open Cypress UI
```

## 📁 Project Structure

```
youtube-matrix-frontend/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── common/          # Generic components
│   │   ├── upload/          # Upload-related components
│   │   ├── account/         # Account management
│   │   ├── monitoring/      # Analytics and monitoring
│   │   ├── settings/        # Settings components
│   │   ├── security/        # Security components
│   │   ├── performance/     # Performance optimization
│   │   ├── responsive/      # Responsive layouts
│   │   └── mobile/          # Mobile-specific components
│   ├── features/            # Redux slices and feature logic
│   ├── hooks/               # Custom React hooks
│   ├── pages/               # Page components
│   ├── services/            # API and external services
│   ├── store/               # Redux store configuration
│   ├── utils/               # Utility functions
│   ├── types/               # TypeScript definitions
│   └── styles/              # Global styles
├── cypress/                 # E2E test files
├── docs/                    # Documentation
├── k8s/                     # Kubernetes manifests
├── scripts/                 # Deployment scripts
└── public/                  # Static assets
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# API Configuration
VITE_API_URL=http://localhost:4000/api
VITE_WEBSOCKET_URL=ws://localhost:4000

# Application Settings
VITE_ENVIRONMENT=development
VITE_APP_NAME=YouTube Matrix

# Feature Flags
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_ERROR_TRACKING=false

# Third-party Services (Production only)
VITE_SENTRY_DSN=
VITE_GA_TRACKING_ID=
```

## 🧪 Testing

### Unit Tests
```bash
npm run test                 # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

### E2E Tests
```bash
npm run e2e                 # Headless mode
npm run e2e:open           # Interactive mode
```

## 🐳 Docker Support

### Development
```bash
docker-compose up frontend-dev
```

### Production
```bash
docker build -t youtube-matrix-frontend .
docker run -p 80:80 youtube-matrix-frontend
```

## 📦 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to AWS S3 + CloudFront
```bash
./scripts/deploy.sh production
```

### Deploy to Kubernetes
```bash
kubectl apply -f k8s/
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions.

## 📚 Documentation

- [Development Guide](docs/DEVELOPMENT.md) - Detailed development instructions
- [API Documentation](docs/API.md) - API endpoints and integration
- [Deployment Guide](docs/DEPLOYMENT.md) - Deployment strategies and configuration

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- Create an issue on GitHub
- Check the [documentation](docs/)
- Contact support at support@yourdomain.com

## 🙏 Acknowledgments

- Built with React and modern web technologies
- UI components from Ant Design
- Charts powered by Apache ECharts
- Icons from Ant Design Icons
