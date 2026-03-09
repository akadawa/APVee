# Build Frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Final Stage
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Environment variables
ENV PORT=3001
ENV MUSIC_DIR=/music
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "backend/server.js"]
