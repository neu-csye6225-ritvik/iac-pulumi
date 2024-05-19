# web-app
<a href="https://github.com/neu-csye6225-ritvik/webapp"> Web Application </a>

# serverless
<a href="https://github.com/neu-csye6225-ritvik/serverless"> AWS Lambda Function for AWS, GCP interaction </a>

# iac-pulumi
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

# Pulumi Infrastructure Setup for AWS

This Pulumi program sets up various AWS infrastructure resources, including:

- **Virtual Private Cloud (VPC)**
- **Subnets (Public and Private)**
- **Internet Gateway**
- **Route Tables**
- **Security Groups**
- **RDS Instance**
- **Application Load Balancer**
- **Target Group**
- **EC2 Launch Template**
- **Auto Scaling Group**
- **CloudWatch Alarms**
- **SNS Topic**
- **Lambda Function**
- **DynamoDB Table**
- **Route 53 A Record** 

## Requirements

- Pulumi CLI
- Node.js
- AWS Account
- GCP Account
- IAM permissions for creating and managing the resources

## Setup

1. **Configure AWS Credentials:**
   - Set up AWS credentials in your environment. 
   - Refer to the Pulumi documentation for setting up AWS credentials: [https://www.pulumi.com/docs/get-started/create-a-project/](https://www.pulumi.com/docs/get-started/create-a-project/)

2. **Install Dependencies:**
   - Run `npm install` to install the necessary packages.

3. **Configure Configuration:**
   - Create a file named `Pulumi.{stackName}.yaml` where `{stackName}` is your desired stack name.
   - Add the following configuration values to the YAML file:
     ```yaml
     baseCIDRBlock: "10.0.0.0/16" 
     vpcName: "my-vpc" 
     subnetCIDR: "10.0.0.0"
     subnetMask: "24"
     availabilityZone: "us-east-1"
     numOfPubSubnets: 2
     numOfPriSubnets: 2
     igName: "my-ig"
     ami: "ami-08c40d493257997c6" # example AMI ID
     instance_type: "t3.nano" # example EC2 instance type
     keyPair: "keypair_name" # your existing key pair name
     volumeSize: 100 # root volume size in GB
     volumeType: "gp2" # root volume type
     rdsFamily: "postgres14" # RDS engine family
     engineVersion: "14.6" # RDS engine version
     instanceClass: "db.t3.micro" # RDS instance class
     allocatedStorage: 10 # RDS allocated storage
     dbName: "mydatabase" # database name
     username: "myuser" # database username
     password: "mypassword" # database password
     identifier: "myrds" # RDS instance identifier
     hostedZoneId: "Z1234567890ABCDEF" # your Route 53 hosted zone ID
     domainName: "example.com" # your domain name
     mailgunapikey: "your-mailgun-api-key" # mailgun api key
     domainName: "example.com" # domain name
     gcpproject: "gcp-project-id" # GCP Project ID
     ```

4. **Deploy the Infrastructure:**
   - Run `pulumi up` to create the AWS infrastructure.

## Usage

- **Lambda Function:** This Lambda function handles email notification, stores tracking data in DynamoDB, and uploads files to Google Cloud Storage. It's triggered by an SNS topic.
- **EC2 Instance:** This instance runs the web application. It's launched from a Launch Template and managed by an Auto Scaling group. 
- **Load Balancer:** The load balancer distributes traffic to the EC2 instances.
- **RDS Instance:**  The RDS instance hosts the database for the web application.
- **Route 53 A Record:** This record routes traffic to the load balancer.

## Resource Flow and Dependencies 

This document provides a detailed breakdown of the resource creation order and dependencies within the Pulumi program. It explains how each resource is created and how they relate to each other. 

**1. VPC and Subnets**

- The foundation of the infrastructure is the **VPC (Virtual Private Cloud)**. It's created first to provide a virtual network environment.
- **Public and Private Subnets** are created within the VPC. These subnets define the network zones within the VPC.
- **Internet Gateway** is created and attached to the VPC. This gateway enables internet access from the public subnet.

**2. Route Tables and Routes**

- **Public and Private Route Tables** are created for each subnet type. These tables define the routing rules for traffic within the VPC.
- **Routes** are defined within the route tables. The public route table has a route that directs traffic to the Internet Gateway, while the private route table may have a route to a NAT gateway (not implemented in this example).
- **Route Table Associations** are created to associate each subnet with its respective route table.

**3. Security Groups**

- **Load Balancer Security Group:** This security group controls inbound and outbound traffic for the Application Load Balancer. It allows inbound traffic on ports 80 and 443 from anywhere.
- **Application Security Group:** This group is attached to EC2 instances to allow inbound traffic from the Load Balancer. It allows traffic on port 7799 from the Load Balancer's security group.
- **Database Security Group:** This security group is used for the RDS instance and allows TCP traffic from the Application Security Group.

**4. RDS Instance**

- **Parameter Group:** A parameter group is created to configure the RDS instance with specific settings, such as character encoding.
- **RDS Subnet Group:** This group is created to specify the private subnets where the RDS instance will be placed.
- **RDS Instance:** The RDS instance is created within the specified subnet group, with the required database engine, version, instance class, storage, and security group.

**5. Google Cloud Storage Bucket**

- **Bucket:** A Google Cloud storage bucket is created to store files uploaded by the application.

**6. GCP Service Account**

- **Service Account:** A service account is created to allow the AWS Lambda function to access the Google Cloud Storage bucket.
- **Service Account Key:** Keys are generated for the service account to access the bucket. This key is stored securely in AWS Secrets Manager.

**7. SNS Topic**

- **SNS Topic:** This topic is created to send notifications.

**8. Lambda Function**

- **Lambda Role:** A role is created to allow the Lambda function to access various resources.
- **Lambda Function:** The Lambda function is created with the following configurations:
    - Code: Contains the logic for sending emails, storing tracking data, and uploading files.
    - Runtime: Node.js 18.x.
    - Role: The previously created role.
    - Environment Variables: Set environment variables for accessing Google Cloud Storage and DynamoDB.
- **SNS Subscription:** The Lambda function is subscribed to the SNS topic to trigger the execution when a notification is published.

**9. DynamoDB Table**

- **DynamoDB Table:** A DynamoDB table is created to store email tracking data.
- **Lambda Permission:** Permissions are granted to the Lambda function to access the DynamoDB table.

**10. EC2 Launch Template**

- **IAM Role:** An IAM role is created for the EC2 instances with appropriate permissions to access CloudWatch, DynamoDB, and Lambda.
- **Instance Profile:** An Instance Profile is created and attached to the IAM role.
- **EC2 Launch Template:** This template defines the configuration for launching EC2 instances, including:
    - Image ID: Specifies the AMI to use.
    - Instance Type: Specifies the instance type.
    - Key Pair: Specifies the key pair for accessing the instance.
    - IAM Instance Profile: Specifies the previously created instance profile.
    - Network Interfaces:  Configures the network settings (subnet, security group, and public IP).
    - Block Device Mappings: Defines the root volume settings (size and type).
    - User Data:  Contains a script to install the CloudWatch agent and set environment variables.

**11. Auto Scaling Group**

- **Auto Scaling Group:** An Auto Scaling group is created to manage the EC2 instances, including:
    - Launch Template: Specifies the previously created Launch Template.
    - Scaling Policies: Defines scaling rules based on CPU utilization.
    - Target Group: Specifies the Target Group to which the instances are registered.

**12. Application Load Balancer**

- **Application Load Balancer:** An Application Load Balancer is created to distribute traffic across the EC2 instances in the Auto Scaling group.
- **Target Group:** A Target Group is created to register the EC2 instances and define health checks for the Load Balancer.
- **Listener:** A listener is created for the Load Balancer to handle HTTPS traffic on port 443. It uses an ACM certificate to secure the connection.
- **Listener Rules:** Rules are defined to route traffic to the appropriate Target Group.

**13. Route 53 A Record**

- **Route 53 A Record:** This record is created in the Route 53 hosted zone to route traffic to the load balancer's DNS name.

**Dependencies:**

- Each resource depends on the resources that are created before it.
- For example, the EC2 Launch Template depends on the IAM Role and Instance Profile.
- The Auto Scaling group depends on the Launch Template and Target Group.
- The Load Balancer depends on the security group and the subnets.

**Flow:**

The program creates resources in a logical order, ensuring dependencies are satisfied before creating dependent resources. 

This flow ensures that the AWS infrastructure is set up correctly and that resources are in a working state after deployment.


