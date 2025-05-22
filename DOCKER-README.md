# GitHub Repo Analyzer - Docker Setup

This guide explains how to set up and run the GitHub Repo Analyzer application using Docker.

## Prerequisites

- Docker Desktop installed on your system
- Docker Compose (usually comes with Docker Desktop)
- GitHub OAuth App credentials

## Setup Instructions

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <your-repository-url>
   cd my-react-app
   ```

2. **Create a `.env` file** in the project root with your GitHub OAuth credentials:
   ```env
   VITE_GITHUB_CLIENT_ID=your_client_id_here
   VITE_GITHUB_CLIENT_SECRET=your_client_secret_here
   VITE_GITHUB_CALLBACK_URL=http://localhost:5173/auth/github/callback
   ```

## Running the Application

### Development Mode

To run the application in development mode with hot-reloading:

```bash
docker-compose up --build
```

The application will be available at: http://localhost:5173

### Production Build

To create a production build and serve it using Nginx:

1. Build the production image:
   ```bash
   docker build -t github-analyzer:production --target build .
   ```

2. Run the production container:
   ```bash
   docker run -p 80:80 github-analyzer:production
   ```

The application will be available at: http://localhost

## Stopping the Application

To stop the application, press `Ctrl+C` in the terminal where it's running, or run:

```bash
docker-compose down
```

## Troubleshooting

### Common Issues

1. **Port already in use**: 
   - Make sure port 5173 is not being used by another application
   - Or change the port mapping in `docker-compose.yml`

2. **Environment variables not loading**:
   - Ensure your `.env` file is in the project root
   - Variable names in `.env` must match those in `docker-compose.yml`

3. **Docker build fails**:
   - Check your internet connection
   - Ensure Docker is running
   - Run `docker system prune` to clean up unused resources

### Viewing Logs

To view container logs:

```bash
docker-compose logs -f
```

## Development Workflow

- The development server supports hot-reloading
- Code changes will automatically reflect in the running container
- Use `docker-compose down` to stop and remove containers when done

## Production Deployment

For production deployment, consider:

1. Using a reverse proxy like Nginx or Traefik
2. Setting up SSL/TLS certificates (e.g., using Let's Encrypt)
3. Configuring proper logging and monitoring
4. Setting up CI/CD pipelines for automated deployments
