# Use official Node.js image
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Build the application
# Note: We don't set NEXT_PUBLIC_API_URL here so it defaults to '/backend-api'
# which allows the browser to use relative paths.
RUN npm run build

# Production image
FROM node:18-alpine AS runner

WORKDIR /app

# Copy built assets
COPY --from=builder /app/next.config.js ./
#COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose port 3000
EXPOSE 3000

# Run the application
CMD ["npm", "start"]
