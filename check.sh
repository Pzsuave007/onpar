#!/bin/bash
# Fix permissions on uploads
chown -R onparliveuni2:onparliveuni2 /home/onparliveuni2/public_html/uploads
chmod -R 755 /home/onparliveuni2/public_html/uploads
echo "Permissions fixed"

# Check if photos display (test the URL)
PHOTO=$(ls /home/onparliveuni2/public_html/uploads/feed/tourn_*/  2>/dev/null | head -1)
if [ -n "$PHOTO" ]; then
    echo "Photo file exists: $PHOTO"
    echo "Test URL: https://onparlive.com/uploads/feed/$(basename $(dirname $PHOTO))/$(basename $PHOTO)"
else
    echo "No photos found yet"
fi

echo ""
echo "Now try uploading a photo from your phone."
