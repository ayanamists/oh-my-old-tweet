#!/bin/sh
echo "change ownership of /opt/media to nextjs:nodejs"
gosu root chown -R nextjs:nodejs /opt/media || exit 1
echo "successfully changed ownership of /opt/media to nextjs:nodejs"
echo "start nextjs server"
exec gosu nextjs "$@"
