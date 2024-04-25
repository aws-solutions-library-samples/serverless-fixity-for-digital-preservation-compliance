FROM public.ecr.aws/lambda/nodejs:14

# Dependencies to build resumable-hash library
RUN yum install -y make gcc-c++ zip

RUN mkdir -p /var/task/dist/nodejs

COPY package.json /var/task/dist/nodejs/

RUN cd /var/task/dist/nodejs && npm install --only=prod --no-optional

# create lambda layer
RUN cd /var/task/dist/ && zip -r ../package.zip .

ENTRYPOINT ["/bin/bash", "-c", "echo == DONE =="]
