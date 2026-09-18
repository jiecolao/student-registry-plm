# Use the official, lightweight Nginx web server image
FROM nginx:alpine

# Copy all files from your current folder into the Nginx web root directory
COPY . /usr/share/nginx/html