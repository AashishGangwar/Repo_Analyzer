# Build stage
FROM node:18-slim AS build
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Pass environment variables to the build
ARG VITE_GITHUB_CLIENT_ID
ARG VITE_GITHUB_CLIENT_SECRET
ARG VITE_GITHUB_CALLBACK_URL
ENV VITE_GITHUB_CLIENT_ID=$VITE_GITHUB_CLIENT_ID
ENV VITE_GITHUB_CLIENT_SECRET=$VITE_GITHUB_CLIENT_SECRET
ENV VITE_GITHUB_CALLBACK_URL=$VITE_GITHUB_CALLBACK_URL

# Build the application
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built assets from build stage (Vite outputs to 'dist' directory by default)
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
