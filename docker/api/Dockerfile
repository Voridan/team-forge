# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines

# Stage 2: Build TypeScript
FROM deps AS build
COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
RUN yarn build

# Stage 3a: Development (hot reload)
FROM deps AS development
COPY src/ ./src/
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
CMD ["yarn", "start:dev"]

# Stage 3b: Production (minimal runtime)
FROM node:20-alpine AS production
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --ignore-engines --production && yarn cache clean
COPY --from=build /app/dist ./dist/
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
