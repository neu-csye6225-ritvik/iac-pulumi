# iac-pulumi
Infrastructure as code with pulumi

#AWS account
1. Create organization
2. Create user accounts in the organization(dev, demo)
3. Login to dev and demo accounts and setup multi-factor authentication
4. In each account, create IAM user groups and users with console and arn:aws:iam::aws:policy/ReadOnlyAccess access
5. Prov

#AWS CLI and Configure
aws configure --profile 
    set accesskey and secretaccesskey for each profile(dev and demo)
cat .aws/credentials - check the configuration here

#Install Pulumi
pulumu login --local
pulumi new or pulumi new --force
    choose the aws-javascript
    choose stack (dev or demo)

#AWS Networking Setup
1. Create Virtual Private Cloud (VPC).
2. Create subnets in your VPC. You must create 3 public subnets and 3 private subnets, each in a different availability zone in the same region in the same VPC
3. Create an Internet Gateway resource and attach the Internet Gateway to the VPC.
4. Create a public route table. Attach all public subnets created to the route table.
5. Create a private route table. Attach all private subnets created to the route table.
6. Create a public route in the public route table created above with the destination CIDR block 0.0.0.0/0 and the internet gateway created above as the target.



