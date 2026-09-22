# Production Dockerfile for Zero-Trust IoT Security Framework Backend
FROM python:3.11-slim

# Prevent Python from writing bytecode and enable unbuffered output
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    NODE_ENV=production

# Set working directory inside container
WORKDIR /app

# Install system dependencies & Node.js 20 (required for npm start lifecycle)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    libpq-dev \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Copy backend package.json
COPY package.json ./

# Copy Python requirements and install dependencies
COPY python-security/requirements.txt ./python-security/
RUN pip install --no-cache-dir -r python-security/requirements.txt

# Copy complete backend source code into container
COPY . .

# Expose dynamic application port (Render injects $PORT at runtime)
EXPOSE 8000

# Health check probe for container runtime
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start backend using npm start (which executes python python-security/server.py)
CMD ["npm", "start"]
