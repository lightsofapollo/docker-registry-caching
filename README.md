docker-registry-caching
=======================

Prototype for docker registry / caching for test infrastructure.


## Usage

Start it up and leave it running in your terminal:

```sh
docker run -p 8080:8080 -e AWS_ACCESS_KEY_ID=xxxx -e AWS_SECRET_ACCESS_KEY=xxx -e S3_BUCKET=s3-bucket -e 'DEBUG=*' -i -t lightsofapollo/docker-registry-node-s3 
```

## Notes

This is a big hack / proof of concept I threw together late at night... my intention was to see the difference between routing the layer through an application stack (like done in the current docker registry) vs redirecting to s3 via a signed url. In my tests the download times of images was 10-30% less with this appraoch... Ideally we could use s3 directly for more operations which should be even faster.
