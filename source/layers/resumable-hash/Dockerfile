FROM public.ecr.aws/lambda/nodejs:20

# Dependencies to build resumable-hash library
RUN \
microdnf install -y \
  make \
  gcc-c++ \
  zip \
  python3.11 \
  && \
ln -s /bin/python3.11 /bin/python3

RUN \
npm install -g node-gyp && \
mkdir -p /var/task/dist/nodejs

COPY package.json /var/task/dist/nodejs/

RUN \
cd /var/task/dist/nodejs && \
npm install --only=prod --no-optional

# create lambda layer
RUN \
cd /var/task/dist/ && \
zip -r ../package.zip .

ENTRYPOINT ["/bin/bash", "-c", "echo == DONE =="]
