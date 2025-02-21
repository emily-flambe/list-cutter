#!/bin/bash -e

/root/wait-for-it.sh \
    -h web \
    -p 80 \
    -t 300

nginx -g "daemon off;"
