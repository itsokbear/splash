FROM node:lts-alpine@sha256:2867d550cf9d8bb50059a0fff528741f11a84d985c732e60e19e8e75c7239c43 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS source
COPY . .
CMD ["npm", "run", "dev", "--", "--port", "5173"]

FROM source AS build
RUN npm run build

FROM python:3.13-alpine AS reference-tests
WORKDIR /app/plukh_codex
COPY plukh_codex/ ./
CMD ["python", "-m", "unittest", "test_reference_rules.py", "-v"]

# Keep this version equal to @playwright/test in package-lock.json.
FROM mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27 AS browser-tests
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "test:e2e"]

FROM nginx:alpine AS runtime
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/play/plukh/
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/play/plukh/ || exit 1
EXPOSE 80
