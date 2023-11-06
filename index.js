const aws = require("@pulumi/aws");
const pulumi = require("@pulumi/pulumi");
const route53 = require("@pulumi/aws/route53");
// const config = require("./config");


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
    // Create an AWS resource (Security Group) to attach to ec2
    let sg = new aws.ec2.SecurityGroup("sgEc2", {
        name: "ec2-rds-1",
        vpcId: vpc.id,
        description: "Application Security Group",
        ingress: [
            { protocol: "tcp", fromPort: 22, toPort: 22, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 443, toPort: 443, cidrBlocks: ["0.0.0.0/0"] },
            { protocol: "tcp", fromPort: 7799, toPort: 7799, cidrBlocks: ["0.0.0.0/0"] }
        ],
        egress: [
            { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
        ],
        tags: {
            Name: "ec2-rds-1",
        },

    });

    // Create a new security group that allows TCP traffic of above security group
    const securityGroup = new aws.ec2.SecurityGroup("sgRds", {
        vpcId: vpc.id,
        name: "rds-ec2-1",
        description: "Database Security Group",
        ingress: [
            { protocol: "tcp", fromPort: 5432, toPort: 5432, securityGroups: [sg.id] },
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
        vpcSecurityGroupIds: [securityGroup.id],
        skipFinalSnapshot: true,
        dbSubnetGroupName: dbSubnetGroup.name,
        publiclyAccessible: false,
        multiAz: false,
        identifier: config.identifier,//name of the rds instance

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
    new aws.iam.RolePolicyAttachment("rolePolicyAttachment", {
        role: role.name,
        policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
    });

    // // Create an IAM instance profile for the role
    const instanceProfile = new aws.iam.InstanceProfile("myInstanceProfile", {
        role: role.name,
    });

    const ec2Instance = new aws.ec2.Instance("ec2-instance", {
        // ami: ami.then(img => img.id), // Use the AMI ID from our ami lookup.
        // userDataReplaceOnChange: 
        // userData: Buffer.from(userData).toString("base64"),
        userData: pulumi.interpolate`#!/bin/bash
        cd /opt/webappuser/webapp

        touch .env
    
        echo NODE_ENV=production >> .env
        echo "DB_USER=${rdsInstance.username}" >> .env
        echo "DB_NAME=${rdsInstance.dbName}" >> .env
        echo "DB_PORT=5432" >> .env
        echo "APP_PORT=7799" >> .env
        echo "DB_HOSTNAME=${rdsInstance.address}" >> .env
        echo "DB_PASSWORD=${config.password}" >> .env

        sudo systemctl restart webapp
        
        sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
            -a fetch-config \
            -m ec2 \
            -c file:/opt/webappuser/webapp/cloudwatch-config.json \
            -s

        `,

        ami: config.ami,
        instanceType: config.instance_type, // This is the instance type. 
        keyName: config.keyPair,
        subnetId: publicSubnets[0].id,
        vpcSecurityGroupIds: [sg.id],
        disableApiTermination: false, // Protect against accidental termination.
        associatePublicIpAddress: true,
        userDataReplaceOnChange: true,

        iamInstanceProfile: instanceProfile, // IAM instance profile

        rootBlockDevice: {
            volumeSize: config.volumeSize, // Root volume size in GB.
            volumeType: config.volumeType, // Root volume type.
            deleteOnTermination: true, // Delete the root EBS volume on instance termination.
        },
        tags: {
            Name: `debianEC2`,
        },

    });

    const hostedZoneId = "Z05028562PG0P2UYTMROP";

    const demoArecord = new route53.Record("aRecord", {
        zoneId: hostedZoneId,
        name: "demo.ritvikparamkusham.me",
        type: "A",
        ttl: 300,
        records: [ec2Instance.publicIp], // Assumes ec2Instance has a public IP assigned
        dependsOn: [ec2Instance],
      });


    return { vpcId: vpc.id, publicSubnets, privateSubnets, internetGatewayId: internetGateway.id, publicRoute, vpcGatewayAttachment,
             ec2Instance, sg, rdsInstance, rdsParameterGroup, demoArecord };
}

exports = main();

