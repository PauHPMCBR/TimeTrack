FROM node:18-alpine

RUN apk add --no-cache mongodb-tools

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN echo '#!/bin/sh\n\
set -e\n\
echo "Waiting for MongoDB to be ready..."\n\
until mongosh --host mongodb --eval "db.adminCommand(\\"ping\\")" > /dev/null 2>&1; do\n\
  echo "Waiting for MongoDB..."\n\
  sleep 2\n\
done\n\
echo "MongoDB is ready!"' > /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

CMD ["/bin/sh", "/docker-entrypoint.sh"]