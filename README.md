# web-app
<a href="https://github.com/neu-csye6225-ritvik/webapp"> Web Application </a>
# iac-pulumi
Infrastructure as code with pulumi

# AWS account
1. Create organization
2. Create user accounts in the organization(dev, demo)
3. Login to dev and demo accounts and setup multi-factor authentication
4. In each account, create IAM user groups and users with console and arn:aws:iam::aws:policy/ReadOnlyAccess access


# AWS CLI and Configure 
aws configure --profile 
    set accesskey and secretaccesskey for each profile(dev and demo)
cat .aws/credentials - check the configuration here

# Install Pulumi
pulumu login --local
pulumi new or pulumi new --force
    choose the aws-javascript
    choose stack (dev or demo)

# AWS Networking Setup
1. Virtual Private Cloud (VPC)
2. Subnets in VPC in a different availability zone in the same region in the same VPC
   1. public subnets
   2. private subnets
3. Internet Gateway resource and attach the Internet Gateway to the VPC
4. Public route table
   1. Attach all public subnets created to the route table
5. Private route table
   1. Attach all private subnets created to the route table
6. Public route in the public route table created above with the destination CIDR block 0.0.0.0/0 and the internet gateway created above as the target
7. Security Groups - Load Balancer, Application, Database
   1. Load Balancer talks to EC2 instances
   2. EC2 instance talk to RDS instance
8. RDS instance and parameter group
9.  IAM role, policy attachment, instance profile for EC2 instances
10. Load Balancer running on public IP 
    1.  Target Group - protocol, port, healthcheck
    2.  Listener - HTTP, HTTPS protocol specification
11. EC2 Launch Template
    1.  AMI
    2.  userdata
    3.  networkInterfaces - public ip, subnets, security groups
    4.  key name - private key file
    5.  blockDeviceMappings
12. AutoScaling Group 
    1.  Mininimum, Desired and Maximum capacity of EC2 instances
    2.  VPC Zone
    3.  Launch Template for EC2 instance
    4.  Target Groups

= base64encode(templatefile("${path.module}/userdata.sh", {
    DB_USER         = rds
    DB_NAME         = `${aws_db_instance.db_instance.db_name}`
    DB_PORT         = `${var.db_port}`
    APP_PORT        = `7070`
    DB_HOSTNAME     = `${aws_db_instance.db_instance.address}`
    DB_PASSWORD     = `${var.db_password}`
    AWS_BUCKET_NAME = `${aws_s3_bucket.s3_bucket.bucket}`
  }))
