# Built from the repo root:  docker build -f selfhost/Dockerfile -t lifesoc .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# The database (SQLite, on the lifesoc-data volume).
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node api ./api
COPY --chown=node:node selfhost/server.js ./selfhost/server.js
COPY --from=build --chown=node:node /app/dist ./dist
# Files on the build host can be 0660; make sure the node user can read them.
RUN chmod -R a+rX /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/up || exit 1
CMD ["node", "selfhost/server.js"]
