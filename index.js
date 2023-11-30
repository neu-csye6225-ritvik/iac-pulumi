const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const route53 = require("@pulumi/aws/route53");
const path = require("path");
// const config = require("./lambda");
const gcp = require("@pulumi/gcp");

const fs = require('fs');
const yaml = require('js-yaml');

let stackName = pulumi.getStack();
let configFileName = `Pulumi.${stackName}.yaml`;

const config = yaml.load(fs.readFileSync(configFileName, 'utf8'));

let id = 0;

const createSubnets = (vpc, type, count) => {
    let subnets = [];
    let flag = false;
    if (type === "public") {
        flag = true
    }

    const octets = config.subnetCIDR.split('.');

    for (let i = 0; i < count; i++) {
        let subnet = new aws.ec2.Subnet(`subnet-${type}-${i}`, {
            vpcId: vpc.id,
            cidrBlock: `${octets[0]}.${octets[1]}.${id++}.${octets[3]}/${config.subnetMask}`,
            availabilityZone: `${config.availabilityZone}${String.fromCharCode(97 + i)}`,
            // mapPublicIpOnLaunch: flag,
            tags: {
                Name: `subnet-${type}-${i}`,
                Type: type
            }
        });
        subnets.push(subnet);
    }
    return subnets;
}

const main = async () => {
    // Create a VPC
    const vpc = new aws.ec2.Vpc("my-vpc", {
        cidrBlock: config.baseCIDRBlock,
        tags: {
            Name: config.vpcName,
        },
    });
    // Create public subnets
    const publicSubnets = createSubnets(vpc, 'public', config.numOfPubSubnets);
    // Create private subnets
    const privateSubnets = createSubnets(vpc, 'private', config.numOfPriSubnets);
    // Create an internet gateway and attach it to the VPC
    const internetGateway = new aws.ec2.InternetGateway("igw", {
        tags: {
            Name: config.igName,
        },
    });

    const vpcGatewayAttachment = new aws.ec2.InternetGatewayAttachment("vpcGatewayAttachment", {
        vpcId: vpc.id,
        internetGatewayId: internetGateway.id
    });

    // Create public route tables
    const publicRouteTable = new aws.ec2.RouteTable("public-route-table", {
        vpcId: vpc.id,
        // gatewayId: internetGateway.id
    });

    // Create private route tables
    const privateRouteTable = new aws.ec2.RouteTable("private-route-table", {
        vpcId: vpc.id,
    });

    //create a public route and setting a cidr destination
    const publicRoute = new aws.ec2.Route("publicRoute", {
        routeTableId: publicRouteTable.id,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: internetGateway.id
    });

    // Associate the public route tables with the public subnets
    for (let i = 0; i < config.numOfPubSubnets; i++) {
        new aws.ec2.RouteTableAssociation(`public-association-${i}`, {
            subnetId: publicSubnets[i].id,
            routeTableId: publicRouteTable.id,
        });
    }

    // Associate the public route tables with the public subnets
    for (let i = 0; i < config.numOfPriSubnets; i++) {
        new aws.ec2.RouteTableAssociation(`private-association-${i}`, {
            subnetId: privateSubnets[i].id,
            routeTableId: privateRouteTable.id,
        });
    }

    const lbSecGrp = new aws.ec2.SecurityGroup("sgLB", {
        vpcId: vpc.id,
        name: "lb-ec2",
        description: "Load Balancer Security Group",
        ingress: [
            {
                protocol: "tcp", fromPort: 80, toPort: 80,
                cidrBlocks: ["0.0.0.0/0"]
            },
            {
                protocol: "tcp", fromPort: 443, toPort: 443,
                cidrBlocks: ["0.0.0.0/0"]
            }
        ],
        egress: [
            { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
        ],
        tags: {
            Name: "load-balancer-sg",
        },
    });

    // Create an Application Security Group to attach to ec2
    let ec2SecGrp = new aws.ec2.SecurityGroup("sgEc2", {
        name: "ec2-rds-1",
        vpcId: vpc.id,
        description: "Application Security Group",
        ingress: [
            {
                protocol: "tcp", fromPort: 22, toPort: 22,
                cidrBlocks: ["0.0.0.0/0"]
                // securityGroups: [lbSecGrp.id]
            },
            {
                protocol: "tcp", fromPort: 7799, toPort: 7799,
                // cidrBlocks: ["0.0.0.0/0"],
                securityGroups: [lbSecGrp.id]
            }
        ],
        egress: [
            { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
        ],
        tags: {
            Name: "ec2-rds-1",
        },

    });

    // Create a Database Security Group that allows TCP traffic of above security group
    const dbSecGrp = new aws.ec2.SecurityGroup("sgRds", {
        vpcId: vpc.id,
        name: "rds-ec2-1",
        description: "Database Security Group",
        ingress: [
            { protocol: "tcp", fromPort: 5432, toPort: 5432, securityGroups: [ec2SecGrp.id] },
        ],
        tags: {
            Name: "rds-ec2-1",
        },
    });

    // Create a new parameter group
    const rdsParameterGroup = new aws.rds.ParameterGroup("pg", {
        family: config.rdsFamily,
        parameters: [
            { name: "client_encoding", value: "UTF8", }
        ],
        description: "RDS parameter group"
    });

    // Create an RDS Subnet group
    const dbSubnetGroup = new aws.rds.SubnetGroup("db-subnet-group", {
        subnetIds: [privateSubnets[0].id,
        privateSubnets[1].id,],  // Assuming your VPC has at least one subnet
    });

    // Create a new RDS instance
    const rdsInstance = new aws.rds.Instance("rds-instance", {

        engine: config.engine,
        engineVersion: config.engineVersion,
        instanceClass: config.instanceClass,
        allocatedStorage: config.allocatedStorage,
        // name: "rdsDbInstance",
        dbName: config.dbName, //database name
        username: config.username,
        password: config.password,
        parameterGroupName: rdsParameterGroup.name,
        vpcSecurityGroupIds: [dbSecGrp.id],
        skipFinalSnapshot: true,
        dbSubnetGroupName: dbSubnetGroup.name,
        publiclyAccessible: false,
        multiAz: false,
        identifier: config.identifier,//name of the rds instance

    });


    // Create a Google Cloud storage bucket
    const bucket = new gcp.storage.Bucket("my-bucket-check", {
        location: "US",
        forceDestroy: true,
        versioning: {
            enabled: true,
        },
    });

    // // Create a service account
    const serviceAccount = new gcp.serviceaccount.Account("serviceAccount", {
        accountId: "service-account-id",
        displayName: "Service Account",
    });

    // // Create access keys for the service account
    const serviceAccountKey = new gcp.serviceaccount.Key("serviceKey", {
        serviceAccountId: serviceAccount.name,
        publicKeyType: "TYPE_X509_PEM_FILE",
    });

    // // Give the service account the required permissions
    const bucketAdminBinding = new gcp.projects.IAMBinding("bucketAdminBinding", {
        members: [pulumi.interpolate`serviceAccount:${serviceAccount.email}`],
        role: "roles/storage.admin",  // admin role for managing storage buckets
        project: config.gcpproject,
    });

    //create SNS topic
    const snsTopic = new aws.sns.Topic("snsTopicAmi", {});

    //lamabda role
    const lambdaRole = new aws.iam.Role("lambdaRole", {
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Action: "sts:AssumeRole",
                Principal: {
                    Service: "lambda.amazonaws.com",
                },
                Effect: "Allow",
                Sid: "",
            }],
        }),
    });

    new aws.iam.RolePolicyAttachment("lambdaRolePolicyAttachment", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    });

    const secretsManagerPolicy = new aws.iam.Policy("secretsManagerPolicy", {
        policy: {
            Version: "2012-10-17",
            Statement: [{
                Action: "secretsmanager:*", // Use the wildcard to allow any action
                Effect: "Allow",
                Resource: "*", // Use the wildcard to allow access to any resource
            }],
        },
    });

    new aws.iam.RolePolicyAttachment("lambdaRolePolicyAttachmentAWSSecretsManager", {
        role: lambdaRole.name,
        policyArn: secretsManagerPolicy.arn,
    });


    // Create DynamoDB table
    const dynamoDB = new aws.dynamodb.Table("emailtrack", {
        name: "emailtrack",
        attributes: [
            { name: "id", type: "S" },
        ],
        hashKey: "id",
        billingMode: "PAY_PER_REQUEST",
    });

    const dynamoDBFullAccessPolicy = new aws.iam.Policy("dynamoDBFullAccessPolicy", {
        policy: {
            Version: "2012-10-17",
            Statement: [{
                Action: [
                    "dynamodb:PutItem",
                    "dynamodb:GetItem",
                    "dynamodb:Scan",
                    "dynamodb:Query",
                    "dynamodb:UpdateItem",
                    "dynamodb:DeleteItem"
                ],
                Resource: dynamoDB.arn, // Replace with your DynamoDB table ARN if possible
                Effect: "Allow"
            }]
        }
    });

    const dynamoDBFullAccessPolicyAttachment = new aws.iam.PolicyAttachment("dynamoDBFullAccessPolicyAttachment", {
        roles: [lambdaRole],
        policyArn: dynamoDBFullAccessPolicy.arn,
    });

    // Create a secret
    let gcpSecretKey = new aws.secretsmanager.Secret("mysecret", {});

    // Create a secret version
    let gcpSecretKeyVersion = new aws.secretsmanager.SecretVersion("mysecretversion", {
        secretId: gcpSecretKey.id,
        secretString: serviceAccountKey.privateKey,
    });


    // // Create an AWS Lambda function
    const lambdaFunction = new aws.lambda.Function("lambdaFunction", {
        code: new pulumi.asset.AssetArchive({
            ".": new pulumi.asset.FileArchive("/Users/ritvikparamkusham/Downloads/Cloud/project9/serverless/serverless/Archive.zip"),
        }),
        handler: "index.handler",
        role: lambdaRole.arn,
        runtime: "nodejs18.x",
        environment: {
            // Add environment variables for GCP access keys or configurations
            variables: {
                "GCP_SERVICE_ACCOUNT_KEY": serviceAccountKey.privateKey, // service aacount created private key to Lambda
                "GCP_PROJECT_ID": gcp.config.project, // GCP Project ID 
                "GOOGLE_STORAGE_BUCKET": bucket.url,
                "GOOGLE_STORAGE_BUCKET_NAME": bucket.name,
                "DYNAMODB_TABLE_NAME": dynamoDB.name,
                "MAILGUN_API_KEY": config.mailgunapikey,
                "DOMAIN": config.domainName,
                "GCP_SECRET_KEY": gcpSecretKeyVersion.arn,
            }
        },
    });

    new aws.lambda.Permission("lambdaPermission", {
        action: "lambda:InvokeFunction",
        function: lambdaFunction.name,
        principal: "sns.amazonaws.com",
        sourceArn: snsTopic.arn,
    });

    new aws.sns.TopicSubscription("snsTopicSubscription_lambda", {
        endpoint: lambdaFunction.arn,
        protocol: "lambda",
        topic: snsTopic.arn,
    });


    // Grant Lambda permissions to access the DynamoDB table
    const tableGrant = new aws.lambda.Permission("tableGrant", {
        action: "lambda:InvokeFunction",
        function: lambdaFunction.name,
        principal: "dynamodb.amazonaws.com",
        sourceArn: dynamoDB.arn,
    });


    // Create an IAM role
    const role = new aws.iam.Role("role", {
        assumeRolePolicy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
                {
                    Action: "sts:AssumeRole",
                    Principal: {
                        Service: "ec2.amazonaws.com"
                    },
                    Effect: "Allow",
                    Sid: ""
                }
            ]
        })
    });

    // Attach CloudWatchAgentServerPolicy policy to IAM role
    new aws.iam.RolePolicyAttachment("rolePolicyAttachmentCloudWatch", {
        role: role.name,
        policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    });

    new aws.iam.RolePolicyAttachment("rolePolicyAttachmentDynamoDB", {
        role: role.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
    });

    new aws.iam.RolePolicyAttachment("rolePolicyAttachmentLambda", {
        role: role.name,
        // policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
        policyArn: "arn:aws:iam::aws:policy/AWSLambda_FullAccess",
    });

    // // Create an IAM instance profile for the role
    const instanceProfile = new aws.iam.InstanceProfile("myInstanceProfile", {
        role: role.name,
    });

    const snsPublishPolicy = new aws.iam.Policy("SNSPublishPolicy", {
        policy: {
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Action: "sns:Publish",
                Resource: snsTopic.arn,
            }],
        },
        roles: [role.name],
    });

    const snsPublishPolicyAttachment = new aws.iam.RolePolicyAttachment("SNSPublishPolicyAttachment", {
        role: role.name,
        policyArn: snsPublishPolicy.arn,
    });


    // User data script
    const userDataScript = pulumi.interpolate`#!/bin/bash
    
    sudo cp -r .aws /opt/webappuser

    sudo chown -R webappuser:webappgroup /opt/webappuser/.aws

    cd /opt/webappuser/webapp

    touch .env
    echo NODE_ENV=production >> .env
    echo "DB_USER=${rdsInstance.username}" >> .env
    echo "DB_NAME=${rdsInstance.dbName}" >> .env
    echo "DB_PORT=5432" >> .env
    echo "APP_PORT=7799" >> .env
    echo "DB_HOSTNAME=${rdsInstance.address}" >> .env
    echo "DB_PASSWORD=${config.password}" >> .env

    echo "SNSTOPICARN=${snsTopic.arn}" >> .env
    echo "AWS_REGION=us-east-1" >> .env
    echo "AWS_PROFILE=demo" >> .env


    sudo systemctl daemon-reload
    sudo systemctl restart webapp
    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
        -a fetch-config \
        -m ec2 \
        -c file:/opt/webappuser/webapp/cloudwatch-config.json \
        -s
`;

    const ec2LaunchTemplate = new aws.ec2.LaunchTemplate("ec2launchTemp", {
        imageId: config.ami,
        instanceType: config.instance_type,
        keyName: config.keyPair,
        iamInstanceProfile: { name: instanceProfile.name },
        networkInterfaces: [{
            associatePublicIpAddress: "true",
            subnetId: publicSubnets[0].id,
            securityGroups: [ec2SecGrp.id],
        }],
        tagSpecifications: [{
            resourceType: "instance",
            tags: {
                Name: "EC2 Launch Template",
            },
        }],
        blockDeviceMappings: [{
            deviceName: "/dev/sdf",
            ebs: {
                volumeSize: config.volumeSize, // Root volume size in GB.
                volumeType: config.volumeType, // Root volume type.
                deleteOnTermination: true, // Delete the root EBS volume on instance termination.
            },
        }],


        userData: userDataScript.apply((data) => Buffer.from(data).toString("base64")),
    });

    // Create an AWS Application Load Balancer
    const lb = new aws.lb.LoadBalancer("lb", {
        name: "csye6225-lb",
        internal: false,
        loadBalancerType: "application",
        securityGroups: [lbSecGrp.id],
        subnets: pulumi.output(publicSubnets).apply(subnets => subnets.map(subnet => subnet.id)),
        tags: {
            Application: "webapp",
        },
    });

    // Create an AWS Target Group
    const targetGroup = new aws.lb.TargetGroup("target_group", {
        name: "csye6225-lb-alb-tg",
        port: 7799,//application port
        targetType: "instance",

        protocol: "HTTP",
        vpcId: vpc.id,
        healthCheck: {
            healthyThreshold: 3,
            unhealthyThreshold: 3,
            timeout: 10,
            interval: 30,
            path: "/healthz",
        },
    });

    // Create an AWS Listener for the Load Balancer
    const listener = new aws.lb.Listener("front_end", {
        loadBalancerArn: lb.arn,
        port: 80,//http port
        protocol: "HTTP",
        defaultActions: [{
            type: "forward",
            targetGroupArn: targetGroup.arn,
        }],
    });

    const autoScalingGroup = new aws.autoscaling.Group("asg", {
        name: "asg_launch_config_ami",
        maxSize: 3,
        minSize: 1,
        desiredCapacity: 1,
        forceDelete: true,
        defaultCooldown: 60,
        vpcZoneIdentifiers: pulumi.output(publicSubnets).apply(ids => ids || []),
        tags: [
            {
                key: "Name",
                value: "asg_launch_config",
                propagateAtLaunch: true,
            },
        ],
        launchTemplate: {
            id: ec2LaunchTemplate.id,
            version: "$Latest",
        },
        dependsOn: [targetGroup],
        targetGroupArns: [targetGroup.arn],
    });

    const scaleUpPolicy = new aws.autoscaling.Policy("scaleUpPolicy", {
        autoscalingGroupName: autoScalingGroup.name,
        scalingAdjustment: 1,
        cooldown: 60,
        adjustmentType: "ChangeInCapacity",
        autocreationCooldown: 60,
        cooldownDescription: "Scale up policy when average CPU usage is above 5%",
        policyType: "SimpleScaling",
        scalingTargetId: autoScalingGroup.id,
    });

    const scaleDownPolicy = new aws.autoscaling.Policy("scaleDownPolicy", {
        autoscalingGroupName: autoScalingGroup.name,
        scalingAdjustment: -1,
        cooldown: 60,
        adjustmentType: "ChangeInCapacity",
        autocreationCooldown: 60,
        cooldownDescription:
            "Scale down policy when average CPU usage is below 3%",
        policyType: "SimpleScaling",
        scalingTargetId: autoScalingGroup.id,
    });

    const cpuUtilizationAlarmHigh = new aws.cloudwatch.MetricAlarm(
        "cpuUtilizationAlarmHigh",
        {
            comparisonOperator: "GreaterThanThreshold",
            evaluationPeriods: 1,
            metricName: "CPUUtilization",
            namespace: "AWS/EC2",
            period: 60,
            threshold: 5,
            statistic: "Average",
            alarmActions: [scaleUpPolicy.arn],
            dimensions: { AutoScalingGroupName: autoScalingGroup.name },
        }
    );

    const cpuUtilizationAlarmLow = new aws.cloudwatch.MetricAlarm(
        "cpuUtilizationAlarmLow",
        {
            comparisonOperator: "LessThanThreshold",
            evaluationPeriods: 1,
            metricName: "CPUUtilization",
            namespace: "AWS/EC2",
            period: 60,
            statistic: "Average",
            threshold: 3,
            alarmActions: [scaleDownPolicy.arn],
            dimensions: { AutoScalingGroupName: autoScalingGroup.name },
        }
    );

    const hostedZoneId = config.hostedZoneId;

    const demoArecord = new route53.Record("aRecord", {
        zoneId: hostedZoneId,
        name: config.domainName,
        type: "A",
        aliases: [{
            name: lb.dnsName,
            zoneId: lb.zoneId,
            evaluateTargetHealth: true,
        }],
    });

}


exports = main();
