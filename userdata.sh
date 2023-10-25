#!/bin/bash
cd /home/ec2-user/webapp
touch .env

echo "DB_USER=${DB_USER}" >> .env
echo "DB_NAME=${DB_NAME}" >> .env
echo "DB_PORT=${DB_PORT}" >> .env
echo "APP_PORT=7799" >> .env
echo "DB_HOSTNAME=${DB_HOSTNAME}" >> .env
echo "DB_PASSWORD=${DB_PASSWORD}" >> .env