FROM lightsofapollo/node:0.10.26
MAINTAINER James Lal [:lightsofapollo] <james@lightsofapollo.com>
RUN mkdir /docker-registry/
ADD package.json /docker-registry/package.json
ADD server.js /docker-registry/server.js
WORKDIR /docker-registry/
RUN npm install --production
CMD npm start
